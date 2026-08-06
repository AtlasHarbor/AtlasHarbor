import express from 'express';
import { createProblemSpaceStorage } from './problem-space-storage.js';
import { supabaseSecretKey, supabaseServiceHeaders } from './supabase-server-key.js';
import { normalizeLegacyLegalRecord, newestRecord } from './workspace-records.js';

const text = (value, max = 1000) => String(value ?? '').trim().slice(0, max);
const route = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error('Workspace database API:', error);
    res.status(error.status || 500).json({ error: error.message || 'Workspace database request failed.' });
  }
};

function cleanScenarios(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => ({
      label: text(item?.label, 300),
      date: text(item?.date, 30),
      probability: item?.probability == null ? '' : text(item.probability, 10)
    }))
    .filter((item) => item.label || item.date || item.probability !== '')
    .slice(0, 20);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function workspacePayload(input, current, resourceType, resourceId, existing = null, intent = 'save') {
  const published = intent === 'publish' || existing?.is_published === true || input?.is_published === true;
  const payload = {
    user_id: current.id,
    resource_type: resourceType,
    resource_id: resourceId,
    resource_title: text(input?.resource_title || existing?.resource_title || 'Analysis', 300),
    title: text(input?.title || existing?.title || 'Untitled analysis', 300),
    body: String(input?.body ?? existing?.body ?? '').slice(0, 60000),
    ai_prompt: String(input?.ai_prompt ?? existing?.ai_prompt ?? '').slice(0, 12000),
    projections: cleanScenarios(input?.projections ?? existing?.projections),
    placement: ['top', 'bottom'].includes(input?.placement) ? input.placement : (existing?.placement || 'bottom'),
    is_published: published,
    is_shared: input?.is_shared === true,
    share_scope: input?.share_scope === 'everything' ? 'everything' : 'page',
    share_ai_analysis: input?.share_ai_analysis !== false,
    updated_at: new Date().toISOString()
  };
  if (isUuid(existing?.id || input?.id)) payload.id = existing?.id || input.id;
  if (isUuid(existing?.share_token || input?.share_token)) payload.share_token = existing?.share_token || input.share_token;
  return payload;
}

export function createWorkspaceRouter({ env = process.env, fetchImpl = globalThis.fetch, storage = createProblemSpaceStorage({ env, fetchImpl }) } = {}) {
  const router = express.Router();
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  const publishable = env.SUPABASE_PUBLISHABLE_KEY || '';
  const secret = supabaseSecretKey(env);

  function databaseHeaders(userToken, { json = true, prefer = null } = {}) {
    const headers = secret
      ? supabaseServiceHeaders(secret, { json })
      : { apikey: publishable, Authorization: `Bearer ${userToken}` };
    headers.Accept = 'application/json';
    if (json) headers['Content-Type'] = 'application/json';
    if (prefer) headers.Prefer = prefer;
    return headers;
  }

  async function databaseRequest(table, query, { method = 'GET', body, userToken, prefer = null } = {}) {
    if (!base || !publishable) throw Object.assign(new Error('Supabase database configuration is unavailable.'), { status: 503 });
    const response = await fetchImpl(`${base}/rest/v1/${table}${query}`, {
      method,
      headers: databaseHeaders(userToken, { json: body !== undefined || method !== 'GET', prefer }),
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch {}
    if (!response.ok) {
      const detail = data?.message || data?.details || data?.hint || raw || `${table} returned ${response.status}`;
      const error = new Error(`Workspace database error: ${detail}`);
      error.status = response.status === 404 ? 503 : response.status;
      throw error;
    }
    return data;
  }

  async function databaseRows(current, token, resourceType, resourceId) {
    return databaseRequest(
      'workspace_notes',
      `?user_id=eq.${encodeURIComponent(current.id)}&resource_type=eq.${encodeURIComponent(resourceType)}&resource_id=eq.${encodeURIComponent(resourceId)}&select=*&limit=1`,
      { userToken: token }
    );
  }

  async function legacyRows(current, token, resourceType, resourceId) {
    if (resourceType !== 'legal_case') return [];
    try {
      const rows = await databaseRequest(
        'legal_notes',
        `?user_id=eq.${encodeURIComponent(current.id)}&case_slug=eq.${encodeURIComponent(resourceId)}&select=*&order=updated_at.desc&limit=1`,
        { userToken: token }
      );
      return (rows || []).map(normalizeLegacyLegalRecord);
    } catch (error) {
      if (error.status === 503 || error.status === 404 || /legal_notes|schema cache|relation/i.test(error.message)) return [];
      throw error;
    }
  }

  async function upsert(current, token, resourceType, resourceId, input, existing = null, intent = 'save') {
    const payload = workspacePayload(input, current, resourceType, resourceId, existing, intent);
    const rows = await databaseRequest(
      'workspace_notes',
      '?on_conflict=user_id,resource_type,resource_id',
      {
        method: 'POST',
        body: payload,
        userToken: token,
        prefer: 'return=representation,resolution=merge-duplicates'
      }
    );
    if (!rows?.[0]) throw Object.assign(new Error('The workspace database did not return the saved record.'), { status: 502 });
    return rows[0];
  }

  async function load(req, { migrate = true } = {}) {
    const { token, current } = await storage.requestUser(req);
    const resourceType = text(req.params.resourceType, 80);
    const resourceId = text(req.params.resourceId, 300);
    if (!resourceType || !resourceId) throw Object.assign(new Error('Resource type and ID are required.'), { status: 400 });

    const workspace = (await databaseRows(current, token, resourceType, resourceId))?.[0] || null;
    const legacy = await legacyRows(current, token, resourceType, resourceId);
    const selected = newestRecord([workspace, ...legacy]);
    if (migrate && selected && selected._store === 'legacy-legal-notes') {
      const migrated = await upsert(current, token, resourceType, resourceId, selected, workspace, selected.is_published ? 'publish' : 'save');
      return { token, current, workspace: migrated, source: 'migrated-from-legal_notes' };
    }
    return { token, current, workspace, source: workspace ? 'workspace_notes' : 'empty' };
  }

  router.get('/api/workspaces/status', route(async (req, res) => {
    const { token, current } = await storage.requestUser(req, { required: false });
    let databaseReady = false;
    let error = null;
    if (current) {
      try {
        await databaseRequest('workspace_notes', '?select=id&limit=1', { userToken: token });
        databaseReady = true;
      } catch (failure) {
        error = failure.message;
      }
    }
    res.set('Cache-Control', 'no-store');
    res.json({
      ok: databaseReady,
      signedIn: Boolean(current),
      storage: 'workspace_notes',
      supabaseConfigured: Boolean(base && publishable),
      serviceKeyConfigured: Boolean(secret),
      databaseReady,
      error
    });
  }));

  router.get('/api/workspaces/:resourceType/:resourceId', route(async (req, res) => {
    const result = await load(req);
    res.set('Cache-Control', 'no-store');
    res.json({ workspace: result.workspace, storage: result.source });
  }));

  router.put('/api/workspaces/:resourceType/:resourceId', route(async (req, res) => {
    const loaded = await load(req);
    const resourceType = text(req.params.resourceType, 80);
    const resourceId = text(req.params.resourceId, 300);
    const saved = await upsert(
      loaded.current,
      loaded.token,
      resourceType,
      resourceId,
      req.body || {},
      loaded.workspace,
      req.body?.intent === 'publish' ? 'publish' : 'save'
    );
    res.set('Cache-Control', 'no-store');
    res.json({ workspace: saved, storage: 'workspace_notes', migratedFrom: loaded.source });
  }));

  return router;
}

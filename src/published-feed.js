import express from 'express';
import { supabaseSecretKey, supabaseServiceHeaders } from './supabase-server-key.js';
import { isDiscoverable, isPublished, normalizeLegacyLegalRecord, normalizeWorkspaceRecord, recordKey } from './workspace-records.js';

const safeSummary = (row) => ({
  id: row.id || null,
  share_token: row.share_token || null,
  title: String(row.title || 'Untitled analysis'),
  resource_title: String(row.resource_title || 'Analysis'),
  resource_type: String(row.resource_type || 'analysis'),
  resource_id: String(row.resource_id || ''),
  published_at: row.published_at || row.updated_at || row.created_at || null,
  updated_at: row.updated_at || row.published_at || row.created_at || null,
  author_username: String(row.author_username || 'Atlas Author'),
  author_avatar_seed: String(row.author_avatar_seed || ''),
  author_profile_slug: String(row.author_profile_slug || ''),
  featured: row.featured !== false
});
const safeDetail = (row, isOwner = false) => ({
  ...safeSummary(row),
  body: String(row.body || ''),
  projections: Array.isArray(row.projections) ? row.projections : [],
  comments_enabled: Boolean(row.comments_enabled),
  share_ai_analysis: row.share_ai_analysis !== false,
  is_owner: Boolean(isOwner)
});

async function responseData(response) {
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  return { text, data };
}

export function createPublishedFeedRouter({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const router = express.Router();
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  const publishable = env.SUPABASE_PUBLISHABLE_KEY || '';
  const secret = supabaseSecretKey(env);

  async function currentAccount(req) {
    const bearer = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!base || !publishable || !bearer) return { account: null, bearer };
    try {
      const response = await fetchImpl(`${base}/auth/v1/user`, {
        headers: { apikey: publishable, Authorization: `Bearer ${bearer}`, Accept: 'application/json' }
      });
      if (!response.ok) return { account: null, bearer };
      const { data } = await responseData(response);
      return { account: data, bearer };
    } catch {
      return { account: null, bearer };
    }
  }

  async function accounts() {
    if (!base || !secret) return [];
    try {
      const response = await fetchImpl(`${base}/auth/v1/admin/users?per_page=1000`, {
        headers: { ...supabaseServiceHeaders(secret, { json: false }), Accept: 'application/json' }
      });
      const { data } = await responseData(response);
      return response.ok ? data?.users || [] : [];
    } catch (error) {
      console.warn('Publication profile lookup unavailable:', error.message);
      return [];
    }
  }

  function tableHeaders(bearer = '', { json = false, prefer = null } = {}) {
    const headers = secret
      ? supabaseServiceHeaders(secret, { json })
      : { apikey: publishable, ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) };
    headers.Accept = 'application/json';
    if (json) headers['Content-Type'] = 'application/json';
    if (prefer) headers.Prefer = prefer;
    return headers;
  }

  async function tableRows(table, query, bearer = '') {
    if (!base || !publishable) return [];
    try {
      const response = await fetchImpl(`${base}/rest/v1/${table}${query}`, {
        headers: tableHeaders(bearer)
      });
      const { text, data } = await responseData(response);
      if (!response.ok) {
        if (!/Could not find the table|schema cache|PGRST205|relation .* does not exist/i.test(text || '')) {
          console.warn(`${table} publication query returned ${response.status}: ${String(text).slice(0, 240)}`);
        }
        return [];
      }
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.warn(`${table} publication query unavailable:`, error.message);
      return [];
    }
  }

  async function collect(req, { token = null, profileSlug = null, includeUnfeatured = false } = {}) {
    if (!base || !publishable) return { rows: [], current: null };
    const [{ account: current, bearer }, allAccounts] = await Promise.all([currentAccount(req), accounts()]);
    if (current && !allAccounts.some((account) => account.id === current.id)) allAccounts.push(current);
    const profileByUser = new Map(allAccounts.map((account) => [account.id, account?.user_metadata?.atlas_profile || {}]));
    const workspaceQuery = token
      ? `?share_token=eq.${encodeURIComponent(token)}&is_shared=eq.true&is_published=eq.true&select=*&limit=5`
      : '?is_shared=eq.true&is_published=eq.true&select=*&order=updated_at.desc&limit=250';
    const rows = [];

    for (const original of await tableRows('workspace_notes', workspaceQuery, bearer)) {
      const profile = profileByUser.get(original.user_id) || {};
      rows.push(normalizeWorkspaceRecord({
        ...original,
        author_username: profile.username || original.author_username,
        author_avatar_seed: profile.avatar_seed || original.author_avatar_seed,
        author_profile_slug: profile.profile_slug || original.author_profile_slug,
        _store: 'workspace_notes'
      }));
    }

    // `legal_notes` is a database-only migration source for older Legal publications.
    // New saves and all migrated records live in workspace_notes.
    const legacyQuery = token && !String(token).startsWith('legacy-')
      ? `?share_token=eq.${encodeURIComponent(token)}&is_shared=eq.true&select=*&limit=5`
      : '?is_shared=eq.true&select=*&order=updated_at.desc&limit=250';
    for (const original of await tableRows('legal_notes', legacyQuery, bearer)) {
      const profile = profileByUser.get(original.user_id) || {};
      const row = normalizeLegacyLegalRecord(original);
      rows.push({
        ...row,
        author_username: profile.username || row.author_username,
        author_avatar_seed: profile.avatar_seed || row.author_avatar_seed,
        author_profile_slug: profile.profile_slug || row.author_profile_slug
      });
    }

    const filtered = rows.filter((row) =>
      (includeUnfeatured ? isPublished(row) : isDiscoverable(row))
      && (!token || row.share_token === token)
      && (!profileSlug || row.author_profile_slug === profileSlug)
    );
    const unique = new Map();
    for (const row of filtered) {
      const key = recordKey(row);
      if (!key) continue;
      const existing = unique.get(key);
      if (!existing || Date.parse(row.updated_at || 0) > Date.parse(existing.updated_at || 0)) unique.set(key, row);
    }
    return { rows: [...unique.values()], current, accounts: allAccounts };
  }

  router.get('/api/published-feed', async (req, res) => {
    const { rows } = await collect(req);
    const publications = rows
      .map(safeSummary)
      .sort((a, b) => new Date(b.published_at || b.updated_at || 0) - new Date(a.published_at || a.updated_at || 0))
      .slice(0, 250);
    res.set('Cache-Control', 'public,max-age=15,stale-while-revalidate=60');
    res.json({ publications, storage: 'workspace_notes' });
  });

  router.get('/api/published-feed/:token', async (req, res) => {
    const { rows, current } = await collect(req, { token: req.params.token, includeUnfeatured: true });
    const row = rows.find((item) => item.share_token === req.params.token);
    const isOwner = Boolean(row && current && row.user_id === current.id);
    res.set('Cache-Control', 'no-store');
    return row
      ? res.json({ publication: safeDetail(row, isOwner), storage: row._store || 'workspace_notes' })
      : res.status(404).json({ error: 'This publication was not found or is no longer shared.' });
  });

  router.patch('/api/published-feed/:token/featured', async (req, res) => {
    if (!base || !publishable) return res.status(503).json({ error: 'Publication database is unavailable.' });
    const { account, bearer } = await currentAccount(req);
    if (!account || !bearer) return res.status(401).json({ error: 'Your session expired. Sign in again.' });
    const featured = req.body?.featured !== false;
    const response = await fetchImpl(
      `${base}/rest/v1/workspace_notes?share_token=eq.${encodeURIComponent(req.params.token)}&user_id=eq.${encodeURIComponent(account.id)}`,
      {
        method: 'PATCH',
        headers: tableHeaders(bearer, { json: true, prefer: 'return=representation' }),
        body: JSON.stringify({ featured, updated_at: new Date().toISOString() })
      }
    );
    const { text, data } = await responseData(response);
    if (!response.ok) return res.status(response.status).json({ error: data?.message || text || 'Could not save publication visibility.' });
    if (!Array.isArray(data) || !data.length) return res.status(404).json({ error: 'Publication not found in your database records.' });
    return res.json({ ok: true, featured, storage: 'workspace_notes' });
  });

  router.get('/api/profiles/:slug', async (req, res) => {
    const slug = String(req.params.slug || '');
    const allAccounts = await accounts();
    const account = allAccounts.find((item) => item?.user_metadata?.atlas_profile?.profile_slug === slug);
    const profile = account?.user_metadata?.atlas_profile;
    if (!profile) return res.status(404).json({ error: 'Profile not found.' });
    const { rows } = await collect(req, { profileSlug: slug });
    const publications = rows
      .map(safeSummary)
      .sort((a, b) => new Date(b.published_at || b.updated_at || 0) - new Date(a.published_at || a.updated_at || 0));
    res.set('Cache-Control', 'public,max-age=30,stale-while-revalidate=120');
    res.json({
      profile: { username: profile.username, avatar_seed: profile.avatar_seed, profile_slug: profile.profile_slug },
      publications,
      storage: 'workspace_notes'
    });
  });

  return router;
}

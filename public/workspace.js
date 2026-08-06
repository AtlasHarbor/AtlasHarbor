import { user, ai, updateUserMetadata, config, accessToken, refreshSession } from './supabase-client.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

const safeHtml = (html) => {
  const template = document.createElement('template');
  template.innerHTML = html || '';
  for (const element of template.content.querySelectorAll('script,style,iframe,object,embed')) element.remove();
  for (const element of template.content.querySelectorAll('*')) {
    for (const attribute of [...element.attributes]) {
      if (/^on/i.test(attribute.name) || attribute.name === 'srcdoc') element.removeAttribute(attribute.name);
    }
  }
  return template.innerHTML;
};

const cleanScenarios = (value) => (Array.isArray(value) ? value : [])
  .map((item) => ({
    label: String(item?.label || '').trim(),
    date: String(item?.date || '').trim(),
    probability: item?.probability == null ? '' : String(item.probability)
  }))
  .filter((item) => item.label || item.date || item.probability !== '')
  .slice(0, 20);

const time = (value) => {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
};

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

async function databaseRest(table, { method = 'GET', query = '', body } = {}) {
  const settings = await config();
  let token = accessToken();
  if (!token) throw new Error('Sign in required.');
  const request = () => fetch(`${settings.supabaseUrl}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: settings.supabasePublishableKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: method === 'POST'
        ? 'return=representation,resolution=merge-duplicates'
        : 'return=representation'
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let response = await request();
  if (response.status === 401) {
    await refreshSession();
    token = accessToken();
    response = await request();
  }
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) {
    const error = new Error(data?.message || data?.error_description || data?.error || text || `Database request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function normalizeLegacy(row, current, resource) {
  if (!row) return null;
  let payload = {};
  const raw = String(row.body || '');
  try {
    payload = JSON.parse(raw.replace(/^ATLAS_WORKSPACE_V1\n/, ''));
  } catch {
    payload = { body: raw };
  }
  return {
    ...payload,
    id: payload.id || row.id || null,
    user_id: current.id,
    resource_type: resource.type,
    resource_id: String(resource.id),
    resource_title: payload.resource_title || resource.title,
    title: payload.title || row.title || `${resource.title} analysis`,
    body: payload.body ?? raw,
    projections: cleanScenarios(payload.projections),
    is_shared: Boolean(payload.is_shared ?? row.is_shared),
    is_published: Boolean(payload.is_published || row.is_published || row.share_token),
    share_token: payload.share_token || row.share_token || null,
    updated_at: payload.updated_at || row.updated_at || null,
    _source: 'legacy-legal-notes'
  };
}

function accountCandidates(resource, current) {
  const metadata = current.user_metadata || {};
  const spaces = metadata.atlas_problem_spaces || {};
  const publishing = spaces.publishing_workspace || {};
  const virtual = metadata.atlas_virtual_tables || {};
  const rows = [];
  const same = (row) => String(row?.user_id || current.id) === String(current.id)
    && String(row?.resource_type || '') === String(resource.type)
    && String(row?.resource_id || '') === String(resource.id);

  for (const row of publishing.notes || []) if (same(row)) rows.push({ ...row, _source: 'temporary-account-metadata' });
  for (const row of virtual.workspace_notes || []) if (same(row)) rows.push({ ...row, _source: 'legacy-virtual-metadata' });
  if (resource.type === 'legal_case') {
    for (const row of virtual.legal_notes || []) {
      const normalized = normalizeLegacy(row, current, resource);
      if (normalized && same(normalized)) rows.push({ ...normalized, _source: 'legacy-virtual-legal-notes' });
    }
  }
  return rows;
}

function databasePayload(record, resource, current, { publish = false } = {}) {
  const published = publish || record?.is_published === true;
  const payload = {
    user_id: current.id,
    resource_type: resource.type,
    resource_id: String(resource.id),
    resource_title: String(record?.resource_title || resource.title),
    title: String(record?.title || `${resource.title} analysis`).trim().slice(0, 300),
    body: safeHtml(record?.body || ''),
    ai_prompt: String(record?.ai_prompt || '').slice(0, 12000),
    projections: cleanScenarios(record?.projections),
    placement: ['top', 'bottom'].includes(record?.placement) ? record.placement : 'bottom',
    is_published: published,
    is_shared: record?.is_shared === true,
    share_scope: record?.share_scope === 'everything' ? 'everything' : 'page',
    share_ai_analysis: record?.share_ai_analysis !== false,
    updated_at: new Date().toISOString()
  };
  if (isUuid(record?.id)) payload.id = record.id;
  if (isUuid(record?.share_token)) payload.share_token = record.share_token;
  return payload;
}

async function upsertDatabaseRecord(record, resource, current, options = {}) {
  const payload = databasePayload(record, resource, current, options);
  const rows = await databaseRest('workspace_notes', {
    method: 'POST',
    query: '?on_conflict=user_id,resource_type,resource_id',
    body: payload
  });
  const saved = rows?.[0];
  if (!saved) throw new Error('The database did not return the saved workspace record.');
  return saved;
}

async function clearTemporaryCopies(resource, current) {
  const metadata = current.user_metadata || {};
  const spaces = { ...(metadata.atlas_problem_spaces || {}) };
  const publishing = { ...(spaces.publishing_workspace || {}) };
  const virtual = { ...(metadata.atlas_virtual_tables || {}) };
  const same = (row) => String(row?.user_id || current.id) === String(current.id)
    && String(row?.resource_type || '') === String(resource.type)
    && String(row?.resource_id || '') === String(resource.id);

  let changed = false;
  if (Array.isArray(publishing.notes)) {
    const next = publishing.notes.filter((row) => !same(row));
    changed ||= next.length !== publishing.notes.length;
    publishing.notes = next;
    spaces.publishing_workspace = publishing;
  }
  if (Array.isArray(virtual.workspace_notes)) {
    const next = virtual.workspace_notes.filter((row) => !same(row));
    changed ||= next.length !== virtual.workspace_notes.length;
    virtual.workspace_notes = next;
  }
  if (resource.type === 'legal_case' && Array.isArray(virtual.legal_notes)) {
    const next = virtual.legal_notes.filter((row) => String(row?.case_slug || '') !== String(resource.id));
    changed ||= next.length !== virtual.legal_notes.length;
    virtual.legal_notes = next;
  }
  if (changed) await updateUserMetadata({ atlas_problem_spaces: spaces, atlas_virtual_tables: virtual });
}

async function loadDatabaseRecord(resource, current) {
  let workspaceRows;
  try {
    workspaceRows = await databaseRest('workspace_notes', {
      query: `?user_id=eq.${encodeURIComponent(current.id)}&resource_type=eq.${encodeURIComponent(resource.type)}&resource_id=eq.${encodeURIComponent(resource.id)}&select=*&limit=1`
    });
  } catch (error) {
    throw new Error(`Private workspace database unavailable: ${error.message}`);
  }

  const candidates = [];
  if (workspaceRows?.[0]) candidates.push({ ...workspaceRows[0], _source: 'workspace_notes' });
  candidates.push(...accountCandidates(resource, current));

  if (resource.type === 'legal_case') {
    try {
      const legacyRows = await databaseRest('legal_notes', {
        query: `?user_id=eq.${encodeURIComponent(current.id)}&case_slug=eq.${encodeURIComponent(resource.id)}&select=*&order=updated_at.desc&limit=1`
      });
      const legacy = normalizeLegacy(legacyRows?.[0], current, resource);
      if (legacy) candidates.push(legacy);
    } catch {
      // legal_notes is an optional migration source. workspace_notes remains required.
    }
  }

  const selected = candidates.sort((a, b) => time(b.updated_at || b.published_at) - time(a.updated_at || a.published_at))[0] || null;
  const database = candidates.find((row) => row._source === 'workspace_notes') || null;
  if (selected && selected._source !== 'workspace_notes' && time(selected.updated_at) >= time(database?.updated_at)) {
    const migrated = await upsertDatabaseRecord(selected, resource, current, { publish: selected.is_published === true });
    await clearTemporaryCopies(resource, current).catch(() => {});
    return migrated;
  }
  return database;
}

function renderDatabaseError(host, resource, message) {
  host.innerHTML = `<section class="workspace workspace-error-panel">
    <p class="eyebrow">PRIVATE DATABASE WORKSPACE</p>
    <h2>Analysis could not load</h2>
    <p>${esc(message)}</p>
    <p>No device-only draft was created. Your analysis remains in the account database or its legacy Legal record.</p>
    <button id="ws-retry" type="button">Retry database connection</button>
  </section>`;
  host.querySelector('#ws-retry')?.addEventListener('click', () => mountWorkspace(host, resource));
}

export async function mountWorkspace(host, resource) {
  if (!host) return;
  const current = user();
  if (!current) {
    host.innerHTML = `<section class="workspace"><h2>Publish your analysis</h2><p>Sign in to write, save, run AI, publish, and share this page.</p><p><a href="/account">Sign in or create an account</a></p></section>`;
    return;
  }

  let row;
  try {
    row = await loadDatabaseRecord(resource, current);
  } catch (error) {
    renderDatabaseError(host, resource, error.message);
    return;
  }

  const projections = cleanScenarios(row?.projections);
  host.innerHTML = `<section class="workspace">
    <p class="eyebrow">YOUR PRIVATE PUBLISHING WORKSPACE</p>
    <h2>Analysis and projections</h2>
    <p class="workspace-status">Saved in your account database. Publishing creates a separate shareable article and never changes the underlying page.</p>
    <div class="workspace-grid"><label>Headline<input id="ws-title" value="${esc(row?.title || `${resource.title} analysis`)}"></label></div>
    <div class="workspace-toolbar"><button data-cmd="bold"><b>B</b></button><button data-cmd="italic"><i>I</i></button><button data-cmd="formatBlock" data-value="h2">H2</button><button data-cmd="formatBlock" data-value="h3">H3</button><button data-cmd="insertUnorderedList">List</button><button data-cmd="createLink">Link</button><button data-cmd="unlink">Unlink</button><button data-cmd="undo">Undo</button><button data-cmd="redo">Redo</button></div>
    <div id="ws-editor" class="workspace-editor" contenteditable="true">${safeHtml(row?.body || '<p>Write what you think will happen, why, and what evidence would change your view.</p>')}</div>
    <div class="projection-help"><h3>Projection scenarios <span>(optional)</span></h3><p>Record a possible outcome, its estimated probability, and an optional expected date.</p></div>
    <div id="ws-projections" class="projection-list"></div><button id="ws-add-projection" class="secondary">Add a projection scenario</button>
    <label>Instructions for AI<textarea id="ws-prompt" rows="4" placeholder="Evaluate the likely outcome, strongest counterargument, key dates, and what evidence would change the view.">${esc(row?.ai_prompt || '')}</textarea></label>
    <div class="workspace-actions"><button id="ws-ai">Generate AI draft</button><button id="ws-save">Save draft</button><button id="ws-publish">Publish</button>${row?.is_published && row?.share_token ? `<button id="ws-share" class="secondary">Copy share link</button><a class="workspace-primary" href="/published/${encodeURIComponent(row.share_token)}">View article</a>` : ''}</div>
    <label><input id="ws-shared" type="checkbox" ${row?.is_shared ? 'checked' : ''}> Allow anyone with the link to view this publication</label>
    <label><input id="ws-include-ai" type="checkbox" ${row?.share_ai_analysis !== false ? 'checked' : ''}> Include AI-generated text when shared</label>
    <p id="ws-status" class="workspace-status"></p>
  </section>`;

  const list = host.querySelector('#ws-projections');
  function draw() {
    list.innerHTML = projections.length ? projections.map((projection, index) => `<div class="projection-row">
      <label>Possible outcome<input data-p-label="${index}" value="${esc(projection.label)}"></label>
      <label>Expected date<input data-p-date="${index}" type="date" value="${esc(projection.date)}"></label>
      <label>Estimated chance<div class="probability-input"><input data-p-prob="${index}" type="number" min="0" max="100" value="${esc(projection.probability)}"><span>%</span></div></label>
      <button type="button" class="projection-remove" data-p-remove="${index}">Remove</button>
    </div>`).join('') : '<p class="workspace-status">No projection scenarios added.</p>';
    list.querySelectorAll('[data-p-remove]').forEach((button) => {
      button.onclick = () => {
        projections.splice(Number(button.dataset.pRemove), 1);
        draw();
      };
    });
  }
  draw();

  host.querySelectorAll('[data-cmd]').forEach((button) => button.addEventListener('click', () => {
    const command = button.dataset.cmd;
    if (command === 'createLink') {
      const url = prompt('URL');
      if (url) document.execCommand(command, false, url);
    } else document.execCommand(command, false, button.dataset.value || null);
  }));
  host.querySelector('#ws-add-projection').onclick = () => {
    captureScenarios();
    projections.push({ label: '', date: '', probability: '' });
    draw();
  };

  function captureScenarios() {
    for (let index = 0; index < projections.length; index += 1) {
      projections[index] = {
        label: list.querySelector(`[data-p-label="${index}"]`)?.value.trim() || '',
        date: list.querySelector(`[data-p-date="${index}"]`)?.value || '',
        probability: list.querySelector(`[data-p-prob="${index}"]`)?.value || ''
      };
    }
    return cleanScenarios(projections);
  }

  function collect() {
    return {
      ...row,
      resource_title: resource.title,
      title: host.querySelector('#ws-title').value.trim() || `${resource.title} analysis`,
      body: safeHtml(host.querySelector('#ws-editor').innerHTML),
      ai_prompt: host.querySelector('#ws-prompt').value,
      projections: captureScenarios(),
      placement: row?.placement || 'bottom',
      is_shared: host.querySelector('#ws-shared').checked,
      share_scope: 'page',
      share_ai_analysis: host.querySelector('#ws-include-ai').checked
    };
  }

  async function save(publish = false) {
    const status = host.querySelector('#ws-status');
    if (publish && !host.querySelector('#ws-shared').checked) {
      status.textContent = 'Enable “Allow anyone with the link” before publishing.';
      return;
    }
    status.textContent = publish ? 'Publishing to the database…' : 'Saving to the database…';
    try {
      row = await upsertDatabaseRecord(collect(), resource, current, { publish });
      if (publish && row.share_token) {
        status.innerHTML = `Published. <a href="/published/${encodeURIComponent(row.share_token)}">View article</a>`;
      } else status.textContent = 'Draft saved to your account database.';
      window.dispatchEvent(new Event('atlas-publication-updated'));
    } catch (error) {
      status.textContent = `Database save failed: ${error.message}`;
    }
  }

  host.querySelector('#ws-save').onclick = () => save(false);
  host.querySelector('#ws-publish').onclick = () => save(true);
  host.querySelector('#ws-ai').onclick = async () => {
    const status = host.querySelector('#ws-status');
    const promptText = host.querySelector('#ws-prompt').value.trim();
    if (!promptText) {
      status.textContent = 'Enter instructions for the AI first.';
      return;
    }
    status.textContent = 'Running your selected model…';
    try {
      const result = await ai([
        { role: 'system', content: 'Create a clearly labeled analytical draft. Separate sourced page facts from inference, identify uncertainty, and do not fabricate citations.' },
        { role: 'user', content: `Page context:\n${JSON.stringify(resource.context)}\n\nUser instructions:\n${promptText}\n\nExisting draft:\n${host.querySelector('#ws-editor').innerText}` }
      ], { surface: resource.type, resourceId: String(resource.id) });
      host.querySelector('#ws-editor').insertAdjacentHTML('beforeend', `<h2>AI-assisted draft</h2><p>${esc(result.content).replace(/\n/g, '<br>')}</p>`);
      status.textContent = `Draft added using ${result.model || 'your selected model'}. Review and save it to the database.`;
    } catch (error) {
      status.textContent = `AI unavailable: ${error.message}. Check Account for your API key, endpoint, and model.`;
    }
  };
  host.querySelector('#ws-share')?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(`${location.origin}/published/${row.share_token}`);
    host.querySelector('#ws-status').textContent = 'Share link copied.';
  });
}

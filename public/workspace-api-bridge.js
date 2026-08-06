const nativeFetch = window.fetch.bind(window);

function headerValue(headers, name) {
  if (!headers) return '';
  if (headers instanceof Headers) return headers.get(name) || '';
  if (Array.isArray(headers)) {
    const pair = headers.find(([key]) => String(key).toLowerCase() === name.toLowerCase());
    return pair?.[1] || '';
  }
  const key = Object.keys(headers).find((item) => item.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : '';
}

function eq(params, name) {
  const value = params.get(name) || '';
  return value.startsWith('eq.') ? decodeURIComponent(value.slice(3)) : '';
}

async function jsonResponse(response, mapper) {
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  const body = response.ok ? JSON.stringify(mapper(data)) : (text || JSON.stringify(data || {}));
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: { 'Content-Type': 'application/json' }
  });
}

window.fetch = async function atlasWorkspaceFetch(input, init = {}) {
  const request = input instanceof Request ? input : null;
  const rawUrl = request?.url || String(input || '');
  const url = new URL(rawUrl, location.href);
  const match = url.pathname.match(/\/rest\/v1\/(workspace_notes|legal_notes)$/);
  if (!match || url.origin === location.origin) return nativeFetch(input, init);

  const headers = init.headers || request?.headers;
  const authorization = headerValue(headers, 'authorization');
  if (!authorization) return nativeFetch(input, init);

  const method = String(init.method || request?.method || 'GET').toUpperCase();
  const table = match[1];

  if (table === 'workspace_notes' && method === 'GET') {
    const resourceType = eq(url.searchParams, 'resource_type');
    const resourceId = eq(url.searchParams, 'resource_id');
    if (!resourceType || !resourceId) return nativeFetch(input, init);
    const response = await nativeFetch(`/api/workspaces/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}`, {
      headers: { Accept: 'application/json', Authorization: authorization },
      cache: 'no-store'
    });
    return jsonResponse(response, (data) => data?.workspace ? [data.workspace] : []);
  }

  if (table === 'workspace_notes' && method === 'POST') {
    let rawBody = init.body;
    if (rawBody == null && request) rawBody = await request.clone().text();
    let payload = {};
    try { payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : (rawBody || {}); } catch {}
    const resourceType = String(payload.resource_type || '');
    const resourceId = String(payload.resource_id || '');
    if (!resourceType || !resourceId) return nativeFetch(input, init);
    const response = await nativeFetch(`/api/workspaces/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}`, {
      method: 'PUT',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: authorization },
      body: JSON.stringify({ ...payload, intent: payload.is_published ? 'publish' : 'save' })
    });
    return jsonResponse(response, (data) => data?.workspace ? [data.workspace] : []);
  }

  if (table === 'legal_notes' && method === 'GET' && eq(url.searchParams, 'case_slug')) {
    // The workspace API already checks and migrates legacy Legal records while
    // loading workspace_notes, so the browser-side optional legacy query is done.
    return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  return nativeFetch(input, init);
};

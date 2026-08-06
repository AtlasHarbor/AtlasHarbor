import { accessToken, refreshSession, user } from './supabase-client.js';

const installed = new WeakSet();
const style = document.createElement('style');
style.textContent = `.workspace-attachment-control{margin:16px 0;padding:14px;border:1px solid #cdd8c9;border-radius:12px;background:#f2f6ef}.workspace-attachment-control label{display:flex;align-items:flex-start;gap:9px;font-weight:800}.workspace-attachment-control input{width:auto;margin-top:3px}.workspace-attachment-control small{display:block;margin:6px 0 0 25px;color:#667970;line-height:1.45}`;
document.head.append(style);

async function authenticated(url, options = {}) {
  let token = accessToken();
  if (!token) throw new Error('Sign in required.');
  const request = () => fetch(url, {
    ...options,
    headers: { Accept: 'application/json', ...(options.headers || {}), Authorization: `Bearer ${token}` }
  });
  let response = await request();
  if (response.status === 401) {
    await refreshSession();
    token = accessToken();
    response = await request();
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Workspace setting failed (${response.status}).`);
  return data;
}

function waitForWorkspace(host, timeoutMs = 20_000) {
  return new Promise((resolve) => {
    const existing = host?.querySelector?.('.workspace');
    if (existing) return resolve(existing);
    const observer = new MutationObserver(() => {
      const section = host?.querySelector?.('.workspace');
      if (!section) return;
      observer.disconnect();
      resolve(section);
    });
    if (host) observer.observe(host, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); resolve(null); }, timeoutMs);
  });
}

export async function installWorkspaceScopeToggle({ host, resourceType, resourceId, label }) {
  if (!host || !resourceType || !resourceId || !user()) return;
  const section = await waitForWorkspace(host);
  if (!section || installed.has(section)) return;
  installed.add(section);

  const controls = document.createElement('div');
  controls.className = 'workspace-attachment-control';
  controls.innerHTML = `<label><input type="checkbox"> ${label || 'Attach the full underlying analysis beneath the published article'}</label><small>Off by default. When enabled, the shared article includes the underlying research instead of only linking to it.</small>`;
  const status = section.querySelector('#ws-status');
  section.insertBefore(controls, status || null);
  const checkbox = controls.querySelector('input');

  try {
    const data = await authenticated(`/api/workspaces/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}`);
    checkbox.checked = data.workspace?.share_scope === 'everything';
  } catch {
    checkbox.checked = false;
  }

  let pendingIntent = null;
  section.querySelector('#ws-save')?.addEventListener('click', () => { pendingIntent = 'save'; });
  section.querySelector('#ws-publish')?.addEventListener('click', () => { pendingIntent = 'publish'; });

  const persistScope = async () => {
    if (!pendingIntent) return;
    const intent = pendingIntent;
    pendingIntent = null;
    const message = section.querySelector('#ws-status');
    try {
      await authenticated(`/api/workspaces/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent, share_scope: checkbox.checked ? 'everything' : 'page' })
      });
      if (message) message.textContent = checkbox.checked
        ? 'Saved. The shared article will include the full underlying analysis.'
        : 'Saved. The shared article will link to the underlying analysis.';
    } catch (error) {
      if (message) message.textContent = `Article attachment setting failed: ${error.message}`;
    }
  };
  window.addEventListener('atlas-publication-updated', persistScope);
}

if (location.pathname.startsWith('/legal/')) {
  const slug = decodeURIComponent(location.pathname.replace(/^\/legal\/?/, '').split('/')[0] || '');
  if (slug) {
    const scan = () => {
      for (const host of document.querySelectorAll('#legal-workspace, #legal-workspace-top')) {
        installWorkspaceScopeToggle({
          host,
          resourceType: 'legal_case',
          resourceId: slug,
          label: 'Attach the full Legal case analysis beneath the published article'
        });
      }
    };
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
}

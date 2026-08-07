import { user } from './supabase-client.js';

const installed = new WeakSet();
const style = document.createElement('style');
style.textContent = `.workspace-attachment-control{margin:16px 0;padding:14px;border:1px solid #cdd8c9;border-radius:12px;background:#f2f6ef}.workspace-attachment-control label{display:flex;align-items:flex-start;gap:9px;font-weight:800}.workspace-attachment-control input{width:auto;margin-top:3px}.workspace-attachment-control small{display:block;margin:6px 0 0 25px;color:#667970;line-height:1.45}`;
document.head.append(style);

function waitForWorkspace(host, timeoutMs = 20_000) {
  return new Promise((resolve) => {
    const existing = host?.querySelector?.('.workspace[data-resource-type]:not(.workspace-db-error)');
    if (existing) return resolve(existing);
    const observer = new MutationObserver(() => {
      const section = host?.querySelector?.('.workspace[data-resource-type]:not(.workspace-db-error)');
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
  controls.innerHTML = `<label><input type="checkbox"> ${label || 'Attach the full underlying analysis beneath the published article'}</label><small>Off by default. This setting is saved with the same database workspace when you Save draft or Publish.</small>`;
  const status = section.querySelector('#ws-status');
  section.insertBefore(controls, status || null);
  const checkbox = controls.querySelector('input');
  checkbox.checked = section.dataset.shareScope === 'everything';
  checkbox.addEventListener('change', () => {
    section.dataset.shareScope = checkbox.checked ? 'everything' : 'page';
    if (status) status.textContent = checkbox.checked
      ? 'Full underlying research will be attached the next time you save or publish.'
      : 'The publication will link to the underlying page the next time you save or publish.';
  });
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

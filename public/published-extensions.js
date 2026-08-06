import { accessToken, publicRest } from './supabase-client.js';
import { renderGtmReport } from './go-to-market-render.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const list = (items) => `<ul>${(items || []).filter(Boolean).map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`;

function ensureStyles({ gtm = false } = {}) {
  if (gtm && !document.querySelector('link[href="/go-to-market.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/go-to-market.css';
    document.head.append(link);
  }
  if (!document.querySelector('#published-extension-styles')) {
    const style = document.createElement('style');
    style.id = 'published-extension-styles';
    style.textContent = `.attached-research{margin-top:32px;padding-top:28px;border-top:3px solid #173b32}.attached-research>header{display:block;min-height:0;padding:0 0 18px;background:transparent;border:0}.attached-research>header h2{font-size:34px;margin:6px 0}.attached-research>header p{color:#667970;line-height:1.6}.attached-legal{display:grid;gap:18px}.attached-legal section{padding:20px;border:1px solid #ddd7ca;border-radius:14px;background:#fffdf7}.attached-legal h3{margin-top:0}.attached-legal p,.attached-legal li{line-height:1.6}.attached-legal-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px}.attached-legal-source{display:block;padding:12px;border:1px solid #ddd7ca;border-radius:10px;color:#173b32;text-decoration:none}.attached-legal-source small{display:block;color:#667970;margin-top:5px}@media(max-width:760px){.attached-research>header h2{font-size:28px}}`;
    document.head.append(style);
  }
}

async function json(url) {
  const headers = { Accept: 'application/json' };
  if (accessToken()) headers.Authorization = `Bearer ${accessToken()}`;
  const response = await fetch(url, { headers, cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

function waitFor(selector, timeoutMs = 20_000) {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);
    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (!found) return;
      observer.disconnect();
      resolve(found);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); resolve(null); }, timeoutMs);
  });
}

function legalAnalysis(item) {
  const positions = Object.entries(item.positions || {});
  const board = item.decisionBoard || {};
  const timeline = item.timeline || [];
  const docket = item.docketEntries || [];
  return `<div class="attached-legal">
    <section><p class="eyebrow">CASE ORIENTATION</p><h3>${esc(item.title)}</h3><p>${esc(item.summary || item.analysis?.importance || item.coreQuestion)}</p><p><b>Court:</b> ${esc(item.court)}<br><b>Case number:</b> ${esc(item.indexNumber || 'Not confirmed')}<br><b>Status:</b> ${esc(item.status)} · ${esc(item.proceduralStage || item.matterType)}</p></section>
    ${item.coreQuestion ? `<section><h3>Core legal question</h3><p>${esc(item.coreQuestion)}</p></section>` : ''}
    ${(board.currentPosition || board.stage) ? `<section><h3>Decision board</h3><p><b>${esc(board.stage)}</b></p><p>${esc(board.currentPosition)}</p><div class="attached-legal-grid"><div><h4>Action queue</h4>${list(board.actionQueue)}</div><div><h4>Open questions</h4>${list(board.openQuestions)}</div></div></section>` : ''}
    ${positions.length ? `<section><h3>Positions</h3><div class="attached-legal-grid">${positions.map(([name, items]) => `<div><h4>${esc(name.replace(/([A-Z])/g, ' $1'))}</h4>${list(items)}</div>`).join('')}</div></section>` : ''}
    ${timeline.length ? `<section><h3>Procedural timeline</h3>${timeline.map((entry) => `<p><b>${esc(entry.date)}</b><br>${esc(entry.event)}</p>`).join('')}</section>` : ''}
    ${(item.nextWatchItems || item.analysis?.uncertainties) ? `<section><div class="attached-legal-grid"><div><h3>Next watch items</h3>${list(item.nextWatchItems)}</div><div><h3>Uncertainties</h3>${list(item.analysis?.uncertainties)}</div></div></section>` : ''}
    ${docket.length ? `<section><h3>Recent docket entries</h3>${docket.slice(-12).reverse().map((entry) => `<p><b>${esc(entry.dateFiled || entry.date || entry.entryNumber || 'Docket entry')}</b><br>${esc(entry.description || entry.shortDescription || entry.text)}</p>`).join('')}</section>` : ''}
    ${(item.sources || []).length ? `<section><h3>Primary and discovery sources</h3><div class="attached-legal-grid">${item.sources.map((source) => /^https?:\/\//i.test(source.url || '') ? `<a class="attached-legal-source" href="${esc(source.url)}" target="_blank" rel="noreferrer"><b>${esc(source.title)}</b><small>${esc(source.supports || source.type)}</small></a>` : '').join('')}</div></section>` : ''}
  </div>`;
}

function updatePublicationLinks(article, row) {
  if (row.resource_type !== 'go_to_market_report') return;
  const href = `/go-to-market/${encodeURIComponent(row.resource_id)}`;
  const eyebrow = article.querySelector(':scope > .eyebrow');
  if (eyebrow) eyebrow.textContent = eyebrow.textContent.replace(/^Analysis/i, 'Go-to-market');
  const resourceLink = article.querySelector('.resource-title a');
  if (resourceLink) resourceLink.href = href;
  for (const link of article.querySelectorAll('.publication-actions a')) {
    if (/underlying page/i.test(link.textContent)) link.href = href;
  }
}

async function detail(token) {
  const serverRow = (await json(`/api/published-feed/${encodeURIComponent(token)}`)).publication;
  if (!serverRow) return;
  const directRows = await publicRest('workspace_notes', `?share_token=eq.${encodeURIComponent(token)}&is_shared=eq.true&is_published=eq.true&select=share_scope,resource_type,resource_id&limit=1`).catch(() => []);
  const row = { ...serverRow, ...(directRows?.[0] || {}) };
  const article = await waitFor('.publication');
  if (!article) return;
  updatePublicationLinks(article, row);
  if (row.share_scope !== 'everything' || article.querySelector('.attached-research')) return;

  ensureStyles({ gtm: row.resource_type === 'go_to_market_report' });
  const attached = document.createElement('section');
  attached.className = 'attached-research';
  if (row.resource_type === 'go_to_market_report') {
    const report = (await json(`/api/go-to-market/reports/${encodeURIComponent(row.resource_id)}`)).report;
    attached.innerHTML = `<header><p class="eyebrow">ATTACHED UNDERLYING RESEARCH</p><h2>Full go-to-market analysis</h2><p>This research was attached by the author. It remains separate from the author’s article above.</p></header>${renderGtmReport(report, { embedded: true })}`;
  } else if (row.resource_type === 'legal_case') {
    const item = await json(`/api/legal/cases/${encodeURIComponent(row.resource_id)}`);
    attached.innerHTML = `<header><p class="eyebrow">ATTACHED UNDERLYING ANALYSIS</p><h2>Full Legal case analysis</h2><p>This case record and decision board were attached by the author. Verify consequential details against the operative docket and filings.</p></header>${legalAnalysis(item)}`;
  } else return;
  const author = article.querySelector('.publication-author');
  article.insertBefore(attached, author || article.querySelector('.publication-visibility') || article.querySelector('.publication-actions'));
}

async function feed() {
  const data = await json('/api/published-feed').catch(() => ({ publications: [] }));
  const byToken = new Map((data.publications || []).map((row) => [String(row.share_token), row]));
  const host = await waitFor('.publication-feed');
  if (!host) return;
  for (const card of host.querySelectorAll('.publication-card')) {
    const token = decodeURIComponent(card.getAttribute('href')?.replace(/^\/published\//, '') || '');
    const row = byToken.get(token);
    if (row?.resource_type !== 'go_to_market_report') continue;
    card.querySelector(':scope > span')?.replaceChildren('Go-to-market');
  }
}

const token = decodeURIComponent(location.pathname.replace(/^\/published\/?/, '').split('/')[0] || '');
(token ? detail(token) : feed()).catch((error) => console.warn('Publication extension:', error.message));

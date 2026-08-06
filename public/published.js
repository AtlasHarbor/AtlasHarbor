import { config, publicRest, rest, user, ai, accessToken } from './supabase-client.js';
import { avatarDataUrl } from './profile-utils.js';

const root = document.querySelector('#published-root');
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
const typeLabel = (type) => ({
  legal_case: 'Legal', baseball_game: 'Baseball game', baseball_player: 'Baseball player',
  baseball_team: 'Baseball team', logistics_game: 'Logistics', food_decision: 'Food decision',
  dropshipping_strategy: 'Dropshipping', economics_problem: 'Economics'
})[type] || 'Analysis';
const timeValue = (value) => {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
};

function ago(value) {
  if (!value) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days} day${days === 1 ? '' : 's'} ago` : new Date(value).toLocaleDateString();
}

function underlying(row) {
  const id = encodeURIComponent(row.resource_id || '');
  if (row.resource_type === 'legal_case') return `/legal/${id}`;
  if (row.resource_type === 'baseball_game') return `/baseball/games/${id}`;
  if (row.resource_type === 'baseball_player') return `/baseball/players/${id}`;
  if (row.resource_type === 'baseball_team') return `/baseball/teams/${id}`;
  if (row.resource_type === 'food_decision') return '/food';
  if (row.resource_type === 'dropshipping_strategy') return '/dropshipping';
  if (row.resource_type === 'economics_problem') return '/economics';
  return '/game';
}

async function databaseRows(query) {
  const settings = await config();
  const response = await fetch(`${settings.supabaseUrl}/rest/v1/workspace_notes${query}`, {
    headers: { apikey: settings.supabasePublishableKey, Accept: 'application/json' },
    cache: 'no-store'
  });
  const text = await response.text();
  let data = [];
  try { data = text ? JSON.parse(text) : []; } catch {}
  if (!response.ok) throw new Error(data?.message || text || `Publication database returned ${response.status}.`);
  return Array.isArray(data) ? data : [];
}

function mergeRows(...groups) {
  const rows = new Map();
  for (const row of groups.flat()) {
    const key = row?.share_token || row?.id;
    if (!key) continue;
    const existing = rows.get(key);
    if (!existing || timeValue(row.updated_at || row.published_at) > timeValue(existing.updated_at || existing.published_at)) {
      rows.set(key, row);
    }
  }
  return [...rows.values()].sort((a, b) => timeValue(b.published_at || b.updated_at) - timeValue(a.published_at || a.updated_at));
}

async function serverFeed() {
  const headers = { Accept: 'application/json' };
  if (accessToken()) headers.Authorization = `Bearer ${accessToken()}`;
  const response = await fetch('/api/published-feed', { headers, cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Published feed failed (${response.status}).`);
  return data.publications || [];
}

async function databaseFeed() {
  const rows = await databaseRows('?is_shared=eq.true&is_published=eq.true&select=*&order=updated_at.desc&limit=100');
  return rows.filter((row) => row.featured !== false && row.share_token);
}

async function serverDetail(token) {
  const headers = { Accept: 'application/json' };
  if (accessToken()) headers.Authorization = `Bearer ${accessToken()}`;
  const response = await fetch(`/api/published-feed/${encodeURIComponent(token)}`, { headers, cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return null;
  return data.publication || null;
}

async function databaseDetail(token) {
  const rows = await databaseRows(`?share_token=eq.${encodeURIComponent(token)}&is_shared=eq.true&is_published=eq.true&select=*&limit=1`);
  const row = rows[0] || null;
  return row ? { ...row, is_owner: Boolean(user() && row.user_id === user().id) } : null;
}

function setMeta(row) {
  const description = String(row.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)
    || `${row.title} by ${row.author_username || 'an Atlas Harbor author'}`;
  document.title = `${row.title} · ${row.author_username || 'Atlas Harbor'} · Atlas Harbor`;
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.append(meta); }
  meta.content = description;
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); }
  canonical.href = location.href;
}

async function publicationComments(row) {
  if (!row.comments_enabled || !row.id) return [];
  try {
    return await publicRest('publication_comments', `?workspace_note_id=eq.${row.id}&select=*&order=created_at.asc`) || [];
  } catch {
    return [];
  }
}

function authorBlock(row) {
  if (!row.author_profile_slug) return '';
  return `<footer class="publication-author"><img src="${avatarDataUrl(row.author_avatar_seed, 72)}" alt="Generated icon for ${esc(row.author_username)}"><div><small>Published by</small><a href="/users/${encodeURIComponent(row.author_profile_slug)}">${esc(row.author_username)}</a></div></footer>`;
}

async function detail(token) {
  document.body.classList.add('focused-publication-view');
  const row = (await serverDetail(token).catch(() => null)) || await databaseDetail(token).catch(() => null);
  if (!row) throw new Error('This publication was not found or is no longer shared.');
  setMeta(row);
  const scenarios = Array.isArray(row.projections) ? row.projections.filter((item) => item?.label || item?.date || item?.probability !== '') : [];
  const comments = await publicationComments(row);
  const current = user();
  root.innerHTML = `<article class="publication"><p><a href="/published">← All published analysis</a></p>
    <p class="eyebrow">${esc(typeLabel(row.resource_type))} · published ${esc(ago(row.published_at || row.updated_at))}</p>
    <h1>${esc(row.title)}</h1><p class="resource-title">Analysis of <a href="${underlying(row)}">${esc(row.resource_title)}</a></p>
    <div class="publication-body">${safeHtml(row.body)}</div>
    ${scenarios.length ? `<section><h2>Projection scenarios</h2><ul>${scenarios.map((item) => `<li><strong>${esc(item.label || 'Projected outcome')}</strong>${item.probability !== '' ? ` · estimated ${esc(item.probability)}% chance` : ''}${item.date ? ` · expected by ${esc(item.date)}` : ''}</li>`).join('')}</ul></section>` : ''}
    ${authorBlock(row)}
    ${row.is_owner ? `<section class="publication-visibility"><h2>Publication discovery</h2><label><input id="publication-featured" type="checkbox" ${row.featured !== false ? 'checked' : ''}> Featured in discovery</label><button id="save-featured">Save visibility</button><span id="featured-status"></span></section>` : ''}
    <div class="publication-actions"><button id="copy-publication">⧉ Copy link</button><a href="${underlying(row)}">View the underlying page</a></div><p id="copy-status" aria-live="polite"></p>
    ${row.comments_enabled ? `<section class="publication-comments"><h2>Comments</h2>${comments.map((comment) => `<div class="comment"><b>${esc(comment.author_alias)}${comment.is_ai_comment ? ' · AI-assisted' : ''}</b><p>${esc(comment.body)}</p></div>`).join('') || '<p>No comments yet.</p>'}${current ? `<form id="publication-comment-form"><input name="alias" required minlength="2" maxlength="80" placeholder="Public name"><textarea name="body" required minlength="2" maxlength="3000" rows="4" placeholder="Respond to the analysis."></textarea><label><input name="aiComment" type="checkbox"> Use my AI to draft this comment</label><button>Post comment</button><p id="comment-status"></p></form>` : '<p><a href="/account">Sign in to comment.</a></p>'}</section>` : ''}
  </article>`;

  root.querySelector('#copy-publication').onclick = async () => {
    await navigator.clipboard.writeText(location.href);
    root.querySelector('#copy-status').textContent = 'Copied to your clipboard.';
  };
  root.querySelector('#save-featured')?.addEventListener('click', async () => {
    const button = root.querySelector('#save-featured');
    const status = root.querySelector('#featured-status');
    button.disabled = true;
    status.textContent = 'Saving…';
    try {
      const response = await fetch(`/api/published-feed/${encodeURIComponent(token)}/featured`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken() || ''}` },
        body: JSON.stringify({ featured: root.querySelector('#publication-featured').checked })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not save visibility.');
      status.textContent = 'Visibility saved.';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  root.querySelector('#publication-comment-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const status = root.querySelector('#comment-status');
    let body = String(formData.get('body')).trim();
    let is_ai_comment = false;
    let ai_model = null;
    try {
      if (formData.get('aiComment') === 'on') {
        const result = await ai([
          { role: 'system', content: 'Draft a constructive comment. Distinguish facts from inference and identify assumptions or counterarguments.' },
          { role: 'user', content: `Publication: ${row.title}\nAnalysis: ${String(row.body).replace(/<[^>]+>/g, ' ')}\nComment direction: ${body}` }
        ], { surface: 'publication_comment', publicationId: row.id });
        body = result.content;
        is_ai_comment = true;
        ai_model = result.model;
      }
      await rest('publication_comments', { method: 'POST', body: { workspace_note_id: row.id, user_id: user().id, author_alias: String(formData.get('alias')).trim(), body, is_ai_comment, ai_model } });
      await detail(token);
    } catch (error) {
      status.textContent = error.message;
    }
  });
}

async function feed() {
  document.body.classList.remove('focused-publication-view');
  const [server, database] = await Promise.all([
    serverFeed().catch((error) => { console.warn('Server publication feed:', error.message); return []; }),
    databaseFeed().catch((error) => { console.warn('Database publication feed:', error.message); return []; })
  ]);
  const rows = mergeRows(server, database);
  root.innerHTML = `<section class="published-hero"><p class="eyebrow">PUBLIC ANALYSIS</p><h1>Recently published views</h1><p>Independent analysis from Atlas Harbor users across legal cases, baseball, and logistics. Canonical source pages remain separate from these publications.</p></section>
    <section class="publication-feed">${rows.length ? rows.map((row) => `<a class="publication-card" href="/published/${encodeURIComponent(row.share_token)}"><span>${esc(typeLabel(row.resource_type))}</span><h2>${esc(row.title)}</h2><p>${esc(row.resource_title)}</p>${row.author_profile_slug ? `<div class="publication-card-author"><img src="${avatarDataUrl(row.author_avatar_seed, 40)}" alt=""><b>${esc(row.author_username)}</b></div>` : ''}<time>${esc(ago(row.published_at || row.updated_at))}</time></a>`).join('') : '<div class="empty"><h2>No publications yet</h2><p>No shared publications were found in the workspace database.</p></div>'}</section>`;
}

const token = decodeURIComponent(location.pathname.replace(/^\/published\/?/, '').split('/')[0] || '');
(token ? detail(token) : feed()).catch((error) => {
  root.innerHTML = `<section class="empty"><h1>Publication unavailable</h1><p>${esc(error.message)}</p><p><a href="/published">View published analysis</a></p></section>`;
});

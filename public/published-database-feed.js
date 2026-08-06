import { config } from './supabase-client.js';

const root = document.querySelector('#published-root');
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const typeLabel = (type) => ({
  legal_case: 'Legal',
  baseball_game: 'Baseball game',
  baseball_player: 'Baseball player',
  baseball_team: 'Baseball team',
  logistics_game: 'Logistics'
})[type] || 'Analysis';

function ago(value) {
  if (!value) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return seconds < 10 ? 'just now' : `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days} day${days === 1 ? '' : 's'} ago` : new Date(value).toLocaleDateString();
}

async function databasePublications() {
  const settings = await config();
  const query = '?is_shared=eq.true&is_published=eq.true&select=*&order=updated_at.desc&limit=100';
  const response = await fetch(`${settings.supabaseUrl}/rest/v1/workspace_notes${query}`, {
    headers: { apikey: settings.supabasePublishableKey, Accept: 'application/json' },
    cache: 'no-store'
  });
  const text = await response.text();
  let data = [];
  try { data = text ? JSON.parse(text) : []; } catch {}
  if (!response.ok) throw new Error(data?.message || text || `Publication database returned ${response.status}.`);
  return Array.isArray(data) ? data.filter((row) => row.share_token) : [];
}

function render(rows) {
  const feed = root?.querySelector('.publication-feed');
  if (!feed || !rows.length) return;
  feed.innerHTML = rows.map((row) => `<a class="publication-card" href="/published/${encodeURIComponent(row.share_token)}">
    <span>${esc(typeLabel(row.resource_type))}</span>
    <h2>${esc(row.title || 'Untitled analysis')}</h2>
    <p>${esc(row.resource_title || 'Analysis')}</p>
    <time>${esc(ago(row.published_at || row.updated_at))}</time>
  </a>`).join('');
}

async function restoreDatabaseFeed() {
  if (!root || location.pathname.replace(/\/$/, '') !== '/published') return;
  if (root.querySelector('.publication-card')) return;
  try {
    const rows = await databasePublications();
    if (rows.length) render(rows);
  } catch (error) {
    console.warn('Published database feed:', error.message);
  }
}

setTimeout(restoreDatabaseFeed, 250);
setTimeout(restoreDatabaseFeed, 1200);
window.addEventListener('atlas-publication-updated', restoreDatabaseFeed);

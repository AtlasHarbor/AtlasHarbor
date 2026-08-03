const $ = (selector) => document.querySelector(selector);
const input = $('#baseball-search');
const results = $('#search-results');
const status = $('#search-status');
const detail = $('#detail');
const games = $('#games');
let searchTimer;

const escapeHtml = (value) => String(value ?? '—').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const formatDate = (value, options = {}) => new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', ...options }).format(new Date(value));
const label = (key) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());

async function requestJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

function metricGrid(values, limit = 24) {
  const cells = Object.entries(values ?? {})
    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
    .slice(0, limit)
    .map(([key, value]) => `<div class="stat"><span>${escapeHtml(label(key))}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join('');
  return cells ? `<div class="stat-grid">${cells}</div>` : '<p class="empty-state">No data has been published yet.</p>';
}

function section(title, body) {
  return `<section class="report-section"><h3>${escapeHtml(title)}</h3>${body}</section>`;
}

function weatherText(weather) {
  if (!weather) return 'Forecast pending';
  return [weather.condition, weather.temperature != null ? `${weather.temperature}°` : null, weather.wind].filter(Boolean).join(' · ') || 'Forecast pending';
}

function renderGameCard(game) {
  const away = game.away?.name ?? 'Away';
  const home = game.home?.name ?? 'Home';
  return `<button class="game-card" data-game-id="${escapeHtml(game.id)}">
    <div class="game-card-top"><span class="game-date">${escapeHtml(formatDate(game.date))}</span><span class="status-pill">${escapeHtml(game.status ?? 'Scheduled')}</span></div>
    <div class="team-row"><strong>${escapeHtml(away)}</strong><span>at</span><strong>${escapeHtml(home)}</strong></div>
    <p class="venue-line">${escapeHtml(game.venue ?? 'Venue TBD')}</p>
    <div class="starter-grid">
      <div><small>Away starter</small><b>${escapeHtml(game.awayPitcher ?? 'TBD')}</b></div>
      <div><small>Home starter</small><b>${escapeHtml(game.homePitcher ?? 'TBD')}</b></div>
    </div>
    <div class="weather-strip"><span>☁</span><b>${escapeHtml(weatherText(game.weather))}</b></div>
    <span class="open-report">Open matchup report →</span>
  </button>`;
}

async function loadGames() {
  if (!games) return;
  games.innerHTML = '<div class="schedule-loading"><span></span><p>Loading the next MLB matchups…</p></div>';
  try {
    const payload = await requestJson('/api/baseball/games');
    const list = Array.isArray(payload.games) ? payload.games : [];
    games.innerHTML = list.length ? list.map(renderGameCard).join('') : '<div class="schedule-empty"><h3>No upcoming games found</h3><p>MLB has not published games in the current window.</p></div>';
    games.querySelectorAll('[data-game-id]').forEach((button) => button.addEventListener('click', () => loadGame(button.dataset.gameId)));
  } catch (error) {
    console.error('Schedule load failed', error);
    games.innerHTML = '<div class="schedule-error"><h3>Schedule temporarily unavailable</h3><p>The MLB data service did not respond. Try again in a moment.</p><button id="retry-schedule">Retry schedule</button></div>';
    $('#retry-schedule')?.addEventListener('click', loadGames);
  }
}

async function search(query) {
  try {
    const payload = await requestJson(`/api/baseball/search?q=${encodeURIComponent(query)}`);
    const items = Array.isArray(payload.results) ? payload.results : [];
    results.innerHTML = items.length ? items.map((item) => `<button class="result" data-type="${escapeHtml(item.type)}" data-id="${escapeHtml(item.id)}"><span class="type-badge">${escapeHtml(item.type)}</span><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.subtitle)}</small></span><span class="arrow">→</span></button>`).join('') : '<div class="result">No matching teams, games, or players.</div>';
    results.hidden = false;
    status.textContent = `${items.length} result${items.length === 1 ? '' : 's'}`;
  } catch (error) {
    console.error('Search failed', error);
    results.hidden = true;
    status.textContent = 'Search is temporarily unavailable.';
  }
}

input?.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const query = input.value.trim();
  if (query.length < 2) {
    results.hidden = true;
    status.textContent = 'Type at least 2 letters';
    return;
  }
  status.textContent = 'Searching teams, games, and players…';
  searchTimer = setTimeout(() => search(query), 250);
});

results?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-id]');
  if (!button) return;
  results.hidden = true;
  if (button.dataset.type === 'team') loadTeam(button.dataset.id);
  else if (button.dataset.type === 'player') loadPlayer(button.dataset.id);
  else loadGame(button.dataset.id);
});

function playerButton(player) {
  return `<button data-player-id="${escapeHtml(player.id)}"><b>${escapeHtml(player.name)}</b><small>${escapeHtml(player.position)}</small></button>`;
}

async function loadGame(id) {
  status.textContent = 'Loading complete game report…';
  try {
    const { game } = await requestJson(`/api/baseball/games/${id}`);
    const side = (key, title) => {
      const team = game.teams?.[key] ?? {};
      const lineup = team.battingOrder?.length ? `<ol>${team.battingOrder.map((player) => `<li>${playerButton(player)}</li>`).join('')}</ol>` : '<p>Lineup has not been posted.</p>';
      const bench = (team.bench ?? []).map(playerButton).join('') || '<p>Bench not posted.</p>';
      const bullpen = (team.bullpen ?? []).map(playerButton).join('') || '<p>Bullpen not posted.</p>';
      return `<div class="lineup-card"><h3>${escapeHtml(title)} lineup</h3>${lineup}<h4>Bench</h4><div class="roster">${bench}</div><h4>Bullpen</h4><div class="roster">${bullpen}</div></div>`;
    };
    detail.innerHTML = `<div class="detail-head"><div><p class="eyebrow">GAME REPORT · ${escapeHtml(game.status)}</p><h2>${escapeHtml(game.name)}</h2><p>${escapeHtml(formatDate(game.date))} · ${escapeHtml(game.venue)} · ${escapeHtml(game.seriesDescription)}</p></div></div>${metricGrid({ gameType: game.gameType, dayNight: game.dayNight, scheduledInnings: game.scheduledInnings, doubleHeader: game.doubleHeader, awayStarter: game.probablePitchers?.away, homeStarter: game.probablePitchers?.home, weather: game.weather?.condition, temperature: game.weather?.temperature, wind: game.weather?.wind })}<div class="lineup-grid">${side('away', game.away?.name ?? 'Away')}${side('home', game.home?.name ?? 'Home')}</div>`;
    activatePlayerLinks();
    showDetail('Game report ready');
  } catch (error) {
    console.error('Game load failed', error);
    status.textContent = 'Game report unavailable.';
  }
}

async function loadTeam(id) {
  status.textContent = 'Loading team, lineup, bench, and IL…';
  try {
    const { team } = await requestJson(`/api/baseball/teams/${id}`);
    const lineup = team.lineup?.players?.length ? `<ol class="lineup-list">${team.lineup.players.map((player) => `<li>${playerButton(player)}</li>`).join('')}</ol>` : '<p>The next lineup has not been posted by MLB yet.</p>';
    const bench = (team.bench ?? []).map((player) => `<div class="bench-card">${playerButton(player)}${metricGrid(player.pinchHitting, 6)}</div>`).join('') || '<p>No bench data returned.</p>';
    const injured = team.injuredList?.length ? `<div class="roster">${team.injuredList.map((player) => `<button data-player-id="${escapeHtml(player.id)}"><b>${escapeHtml(player.name)}</b><small>${escapeHtml(player.position)} · ${escapeHtml(player.status)}</small></button>`).join('')}</div>` : '<p>No injured-list players returned by MLB.</p>';
    const roster = `<div class="roster">${(team.roster ?? []).map(playerButton).join('')}</div>`;
    detail.innerHTML = `<div class="detail-head"><div><p class="eyebrow">TEAM REPORT</p><h2>${escapeHtml(team.name)}</h2><p>${escapeHtml(team.league)} · ${escapeHtml(team.division)} · ${escapeHtml(team.venue)}</p></div><strong>${escapeHtml(team.abbreviation)}</strong></div>${section('Major team stats', metricGrid({ ...team.stats?.hitting, ...team.stats?.pitching, ...team.stats?.fielding }, 36))}${section(`${team.lineup?.status === 'confirmed' ? 'Confirmed' : 'Projected'} lineup`, lineup)}${section('Bench and pinch-hitting stats', `<div class="bench-grid">${bench}</div>`)}${section('Active injured list', injured)}${section('Full active roster', roster)}`;
    activatePlayerLinks();
    showDetail('Team report ready');
  } catch (error) {
    console.error('Team load failed', error);
    status.textContent = 'Team report unavailable.';
  }
}

async function loadPlayer(id) {
  status.textContent = 'Loading complete player record…';
  try {
    const { player } = await requestJson(`/api/baseball/players/${id}`);
    const stats = Object.entries(player.stats ?? {}).map(([name, splits]) => section(name, `<div class="split-stack">${(splits ?? []).map((split) => `<div><h4>${escapeHtml(split.season || split.sport?.name || split.team?.name || 'Summary')}</h4>${metricGrid(split.stat, 24)}</div>`).join('')}</div>`)).join('');
    const rows = (player.recentGames ?? []).map((game) => {
      const summary = Object.entries(game.stat ?? {}).filter(([, value]) => ['string', 'number'].includes(typeof value)).slice(0, 10).map(([key, value]) => `${label(key)}: ${value}`).join(' · ');
      return `<tr><td>${escapeHtml(game.date)}</td><td>${escapeHtml(game.opponent)}</td><td>${game.isHome ? 'Home' : 'Away'}</td><td>${escapeHtml(summary)}</td></tr>`;
    }).join('');
    const transactions = (player.transactions ?? []).map((transaction) => `<article><b>${escapeHtml(transaction.date)} · ${escapeHtml(transaction.type)}</b><p>${escapeHtml(transaction.description)}</p></article>`).join('') || '<p>No recent transactions returned.</p>';
    detail.innerHTML = `<div class="detail-head"><div><p class="eyebrow">COMPLETE PLAYER REPORT</p><h2>${escapeHtml(player.name)}</h2><p>${escapeHtml(player.team)} · ${escapeHtml(player.position)} · Bats ${escapeHtml(player.bats)} · Throws ${escapeHtml(player.throws)}</p></div><strong>${escapeHtml(player.number)}</strong></div>${section('Bio', metricGrid({ age: player.age, height: player.height, weight: player.weight, birthDate: player.birthDate, birthCity: player.birthCity, birthCountry: player.birthCountry, debut: player.debut, active: player.active }))}${stats}${section('Last 8 games', `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Opponent</th><th>Location</th><th>Game stats</th></tr></thead><tbody>${rows}</tbody></table></div>`)}${section('Recent transactions and availability', `<div class="timeline">${transactions}</div>`)}`;
    showDetail('Complete player report ready');
  } catch (error) {
    console.error('Player load failed', error);
    status.textContent = 'Player report unavailable.';
  }
}

function activatePlayerLinks() {
  detail.querySelectorAll('[data-player-id]').forEach((button) => button.addEventListener('click', () => loadPlayer(button.dataset.playerId)));
}

function showDetail(message) {
  detail.hidden = false;
  detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
  status.textContent = message;
}

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'k') { event.preventDefault(); input?.focus(); }
  if (event.key === 'Escape' && results) results.hidden = true;
});
document.addEventListener('click', (event) => { if (results && !event.target.closest('.search-shell')) results.hidden = true; });
loadGames();

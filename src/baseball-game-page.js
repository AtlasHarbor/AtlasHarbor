const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const json = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
const statLabel = (key) => key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

export const gameSlug = (game) => `${game.away?.name ?? "away"}-at-${game.home?.name ?? "home"}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function formatDate(value) {
  if (!value) return "Date TBD";
  return new Intl.DateTimeFormat("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
}

function metrics(values = {}, limit = 20) {
  const items = Object.entries(values).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value)).slice(0, limit);
  return items.length ? `<div class="seo-stat-grid">${items.map(([key, value]) => `<div><span>${escapeHtml(statLabel(key))}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}</div>` : `<p class="empty">Not yet published by MLB.</p>`;
}

function playerList(players = [], emptyText) {
  if (!players.length) return `<p class="empty">${escapeHtml(emptyText)}</p>`;
  return `<ol class="player-list">${players.map((player) => `<li><a href="/baseball/players?player=${player.id}"><strong>${escapeHtml(player.name)}</strong><span>${escapeHtml(player.position ?? "Player")}</span></a>${metrics(player.stats?.batting ?? player.stats?.pitching ?? {}, 8)}</li>`).join("")}</ol>`;
}

function teamPanel(side, title) {
  const team = side ?? {};
  return `<section class="team-panel"><h2>${escapeHtml(title)}</h2><h3>Starting lineup</h3>${playerList(team.battingOrder, "The starting lineup has not been posted.")}<h3>Bench</h3>${playerList(team.bench, "The bench has not been posted.")}<h3>Pitchers and bullpen</h3>${playerList([...(team.pitchers ?? []), ...(team.bullpen ?? [])].filter((player, index, all) => all.findIndex((item) => item.id === player.id) === index), "Pitching availability has not been posted.")}<h3>Team game totals</h3>${metrics({ ...(team.totals?.batting ?? {}), ...(team.totals?.pitching ?? {}), ...(team.totals?.fielding ?? {}) }, 28)}</section>`;
}

export function renderBaseballGamePage(game, canonicalUrl) {
  const away = game.away?.name ?? "Away Team";
  const home = game.home?.name ?? "Home Team";
  const title = `${away} at ${home}: Lineups, Starting Pitchers, Weather and Game Preview`;
  const description = `${away} at ${home} on ${formatDate(game.date)}. View probable pitchers, weather, venue details, lineups, benches, bullpens, game status and MLB matchup data.`;
  const weather = game.weather ? [game.weather.condition, game.weather.temperature != null ? `${game.weather.temperature}°` : null, game.weather.wind].filter(Boolean).join(" · ") : "Weather forecast has not been published by MLB.";
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${away} at ${home}`,
    startDate: game.date,
    eventStatus: game.status,
    location: { "@type": "StadiumOrArena", name: game.venue ?? "Venue TBD" },
    competitor: [{ "@type": "SportsTeam", name: away }, { "@type": "SportsTeam", name: home }],
    url: canonicalUrl,
    description,
  };
  const officials = (game.officials ?? []).map((item) => `<li><strong>${escapeHtml(item.official?.fullName ?? item.fullName ?? "Official")}</strong><span>${escapeHtml(item.officialType ?? item.type ?? "")}</span></li>`).join("") || `<li>Officials have not been posted.</li>`;
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Atlas Harbor</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${escapeHtml(canonicalUrl)}"><meta property="og:type" content="article"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonicalUrl)}"><meta name="twitter:card" content="summary_large_image"><script type="application/ld+json">${json(structuredData)}</script><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap" rel="stylesheet"><link rel="stylesheet" href="/game-report.css"></head><body><header class="report-nav"><a class="brand" href="/"><span>AH</span>Atlas Harbor</a><nav><a href="/baseball">Baseball</a><a href="/game">Game</a><a href="/legal">Legal</a></nav></header><main><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><a href="/baseball">Baseball</a><span>›</span><span>${escapeHtml(away)} at ${escapeHtml(home)}</span></nav><article><header class="game-hero"><p class="eyebrow">MLB GAME REPORT · ${escapeHtml(game.status ?? "Scheduled")}</p><h1>${escapeHtml(away)} <em>at</em> ${escapeHtml(home)}</h1><p class="dek">${escapeHtml(formatDate(game.date))} · ${escapeHtml(game.venue ?? "Venue TBD")}</p><div class="hero-facts"><div><span>Away starter</span><strong>${escapeHtml(game.probablePitchers?.away ?? game.awayPitcher ?? "TBD")}</strong></div><div><span>Home starter</span><strong>${escapeHtml(game.probablePitchers?.home ?? game.homePitcher ?? "TBD")}</strong></div><div><span>Weather</span><strong>${escapeHtml(weather)}</strong></div><div><span>Series</span><strong>${escapeHtml(game.seriesDescription ?? "Regular season")}</strong></div></div></header><section class="overview"><h2>Everything to know about this game</h2>${metrics({ status: game.status, gameType: game.gameType, dayNight: game.dayNight, scheduledInnings: game.scheduledInnings, doubleHeader: game.doubleHeader, seriesGameNumber: game.seriesGameNumber, gamesInSeries: game.gamesInSeries, venue: game.venue, weather, boxscoreAvailable: game.availability?.boxscore, liveFeedAvailable: game.availability?.liveFeed }, 24)}</section><div class="team-grid">${teamPanel(game.teams?.away, away)}${teamPanel(game.teams?.home, home)}</div><section><h2>Venue and game information</h2>${metrics({ name: game.venueDetails?.name ?? game.venue, city: game.venueDetails?.location?.city, state: game.venueDetails?.location?.stateAbbrev, roofType: game.venueDetails?.fieldInfo?.roofType, turfType: game.venueDetails?.fieldInfo?.turfType, capacity: game.venueDetails?.fieldInfo?.capacity, firstYear: game.venueDetails?.fieldInfo?.firstYear }, 20)}</section><section><h2>Officials</h2><ul class="officials">${officials}</ul></section><section><h2>Live and final game data</h2>${game.linescore ? metrics({ currentInning: game.linescore.currentInning, inningState: game.linescore.inningState, awayRuns: game.linescore.teams?.away?.runs, awayHits: game.linescore.teams?.away?.hits, awayErrors: game.linescore.teams?.away?.errors, homeRuns: game.linescore.teams?.home?.runs, homeHits: game.linescore.teams?.home?.hits, homeErrors: game.linescore.teams?.home?.errors }, 20) : `<p class="empty">Line score data will appear when MLB publishes it.</p>`}</section><p class="source-note">Data source: MLB Stats API. Lineups, probable pitchers and weather can change before first pitch.</p></article></main><footer><a href="/baseball">← Back to all upcoming games</a><span>Atlas Harbor Baseball Intelligence</span></footer></body></html>`;
}

export function renderGameNotFoundPage() {
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Game not found · Atlas Harbor</title><link rel="stylesheet" href="/game-report.css"></head><body><main class="not-found"><h1>Game not found</h1><p>The requested MLB game could not be loaded.</p><a href="/baseball">Return to upcoming games</a></main></body></html>`;
}

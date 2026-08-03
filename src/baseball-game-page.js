const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const json = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

export const gameSlug = (game) => `${game.away?.name ?? "away"}-at-${game.home?.name ?? "home"}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function formatDate(value) {
  if (!value) return "Date TBD";
  return new Intl.DateTimeFormat("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
}

const meaningful = (value) => value !== null && value !== undefined && value !== "" && value !== ".---" && value !== false;
const stat = (source, keys) => keys.map((key) => source?.[key]).find(meaningful);

function statGrid(items) {
  const visible = items.filter(([, value]) => meaningful(value));
  return visible.length ? `<div class="seo-stat-grid">${visible.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}</div>` : `<p class="empty">MLB has not published enough data yet.</p>`;
}

function hitterStats(player) {
  const s = player?.seasonStats?.batting ?? {};
  return statGrid([["AVG", s.avg], ["OBP", s.obp], ["SLG", s.slg], ["OPS", s.ops], ["HR", s.homeRuns], ["RBI", s.rbi], ["SB", s.stolenBases]]);
}

function pitcherStats(player) {
  const s = player?.seasonStats?.pitching ?? {};
  return statGrid([["ERA", s.era], ["WHIP", s.whip], ["IP", s.inningsPitched], ["K", s.strikeOuts], ["BB", s.baseOnBalls], ["HR", s.homeRuns], ["W-L", meaningful(s.wins) || meaningful(s.losses) ? `${s.wins ?? 0}-${s.losses ?? 0}` : null]]);
}

function playerCard(player, type = "hitter") {
  return `<li><a href="/baseball/players?player=${player.id}"><strong>${escapeHtml(player.name)}</strong><span>${escapeHtml(player.position ?? "Player")}</span></a>${type === "pitcher" ? pitcherStats(player) : hitterStats(player)}</li>`;
}

function findStarter(team, starterName) {
  return [...(team?.pitchers ?? []), ...(team?.bullpen ?? [])].find((player) => player.name === starterName);
}

function usefulTeamRates(team) {
  const batting = team?.totals?.batting ?? {};
  const pitching = team?.totals?.pitching ?? {};
  return statGrid([
    ["Team AVG", batting.avg], ["Team OPS", batting.ops], ["Team SLG", batting.slg],
    ["Team ERA", pitching.era], ["Team WHIP", pitching.whip], ["K/9", pitching.strikeoutsPer9Inn], ["BB/9", pitching.walksPer9Inn],
  ]);
}

function teamPanel(side, title, starterName) {
  const team = side ?? {};
  const starter = findStarter(team, starterName);
  const lineupPosted = (team.battingOrder ?? []).length > 0;
  const hitters = lineupPosted ? team.battingOrder : (team.bench ?? []).slice(0, 6);
  return `<section class="team-panel"><h2>${escapeHtml(title)}</h2>
    <div class="starter-card"><p class="eyebrow">PROBABLE STARTER</p><h3>${escapeHtml(starterName || "TBD")}</h3>${starter ? pitcherStats(starter) : `<p class="empty">Season pitching stats are not available yet.</p>`}</div>
    <h3>${lineupPosted ? "Confirmed starting lineup" : "Likely available hitters"}</h3>
    ${lineupPosted ? `<ol class="player-list">${hitters.map((player) => playerCard(player)).join("")}</ol>` : `<p class="lineup-warning">The official lineup is not posted. These are rostered hitters, not a projected batting order.</p><ol class="player-list compact">${hitters.map((player) => playerCard(player)).join("")}</ol>`}
    <h3>Team matchup profile</h3>${usefulTeamRates(team)}
  </section>`;
}

function weatherImpact(weather) {
  if (!weather) return "Forecast unavailable. Recheck near first pitch.";
  const parts = [weather.condition, weather.temperature != null ? `${weather.temperature}°` : null, weather.wind].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Forecast unavailable. Recheck near first pitch.";
}

function decisionNotes(game, awayStarter, homeStarter) {
  const lineupReady = (game.teams?.away?.battingOrder?.length ?? 0) > 0 && (game.teams?.home?.battingOrder?.length ?? 0) > 0;
  return `<div class="decision-grid">
    <article><span>Fantasy</span><strong>${lineupReady ? "Lineups confirmed" : "Wait for confirmed lineups"}</strong><p>${lineupReady ? "Use batting order and handedness to finalize starts and DFS exposure." : "Do not treat the roster pool as a batting order. Check again closer to first pitch."}</p></article>
    <article><span>Starting pitching</span><strong>${escapeHtml(awayStarter)} vs ${escapeHtml(homeStarter)}</strong><p>Compare starter ERA, WHIP, strikeouts, workload, and the opposing lineup once it is official.</p></article>
    <article><span>Run environment</span><strong>${escapeHtml(weatherImpact(game.weather))}</strong><p>Temperature, wind, precipitation, roof status, and park dimensions can materially change scoring expectations.</p></article>
    <article><span>Betting context</span><strong>Market odds are not supplied</strong><p>This page provides matchup inputs, not sportsbook lines. Compare these facts with current prices before making a decision.</p></article>
  </div>`;
}

export function renderBaseballGamePage(game, canonicalUrl) {
  const away = game.away?.name ?? "Away Team";
  const home = game.home?.name ?? "Home Team";
  const awayStarter = game.probablePitchers?.away ?? game.awayPitcher ?? "TBD";
  const homeStarter = game.probablePitchers?.home ?? game.homePitcher ?? "TBD";
  const title = `${away} at ${home}: Fantasy and Betting Matchup Preview`;
  const description = `${away} at ${home} on ${formatDate(game.date)} with probable pitchers, actionable weather context, lineup status, hitter season stats and matchup information.`;
  const structuredData = { "@context": "https://schema.org", "@type": "SportsEvent", name: `${away} at ${home}`, startDate: game.date, eventStatus: game.status, location: { "@type": "StadiumOrArena", name: game.venue ?? "Venue TBD" }, competitor: [{ "@type": "SportsTeam", name: away }, { "@type": "SportsTeam", name: home }], url: canonicalUrl, description };
  const lineScore = game.linescore ? statGrid([[`${away} runs`, game.linescore.teams?.away?.runs], [`${away} hits`, game.linescore.teams?.away?.hits], [`${home} runs`, game.linescore.teams?.home?.runs], [`${home} hits`, game.linescore.teams?.home?.hits], ["Inning", game.linescore.currentInning], ["State", game.linescore.inningState]]) : "";
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Atlas Harbor</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${escapeHtml(canonicalUrl)}"><meta property="og:type" content="article"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonicalUrl)}"><meta name="twitter:card" content="summary"><script type="application/ld+json">${json(structuredData)}</script><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap" rel="stylesheet"><link rel="stylesheet" href="/game-report.css"></head><body><header class="report-nav"><a class="brand" href="/"><span>AH</span>Atlas Harbor</a><nav><a href="/baseball">Baseball</a><a href="/game">Game</a><a href="/legal">Legal</a></nav></header><main><nav class="breadcrumbs"><a href="/">Home</a><span>›</span><a href="/baseball">Baseball</a><span>›</span><span>${escapeHtml(away)} at ${escapeHtml(home)}</span></nav><article><header class="game-hero"><p class="eyebrow">MLB MATCHUP · ${escapeHtml(game.status ?? "Scheduled")}</p><h1>${escapeHtml(away)} <em>at</em> ${escapeHtml(home)}</h1><p class="dek">${escapeHtml(formatDate(game.date))} · ${escapeHtml(game.venue ?? "Venue TBD")}</p>${statGrid([["Away starter", awayStarter], ["Home starter", homeStarter], ["Weather", weatherImpact(game.weather)], ["Game", game.seriesGameNumber && game.gamesInSeries ? `${game.seriesGameNumber} of ${game.gamesInSeries}` : null], ["Day/Night", game.dayNight]])}</header><section><h2>Fantasy and betting decision board</h2>${decisionNotes(game, awayStarter, homeStarter)}</section><div class="team-grid">${teamPanel(game.teams?.away, away, awayStarter)}${teamPanel(game.teams?.home, home, homeStarter)}</div>${lineScore ? `<section><h2>Live or final scoreboard</h2>${lineScore}</section>` : ""}<section class="availability"><h2>Data availability</h2><p>Probable pitchers, lineups, and weather can change. Empty pregame box-score totals and unpublished officials are intentionally hidden because they do not help a fantasy or betting decision.</p></section><p class="source-note">Data source: MLB Stats API. This page provides information, not betting advice.</p></article></main><footer><a href="/baseball">← Back to upcoming games</a><span>Atlas Harbor Baseball Intelligence</span></footer></body></html>`;
}

export function renderGameNotFoundPage() {
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Game not found · Atlas Harbor</title><link rel="stylesheet" href="/game-report.css"></head><body><main class="not-found"><h1>Game not found</h1><p>The requested MLB game could not be loaded.</p><a href="/baseball">Return to upcoming games</a></main></body></html>`;
}

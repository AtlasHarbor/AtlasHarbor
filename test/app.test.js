import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";

async function withServer(mlb, callback) {
  const server = createApp({ mlb }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try { await callback(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); }
}

test("unified search requires two characters", async () => withServer({}, async (url) => {
  const response = await fetch(`${url}/api/baseball/search?q=a`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { results: [] });
}));

test("unified search returns teams, games, and players", async () => withServer({
  search: async () => [
    { type: "team", id: 10, name: "Test Club", subtitle: "American League" },
    { type: "game", id: 20, name: "Test Club at Harbor Nine", subtitle: "2026-08-04 · Harbor Park", date: "2026-08-04T19:10:00Z" },
    { type: "player", id: 30, name: "Test Player", subtitle: "Test Club · Pitcher" },
  ],
}, async (url) => {
  const response = await fetch(`${url}/api/baseball/search?q=test`);
  assert.equal(response.status, 200);
  const { results } = await response.json();
  assert.deepEqual(results.map((item) => item.type), ["team", "game", "player"]);
}));

test("upcoming games preserve chronological order, starters, and weather", async () => withServer({
  getUpcomingGames: async () => [
    { id: 1, date: "2026-08-03T18:00:00Z", awayPitcher: "Away Ace", homePitcher: "Home Ace", weather: { condition: "Clear", temperature: 76, wind: "8 mph, Out To RF" } },
    { id: 2, date: "2026-08-04T18:00:00Z", awayPitcher: "Second Away", homePitcher: "Second Home", weather: null },
  ],
}, async (url) => {
  const response = await fetch(`${url}/api/baseball/games`);
  assert.equal(response.status, 200);
  const { games } = await response.json();
  assert.equal(games.length, 2);
  assert.ok(games[0].date < games[1].date);
  assert.equal(games[0].awayPitcher, "Away Ace");
  assert.equal(games[0].weather.condition, "Clear");
}));

test("team endpoint validates IDs and returns major stats with roster", async () => withServer({
  getTeam: async (id) => ({
    id,
    name: "Test Club",
    stats: {
      hitting: { avg: ".275", ops: ".810", homeRuns: 150, runs: 620 },
      pitching: { wins: 70, losses: 45, era: "3.42", whip: "1.18", strikeOuts: 980, saves: 32 },
      fielding: { fielding: ".986", errors: 48 },
    },
    roster: [{ id: 30, name: "Test Player", position: "Pitcher", number: "42" }],
  }),
}, async (url) => {
  assert.equal((await fetch(`${url}/api/baseball/teams/nope`)).status, 400);
  const response = await fetch(`${url}/api/baseball/teams/10`);
  assert.equal(response.status, 200);
  const { team } = await response.json();
  assert.equal(team.stats.hitting.ops, ".810");
  assert.equal(team.stats.pitching.era, "3.42");
  assert.equal(team.stats.fielding.fielding, ".986");
  assert.equal(team.roster[0].name, "Test Player");
}));

test("player endpoint returns season stats and the last eight games", async () => withServer({
  getPlayer: async (id) => ({
    id,
    name: "Test Player",
    stats: { "hitting:season": { avg: ".301", ops: ".925", homeRuns: 28, rbi: 81 } },
    recentGames: Array.from({ length: 8 }, (_, index) => ({ date: `2026-08-${String(8 - index).padStart(2, "0")}`, opponent: `Opponent ${index + 1}`, stat: { atBats: 4, hits: 2 } })),
  }),
}, async (url) => {
  assert.equal((await fetch(`${url}/api/baseball/players/nope`)).status, 400);
  const response = await fetch(`${url}/api/baseball/players/42`);
  assert.equal(response.status, 200);
  const { player } = await response.json();
  assert.equal(player.stats["hitting:season"].ops, ".925");
  assert.equal(player.recentGames.length, 8);
  assert.equal(player.recentGames[0].opponent, "Opponent 1");
}));

test("legacy player search remains compatible", async () => withServer({
  search: async () => [{ type: "player", id: 1, name: "Test Player", subtitle: "Test Team · Pitcher" }],
}, async (url) => {
  const response = await fetch(`${url}/api/baseball/players?q=test`);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).players[0], { id: 1, name: "Test Player", team: "Test Team", position: "Pitcher" });
}));

import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";

async function withServer(mlb, callback) {
  const server = createApp({ mlb }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try { await callback(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); }
}

test("search requires two characters", async () => withServer({}, async (url) => {
  const response = await fetch(`${url}/api/baseball/players?q=a`);
  assert.deepEqual(await response.json(), { players: [] });
}));

test("search returns normalized players", async () => withServer({ searchPlayers: async () => [{ id: 1, name: "Test Player", team: "Test Team", position: "Pitcher" }] }, async (url) => {
  const response = await fetch(`${url}/api/baseball/players?q=test`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).players[0].team, "Test Team");
}));

test("player endpoint validates IDs and returns a report", async () => withServer({ getPlayer: async (id) => ({ id, name: "Test Player" }) }, async (url) => {
  assert.equal((await fetch(`${url}/api/baseball/players/nope`)).status, 400);
  const response = await fetch(`${url}/api/baseball/players/42`);
  assert.equal((await response.json()).player.id, "42");
}));

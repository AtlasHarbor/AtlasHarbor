import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMlbClient } from "../src/mlb.js";

test("public baseball module parses", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.doesNotThrow(() => new Function(source));
});

test("upcoming games are normalized and sorted chronologically", async () => {
  const payload = {
    dates: [{ games: [
      { gamePk: 2, gameDate: "2026-08-04T23:10:00Z", officialDate: "2026-08-04", status: { detailedState: "Scheduled" }, venue: { name: "Globe Life Field" }, teams: { away: { team: { id: 1, name: "Away Two" }, probablePitcher: { fullName: "Road Starter" } }, home: { team: { id: 2, name: "Texas Rangers" }, probablePitcher: { fullName: "Home Starter" } } }, weather: { condition: "Clear", temp: 91, wind: "8 mph, Out To RF" } },
      { gamePk: 1, gameDate: "2026-08-03T18:05:00Z", officialDate: "2026-08-03", status: { detailedState: "Scheduled" }, venue: { name: "First Park" }, teams: { away: { team: { id: 3, name: "Away One" } }, home: { team: { id: 4, name: "Home One" } } } }
    ] }]
  };
  const fetchImpl = async () => ({ ok: true, json: async () => payload });
  const games = await createMlbClient(fetchImpl).getUpcomingGames(14);
  assert.deepEqual(games.map((game) => game.id), [1, 2]);
  assert.equal(games[1].homePitcher, "Home Starter");
  assert.deepEqual(games[1].weather, { condition: "Clear", temperature: 91, wind: "8 mph, Out To RF" });
});

test("upcoming schedule tolerates empty MLB dates", async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ dates: [] }) });
  assert.deepEqual(await createMlbClient(fetchImpl).getUpcomingGames(), []);
});

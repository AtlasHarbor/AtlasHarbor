import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Script } from "node:vm";
import { createApp } from "../src/app.js";

test("logistics game browser bundle parses", async () => {
  const source = await readFile(new URL("../public/game.js", import.meta.url), "utf8");
  assert.doesNotThrow(() => new Script(source));
});

test("game guide route is registered before game wildcard", () => {
  const app = createApp({ mlb: {}, legal: {} });
  const paths = app.router.stack.filter(layer => layer.route).map(layer => layer.route.path);
  const docsIndex = paths.findIndex(path => path === "/game/docs");
  const gameIndex = paths.findIndex(path => Array.isArray(path) && path.includes("/game"));
  assert.ok(docsIndex >= 0);
  assert.ok(gameIndex > docsIndex);
});

test("game UI exposes explicit fleet, route, provider, and tutorial controls", async () => {
  const html = await readFile(new URL("../public/game.html", import.meta.url), "utf8");
  for (const id of ["fleet-list", "route-select", "provider-select", "dispatch", "help", "modal"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});

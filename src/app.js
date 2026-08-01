import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMlbClient } from "./mlb.js";

const directory = path.dirname(fileURLToPath(import.meta.url));

export function createApp({ mlb = createMlbClient() } = {}) {
  const app = express();

  app.get("/api/baseball/players", async (request, response) => {
    const query = String(request.query.q ?? "").trim();
    if (query.length < 2) return response.json({ players: [] });
    try {
      return response.json({ players: await mlb.searchPlayers(query) });
    } catch (error) {
      console.error(error);
      return response.status(502).json({ error: "Player search is temporarily unavailable." });
    }
  });

  app.get("/api/baseball/players/:id", async (request, response) => {
    if (!/^\d+$/.test(request.params.id)) return response.status(400).json({ error: "Invalid player ID." });
    try {
      const player = await mlb.getPlayer(request.params.id);
      return player ? response.json({ player }) : response.status(404).json({ error: "Player not found." });
    } catch (error) {
      console.error(error);
      return response.status(502).json({ error: "Player statistics are temporarily unavailable." });
    }
  });

  app.use("/vendor", express.static(path.join(directory, "../node_modules/phaser/dist")));
  app.use(express.static(path.join(directory, "../public")));
  app.get("/{*path}", (_request, response) => response.sendFile(path.join(directory, "../public/index.html")));
  return app;
}

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMlbClient } from "./mlb.js";

const directory = path.dirname(fileURLToPath(import.meta.url));
const page = (name) => path.join(directory, `../public/${name}`);

export function createApp({ mlb = createMlbClient() } = {}) {
  const app = express();

  app.get("/api/baseball/search", async (request, response) => {
    const query = String(request.query.q ?? "").trim();
    if (query.length < 2) return response.json({ results: [] });
    try { return response.json({ results: await mlb.search(query) }); }
    catch (error) { console.error(error); return response.status(502).json({ error: "Baseball search is temporarily unavailable." }); }
  });
  app.get("/api/baseball/games", async (_request, response) => {
    try { return response.json({ games: await mlb.getUpcomingGames(14) }); }
    catch (error) { console.error(error); return response.status(502).json({ error: "Upcoming games are temporarily unavailable." }); }
  });
  app.get("/api/baseball/teams/:id", async (request, response) => {
    if (!/^\d+$/.test(request.params.id)) return response.status(400).json({ error: "Invalid team ID." });
    try { const team = await mlb.getTeam(request.params.id); return team ? response.json({ team }) : response.status(404).json({ error: "Team not found." }); }
    catch (error) { console.error(error); return response.status(502).json({ error: "Team statistics are temporarily unavailable." }); }
  });
  app.get("/api/baseball/players", async (request, response) => {
    const query = String(request.query.q ?? "").trim();
    if (query.length < 2) return response.json({ players: [] });
    try { const results = await mlb.search(query); return response.json({ players: results.filter((item) => item.type === "player").map((item) => ({ id: item.id, name: item.name, team: item.subtitle.split(" · ")[0], position: item.subtitle.split(" · ")[1] })) }); }
    catch (error) { console.error(error); return response.status(502).json({ error: "Player search is temporarily unavailable." }); }
  });
  app.get("/api/baseball/players/:id", async (request, response) => {
    if (!/^\d+$/.test(request.params.id)) return response.status(400).json({ error: "Invalid player ID." });
    try { const player = await mlb.getPlayer(request.params.id); return player ? response.json({ player }) : response.status(404).json({ error: "Player not found." }); }
    catch (error) { console.error(error); return response.status(502).json({ error: "Player statistics are temporarily unavailable." }); }
  });

  app.get(["/baseball", "/baseball/players", "/baseball/{*path}"], (_request, response) => response.sendFile(page("baseball.html")));
  app.get(["/game", "/game/{*path}"], (_request, response) => response.sendFile(page("game.html")));
  app.use("/vendor", express.static(path.join(directory, "../node_modules/phaser/dist")));
  app.use(express.static(path.join(directory, "../public")));
  app.get("/{*path}", (_request, response) => response.sendFile(page("index.html")));
  return app;
}

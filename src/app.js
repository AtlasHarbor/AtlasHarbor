import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMlbClient } from "./mlb.js";

const directory = path.dirname(fileURLToPath(import.meta.url));
const page = (name) => path.join(directory, `../public/${name}`);

export function createApp({ mlb = createMlbClient() } = {}) {
  const app = express();

  app.get("/api/baseball/search", async (req,res)=>{const q=String(req.query.q??"").trim();if(q.length<2)return res.json({results:[]});try{return res.json({results:await mlb.search(q)})}catch(e){console.error(e);return res.status(502).json({error:"Baseball search is temporarily unavailable."})}});
  app.get("/api/baseball/games", async (_req,res)=>{try{return res.json({games:await mlb.getUpcomingGames(14)})}catch(e){console.error(e);return res.status(502).json({error:"Upcoming games are temporarily unavailable."})}});
  app.get("/api/baseball/games/:id", async (req,res)=>{if(!/^\d+$/.test(req.params.id))return res.status(400).json({error:"Invalid game ID."});try{const game=await mlb.getGame(req.params.id);return game?res.json({game}):res.status(404).json({error:"Game not found."})}catch(e){console.error(e);return res.status(502).json({error:"Game details are temporarily unavailable."})}});
  app.get("/api/baseball/teams/:id", async (req,res)=>{if(!/^\d+$/.test(req.params.id))return res.status(400).json({error:"Invalid team ID."});try{const team=await mlb.getTeam(req.params.id);return team?res.json({team}):res.status(404).json({error:"Team not found."})}catch(e){console.error(e);return res.status(502).json({error:"Team statistics are temporarily unavailable."})}});
  app.get("/api/baseball/players", async (req,res)=>{const q=String(req.query.q??"").trim();if(q.length<2)return res.json({players:[]});try{const found=await mlb.search(q);return res.json({players:found.filter(i=>i.type==="player").map(i=>({id:i.id,name:i.name,team:i.subtitle.split(" · ")[0],position:i.subtitle.split(" · ")[1]}))})}catch(e){console.error(e);return res.status(502).json({error:"Player search is temporarily unavailable."})}});
  app.get("/api/baseball/players/:id", async (req,res)=>{if(!/^\d+$/.test(req.params.id))return res.status(400).json({error:"Invalid player ID."});try{const player=await mlb.getPlayer(req.params.id);return player?res.json({player}):res.status(404).json({error:"Player not found."})}catch(e){console.error(e);return res.status(502).json({error:"Player statistics are temporarily unavailable."})}});

  app.get(["/baseball", "/baseball/players", "/baseball/{*path}"], (_req,res)=>res.sendFile(page("baseball.html")));
  app.get(["/game", "/game/{*path}"], (_req,res)=>res.sendFile(page("game.html")));
  app.use("/vendor", express.static(path.join(directory,"../node_modules/phaser/dist")));
  app.use(express.static(path.join(directory,"../public")));
  app.get("/{*path}",(_req,res)=>res.sendFile(page("index.html")));
  return app;
}

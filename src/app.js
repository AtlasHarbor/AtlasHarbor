import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMlbClient } from "./mlb.js";
import { createLegalService } from "./legal.js";

const directory = path.dirname(fileURLToPath(import.meta.url));
const page = (name) => path.join(directory, `../public/${name}`);

export function createApp({ mlb = createMlbClient(), legal = createLegalService() } = {}) {
  const app = express();
  app.use(express.json({ limit: "32kb" }));

  app.get("/api/baseball/search", async (req,res)=>{const q=String(req.query.q??"").trim();if(q.length<2)return res.json({results:[]});try{return res.json({results:await mlb.search(q)})}catch(e){console.error(e);return res.status(502).json({error:"Baseball search is temporarily unavailable."})}});
  app.get("/api/baseball/games", async (_req,res)=>{try{return res.json({games:await mlb.getUpcomingGames(14)})}catch(e){console.error(e);return res.status(502).json({error:"Upcoming games are temporarily unavailable."})}});
  app.get("/api/baseball/games/:id", async (req,res)=>{if(!/^\d+$/.test(req.params.id))return res.status(400).json({error:"Invalid game ID."});try{const game=await mlb.getGame(req.params.id);return game?res.json({game}):res.status(404).json({error:"Game not found."})}catch(e){console.error(e);return res.status(502).json({error:"Game details are temporarily unavailable."})}});
  app.get("/api/baseball/teams/:id", async (req,res)=>{if(!/^\d+$/.test(req.params.id))return res.status(400).json({error:"Invalid team ID."});try{const team=await mlb.getTeam(req.params.id);return team?res.json({team}):res.status(404).json({error:"Team not found."})}catch(e){console.error(e);return res.status(502).json({error:"Team statistics are temporarily unavailable."})}});
  app.get("/api/baseball/players", async (req,res)=>{const q=String(req.query.q??"").trim();if(q.length<2)return res.json({players:[]});try{const found=await mlb.search(q);return res.json({players:found.filter(i=>i.type==="player").map(i=>({id:i.id,name:i.name,team:i.subtitle.split(" · ")[0],position:i.subtitle.split(" · ")[1]}))})}catch(e){console.error(e);return res.status(502).json({error:"Player search is temporarily unavailable."})}});
  app.get("/api/baseball/players/:id", async (req,res)=>{if(!/^\d+$/.test(req.params.id))return res.status(400).json({error:"Invalid player ID."});try{const player=await mlb.getPlayer(req.params.id);return player?res.json({player}):res.status(404).json({error:"Player not found."})}catch(e){console.error(e);return res.status(502).json({error:"Player statistics are temporarily unavailable."})}});

  app.get("/api/legal/cases", async (_req,res)=>{try{return res.json({cases:await legal.listCases()})}catch(e){console.error(e);return res.status(500).json({error:"Legal cases are temporarily unavailable."})}});
  app.get("/api/legal/cases/:slug", async (req,res)=>{try{const item=await legal.getCase(req.params.slug);return item?res.json(item):res.status(404).json({error:"Case not found."})}catch(e){console.error(e);return res.status(500).json({error:"Case record is temporarily unavailable."})}});
  app.post("/api/legal/cases/:slug/refresh", async (req,res)=>{if(!process.env.LEGAL_ADMIN_TOKEN||req.get("authorization")!==`Bearer ${process.env.LEGAL_ADMIN_TOKEN}`)return res.status(401).json({error:"Unauthorized."});try{const proposal=await legal.refreshCase(req.params.slug);return proposal?res.json({proposal}):res.status(404).json({error:"Case not found."})}catch(e){console.error(e);return res.status(502).json({error:e.message})}});

  app.get(["/baseball", "/baseball/players", "/baseball/{*path}"], (_req,res)=>res.sendFile(page("baseball.html")));
  app.get("/game/docs", (_req,res)=>res.sendFile(page("game-docs.html")));
  app.get(["/game", "/game/{*path}"], (_req,res)=>res.sendFile(page("game.html")));
  app.get(["/legal", "/legal/{*path}"], (_req,res)=>res.sendFile(page("legal.html")));
  app.get(["/blog", "/blog/{*path}"], (_req,res)=>res.sendFile(page("blog.html")));
  app.use("/vendor", express.static(path.join(directory,"../node_modules/phaser/dist")));
  app.use(express.static(path.join(directory,"../public")));
  app.get("/{*path}",(_req,res)=>res.sendFile(page("index.html")));
  return app;
}

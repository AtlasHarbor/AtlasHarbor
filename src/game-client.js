import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const directory=path.dirname(fileURLToPath(import.meta.url));
const gameClientPath=path.join(directory,'../public/game-v3.js');
let cached=null;

function protectRouteFallbacks(source){
 const oldFallback="function fallbackRoute(mode,from,to){const a=loc(from),b=loc(to);if(!a||!b)return{coordinates:[],distanceKm:0,source:'missing'};const coordinates=arc(from,to,mode==='air'?28:18);return{mode,from,to,coordinates,distanceKm:pathDistance(coordinates),source:'client-fallback'}}";
 const guardedFallback="function fallbackRoute(mode,from,to){const a=loc(from),b=loc(to);if(!a||!b)return{mode,from,to,coordinates:[],distanceKm:0,source:'missing'};if(mode!=='air')return{mode,from,to,coordinates:[],distanceKm:0,source:'route-unavailable'};const coordinates=arc(from,to,28);return{mode,from,to,coordinates,distanceKm:pathDistance(coordinates),source:'client-air-fallback'}}";
 const oldStep="function movementStep(movement){const km=Math.max(1,legDistance(movement)),hours=Math.max(1,km/(modes[movement.mode]?.networkKph||200));return 1/hours+(movement.speedBoost||0)}";
 const guardedStep="function movementStep(movement){const route=legRoute(movement);if(!route?.coordinates||route.coordinates.length<2||route.source==='route-unavailable')return 0;const km=Math.max(1,legDistance(movement)),hours=Math.max(1,km/(modes[movement.mode]?.networkKph||200));return 1/hours+(movement.speedBoost||0)}";
 const oldFleet="${bad?'Action required now':`ETA ${etaHours(movement)}h · ${movement.driver}`} · current leg ${leg}%";
 const guardedFleet="${bad?'Action required now':legRoute(movement).source==='route-unavailable'?'Route geometry unavailable':`ETA ${etaHours(movement)}h · ${movement.driver}`} · current leg ${leg}%";
 let protectedSource=source.replace("const ROUTE_CACHE_KEY='atlas-game-route-cache-v1';","const ROUTE_CACHE_KEY='atlas-game-route-cache-v2';");
 protectedSource=protectedSource.replace(oldFallback,guardedFallback).replace(oldStep,guardedStep).replace(oldFleet,guardedFleet);
 if(protectedSource.includes(oldFallback)||protectedSource.includes(oldStep)||protectedSource===source){
  throw new Error('The logistics client route guard no longer matches public/game-v3.js. Refusing to serve an unguarded route fallback.');
 }
 return protectedSource;
}

export function createGameClientRouter(){
 const router=express.Router();
 router.get('/game-v3.js',async(_req,res)=>{
  try{
   if(!cached)cached=protectRouteFallbacks(await fs.readFile(gameClientPath,'utf8'));
   res.set('Cache-Control','public,max-age=60,stale-while-revalidate=300');
   return res.type('application/javascript').send(cached);
  }catch(error){
   console.error('Could not serve guarded logistics client:',error);
   return res.status(500).type('text/plain').send('The logistics client could not be loaded safely.');
  }
 });
 return router;
}

export{protectRouteFallbacks};

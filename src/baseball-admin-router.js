import express from 'express';
import crypto from 'node:crypto';
import {buildIdealFantasyLineup} from './baseball-fantasy.js';

const MLB_BASE='https://statsapi.mlb.com/api/v1';
const LEVELS={
 mlb:{sportId:1,label:'MLB'},
 aaa:{sportId:11,label:'Triple-A'},
 aa:{sportId:12,label:'Double-A'},
 higha:{sportId:13,label:'High-A'},
 lowa:{sportId:14,label:'Low-A'}
};
const ALL_SPORT_IDS=Object.values(LEVELS).map(item=>item.sportId);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const scrypt=(password,salt)=>new Promise((resolve,reject)=>crypto.scrypt(password,salt,64,(error,key)=>error?reject(error):resolve(key.toString('hex'))));

function scopeSportIds(scope){
 if(scope==='all')return ALL_SPORT_IDS;
 const level=LEVELS[scope];
 return level?[level.sportId]:[];
}
function publicJob(job){
 if(!job)return null;
 const {origin,...safe}=job;
 return safe;
}
function playerAnalyses(current,playerIds=null){
 const notes=current?.user_metadata?.atlas_problem_spaces?.publishing_workspace?.notes||[],allowed=playerIds?new Set([...playerIds].map(String)):null;
 return notes.filter(item=>item?.resource_type==='baseball_player'&&String(item?.user_id||current?.id)===String(current?.id)&&(!allowed||allowed.has(String(item?.resource_id||''))));
}
async function responseJson(response){
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||data.message||`Request failed (${response.status}).`);
 return data;
}

export function createBaseballAdminRouter({env=process.env,fetchImpl=globalThis.fetch,playerStore}={}){
 const router=express.Router(),jobs=new Map();
 const base=String(env.SUPABASE_URL||'').replace(/\/$/,''),key=env.SUPABASE_PUBLISHABLE_KEY;
 let activeJobId=null;

 async function currentUser(req){
  const token=String(req.get('authorization')||'').replace(/^Bearer\s+/i,'');
  if(!base||!key||!token)return null;
  const response=await fetchImpl(`${base}/auth/v1/user`,{headers:{apikey:key,Authorization:`Bearer ${token}`,Accept:'application/json'},signal:AbortSignal.timeout(12000)});
  return response.ok?response.json():null;
 }
 async function verifyAdmin(req){
  const current=await currentUser(req);
  if(!current)throw Object.assign(new Error('Sign in required.'),{status:401});
  const config=current.user_metadata?.atlas_admin,role=config?.roles?.[current.id];
  if(!config||!role)throw Object.assign(new Error('Administrator required.'),{status:403});
  const provided=String(req.get('x-admin-password')||'');
  if(!provided)throw Object.assign(new Error('Admin password required.'),{status:401});
  const hash=await scrypt(provided,config.passwordSalt);
  if(hash!==config.passwordHash)throw Object.assign(new Error('Invalid admin password.'),{status:401});
  return{current,role};
 }
 const route=handler=>async(req,res)=>{try{const auth=await verifyAdmin(req);await handler(req,res,auth)}catch(error){console.error(error);res.status(error.status||500).json({error:error.message||'Baseball admin request failed.'})}};

 async function mlb(path,timeout=30000){
  const response=await fetchImpl(`${MLB_BASE}${path}`,{headers:{Accept:'application/json','User-Agent':'AtlasHarbor/1.0'},signal:AbortSignal.timeout(timeout)});
  if(!response.ok)throw new Error(`MLB Stats API ${response.status}`);
  return response.json();
 }
 async function rosterForTeam(team,season){
  const hydrated=team?.roster?.roster||team?.roster;
  if(Array.isArray(hydrated)&&hydrated.length)return hydrated;
  const data=await mlb(`/teams/${team.id}/roster?season=${season}`);
  return data.roster||[];
 }
 async function discoverPlayers(sportIds){
  const season=new Date().getUTCFullYear(),players=new Map();
  for(const sportId of sportIds){
   const data=await mlb(`/teams?sportId=${sportId}&season=${season}&hydrate=roster`);
   for(const team of data.teams||[]){
    const roster=await rosterForTeam(team,season);
    for(const entry of roster){
     const person=entry.person;if(!person?.id)continue;
     players.set(Number(person.id),{id:Number(person.id),name:person.fullName||`Player ${person.id}`,teamId:team.id,teamName:team.name,sportId});
    }
   }
  }
  return[...players.values()];
 }
 async function persistJob(job){
  jobs.set(job.id,job);
  if(!playerStore?.configured)return;
  const row={
   id:job.id,
   scope:job.scope,
   sport_ids:job.sportIds,
   status:job.status,
   total_players:job.totalPlayers,
   completed_players:job.completedPlayers,
   failed_players:job.failedPlayers,
   current_player_id:job.currentPlayerId,
   current_player_name:job.currentPlayerName,
   errors:job.errors,
   cancel_requested:Boolean(job.cancelRequested),
   created_at:job.createdAt,
   started_at:job.startedAt,
   completed_at:job.completedAt
  };
  try{
   const existing=await playerStore.getJob(job.id);
   if(existing)await playerStore.updateJob(job.id,row);
   else await playerStore.createJob(row);
  }catch(error){job.persistenceError=error.message}
 }
 async function runJob(job){
  activeJobId=job.id;
  job.status='discovering';job.startedAt=new Date().toISOString();await persistJob(job);
  try{
   const roster=await discoverPlayers(job.sportIds);
   job.totalPlayers=roster.length;job.status='running';await persistJob(job);
   const delay=Math.max(100,Math.min(5000,Number(env.BASEBALL_REFRESH_DELAY_MS)||450));
   for(const entry of roster){
    if(job.cancelRequested){job.status='canceled';break}
    job.currentPlayerId=entry.id;job.currentPlayerName=entry.name;await persistJob(job);
    try{
     const response=await fetchImpl(`${job.origin}/api/baseball/prospect-players/${entry.id}`,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(90000)});
     const data=await responseJson(response),player=data.player;
     if(!player?.id)throw new Error('Player endpoint returned no player payload.');
     await playerStore.upsertPlayer(player,{source:'admin-bulk',jobId:job.id});
     job.completedPlayers+=1;
    }catch(error){
     job.failedPlayers+=1;
     job.errors=[...job.errors,{playerId:entry.id,name:entry.name,error:error.message,at:new Date().toISOString()}].slice(-25);
    }
    await persistJob(job);
    await sleep(delay);
   }
   if(job.status!=='canceled')job.status='completed';
  }catch(error){job.status='failed';job.errors=[...job.errors,{error:error.message,at:new Date().toISOString()}].slice(-25)}
  finally{
   job.currentPlayerId=null;job.currentPlayerName=null;job.completedAt=new Date().toISOString();await persistJob(job);if(activeJobId===job.id)activeJobId=null;
  }
 }
 function startJob(scope,origin){
  if(activeJobId&&jobs.get(activeJobId)?.status&&['discovering','running','queued'].includes(jobs.get(activeJobId).status))throw Object.assign(new Error('A Baseball refresh job is already running.'),{status:409});
  const sportIds=scopeSportIds(scope);if(!sportIds.length)throw Object.assign(new Error('Choose MLB, Triple-A, Double-A, High-A, Low-A, or all.'),{status:400});
  const job={id:`bb-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`,scope,sportIds,status:'queued',totalPlayers:0,completedPlayers:0,failedPlayers:0,currentPlayerId:null,currentPlayerName:null,errors:[],cancelRequested:false,createdAt:new Date().toISOString(),startedAt:null,completedAt:null,origin};
  jobs.set(job.id,job);activeJobId=job.id;
  return job;
 }

 router.get('/api/admin/baseball/status',route(async(_req,res)=>{
  const database=await playerStore.summary();
  let recent=[];try{recent=await playerStore.recentJobs(8)}catch{}
  const active=activeJobId?jobs.get(activeJobId):null;
  res.set('Cache-Control','no-store');
  res.json({database,activeJob:publicJob(active),recentJobs:recent});
 }));
 router.post('/api/admin/baseball/refresh',route(async(req,res)=>{
  const schema=await playerStore.schemaStatus();
  if(!schema.ready)throw Object.assign(new Error(`Baseball database is not ready. Apply supabase/baseball-player-database.sql first. ${schema.error||''}`.trim()),{status:503});
  const scope=String(req.body?.scope||'').toLowerCase(),origin=(env.PUBLIC_APP_URL||`${req.protocol}://${req.get('host')}`).replace(/\/$/,'');
  const job=startJob(scope,origin);
  await persistJob(job);
  setTimeout(()=>runJob(job),0);
  res.status(202).json({job:publicJob(job)});
 }));
 router.get('/api/admin/baseball/jobs/:id',route(async(req,res)=>{
  let job=jobs.get(req.params.id);if(!job)job=await playerStore.getJob(req.params.id);
  if(!job)return res.status(404).json({error:'Baseball refresh job not found.'});
  res.set('Cache-Control','no-store');res.json({job:publicJob(job)});
 }));
 router.post('/api/admin/baseball/jobs/:id/cancel',route(async(req,res)=>{
  const job=jobs.get(req.params.id);if(!job)return res.status(404).json({error:'Only an in-process Baseball refresh job can be canceled.'});
  job.cancelRequested=true;await persistJob(job);res.json({job:publicJob(job)});
 }));
 router.get('/api/admin/baseball/export',route(async(req,res,{current})=>{
  const sportId=req.query.sportId?Number(req.query.sportId):null,teamId=req.query.teamId?Number(req.query.teamId):null;
  const rows=await playerStore.listPlayers({sportId,teamId,limit:10000}),players=rows.map(row=>row.snapshot).filter(Boolean),playerIds=new Set(players.map(player=>String(player.id)));
  const myPlayerAnalyses=playerAnalyses(current,playerIds),analysisByPlayerId=Object.fromEntries(myPlayerAnalyses.map(note=>[String(note.resource_id),note]));
  res.set('Cache-Control','no-store');res.set('Content-Disposition',`attachment; filename="atlas-baseball-player-database-${new Date().toISOString().slice(0,10)}.json"`);
  res.json({schemaVersion:2,exportedAt:new Date().toISOString(),count:players.length,filters:{sportId,teamId},players,myPlayerAnalyses,analysisByPlayerId});
 }));
 router.get('/api/admin/baseball/fantasy/lineup',route(async(req,res)=>{
  const sportId=req.query.sportId?Number(req.query.sportId):1,teamId=req.query.teamId?Number(req.query.teamId):null,games=Math.max(3,Math.min(12,Number(req.query.games)||8));
  const rows=await playerStore.listPlayers({sportId,teamId,limit:10000}),players=rows.map(row=>row.snapshot).filter(Boolean);
  res.set('Cache-Control','no-store');res.json({poolSize:players.length,filters:{sportId,teamId,games},lineup:buildIdealFantasyLineup(players,{games})});
 }));
 return router;
}

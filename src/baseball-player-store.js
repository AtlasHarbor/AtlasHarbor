import {supabaseSecretKey,supabaseServiceHeaders} from './supabase-server-key.js';

const PLAYER_TABLE='baseball_player_snapshots';
const JOB_TABLE='baseball_refresh_jobs';

function schemaError(error){
 const message=String(error?.message||'');
 return /42P01|PGRST205|Could not find the table|relation .* does not exist/i.test(message);
}

async function readJson(response){
 const text=typeof response?.text==='function'?await response.text():'';
 let data=null;
 try{data=text?JSON.parse(text):null}catch{data=text}
 if(!response?.ok){
  const message=data?.message||data?.error||data?.hint||text||`Request failed (${response?.status||'unknown'}).`;
  const error=new Error(message);
  error.status=response?.status||500;
  error.code=data?.code||null;
  if(schemaError(error)){error.code='BASEBALL_SCHEMA_MISSING';error.status=503}
  throw error;
 }
 return data;
}

export function createBaseballPlayerStore({env=process.env,fetchImpl=globalThis.fetch}={}){
 const base=String(env.SUPABASE_URL||'').replace(/\/$/,''),secret=supabaseSecretKey(env);
 const configured=Boolean(base&&secret);
 const headers=(extra={})=>({...supabaseServiceHeaders(secret),Accept:'application/json',...extra});
 const endpoint=(table,query='')=>`${base}/rest/v1/${table}${query?`?${query}`:''}`;
 const requireConfigured=()=>{if(!configured)throw Object.assign(new Error('Baseball database persistence is not configured.'),{status:503,code:'BASEBALL_DB_NOT_CONFIGURED'})};

 async function request(table,{query='',method='GET',body,prefer,headers:extraHeaders={}}={}){
  requireConfigured();
  const response=await fetchImpl(endpoint(table,query),{
   method,
   headers:headers({...extraHeaders,...(prefer?{Prefer:prefer}:{})}),
   ...(body===undefined?{}:{body:JSON.stringify(body)}),
   signal:AbortSignal.timeout(20000)
  });
  return readJson(response);
 }

 async function schemaStatus(){
  if(!configured)return{configured:false,ready:false,error:'Supabase server persistence is not configured.'};
  try{
   await request(PLAYER_TABLE,{query:'select=player_id&limit=1'});
   await request(JOB_TABLE,{query:'select=id&limit=1'});
   return{configured:true,ready:true,error:null};
  }catch(error){return{configured:true,ready:false,error:error.message,code:error.code||null}}
 }

 async function upsertPlayer(player,{source='player-page',jobId=null}={}){
  if(!player?.id)throw new Error('Player snapshot requires an MLB player id.');
  const now=new Date().toISOString();
  const row={
   player_id:Number(player.id),
   name:String(player.name||''),
   team_id:player.teamId==null?null:Number(player.teamId),
   team_name:player.team||null,
   parent_org_id:player.parentOrgId==null?null:Number(player.parentOrgId),
   sport_id:player.sportId==null?null:Number(player.sportId),
   level:player.level||null,
   position:player.position||null,
   snapshot:player,
   refresh_source:source,
   refresh_job_id:jobId,
   source_updated_at:now,
   refreshed_at:now
  };
  const rows=await request(PLAYER_TABLE,{method:'POST',query:'on_conflict=player_id',body:[row],prefer:'resolution=merge-duplicates,return=representation'});
  return rows?.[0]||row;
 }

 async function getPlayer(playerId){
  const rows=await request(PLAYER_TABLE,{query:`player_id=eq.${encodeURIComponent(playerId)}&select=*&limit=1`});
  return rows?.[0]||null;
 }

 async function listPlayers({sportId=null,teamId=null,limit=5000}={}){
  const all=[];let offset=0;const pageSize=Math.min(500,Math.max(1,Number(limit)||5000));
  while(all.length<limit){
   const filters=['select=*'];
   if(sportId!=null)filters.push(`sport_id=eq.${encodeURIComponent(sportId)}`);
   if(teamId!=null)filters.push(`team_id=eq.${encodeURIComponent(teamId)}`);
   filters.push('order=player_id.asc',`limit=${Math.min(pageSize,limit-all.length)}`,`offset=${offset}`);
   const rows=await request(PLAYER_TABLE,{query:filters.join('&')});
   all.push(...(rows||[]));
   if(!rows||rows.length<pageSize)break;
   offset+=rows.length;
  }
  return all;
 }

 async function countPlayers({sportId=null}={}){
  requireConfigured();
  const filters=['select=player_id'];if(sportId!=null)filters.push(`sport_id=eq.${encodeURIComponent(sportId)}`);
  const response=await fetchImpl(endpoint(PLAYER_TABLE,filters.join('&')),{method:'HEAD',headers:headers({Prefer:'count=exact',Range:'0-0'}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)await readJson(response);
  const range=response.headers?.get?.('content-range')||'';
  const total=Number(range.split('/')[1]);
  return Number.isFinite(total)?total:0;
 }

 async function summary(){
  const status=await schemaStatus();if(!status.ready)return{...status,total:0,bySport:{}};
  const sportIds=[1,11,12,13,14],bySport={};
  const counts=await Promise.all(sportIds.map(async id=>[id,await countPlayers({sportId:id})]));
  for(const[id,count]of counts)bySport[id]=count;
  return{...status,total:await countPlayers(),bySport};
 }

 async function createJob(job){
  const rows=await request(JOB_TABLE,{method:'POST',body:[job],prefer:'return=representation'});
  return rows?.[0]||job;
 }
 async function updateJob(id,patch){
  const rows=await request(JOB_TABLE,{method:'PATCH',query:`id=eq.${encodeURIComponent(id)}`,body:{...patch,updated_at:new Date().toISOString()},prefer:'return=representation'});
  return rows?.[0]||null;
 }
 async function getJob(id){
  const rows=await request(JOB_TABLE,{query:`id=eq.${encodeURIComponent(id)}&select=*&limit=1`});
  return rows?.[0]||null;
 }
 async function recentJobs(limit=10){
  return request(JOB_TABLE,{query:`select=*&order=created_at.desc&limit=${Math.max(1,Math.min(50,Number(limit)||10))}`});
 }

 return{configured,schemaStatus,upsertPlayer,getPlayer,listPlayers,countPlayers,summary,createJob,updateJob,getJob,recentJobs};
}

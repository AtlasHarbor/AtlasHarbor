import fs from'node:fs';
import path from'node:path';

const envPath=path.resolve(process.cwd(),'.env');
if(fs.existsSync(envPath))for(const raw of fs.readFileSync(envPath,'utf8').split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith('#'))continue;const i=line.indexOf('=');if(i<1)continue;const key=line.slice(0,i).trim();let value=line.slice(i+1).trim();if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);if(!(key in process.env))process.env[key]=value}

const app=String(process.env.PUBLIC_APP_URL||'http://localhost:3000').replace(/\/$/,''),email=String(process.env.ATLAS_E2E_TEST_EMAIL||'').trim(),password=String(process.env.ATLAS_E2E_TEST_PASSWORD||''),playerId=String(process.env.ATLAS_E2E_BASEBALL_PLAYER_ID||'695491');
if(!email||!password)throw new Error('Set ATLAS_E2E_TEST_EMAIL and ATLAS_E2E_TEST_PASSWORD before running npm run test:auth.');
const read=async response=>{const text=await response.text();let data={};try{data=text?JSON.parse(text):{}}catch{}if(!response.ok)throw new Error(`${response.url} -> ${response.status}: ${data.error||data.message||text}`);return data};
const config=await read(await fetch(`${app}/api/config`,{headers:{Accept:'application/json'}}));
if(!config.supabaseUrl||!config.supabasePublishableKey)throw new Error('Public Supabase configuration is unavailable.');
const auth=await read(await fetch(`${String(config.supabaseUrl).replace(/\/$/,'')}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:config.supabasePublishableKey,'Content-Type':'application/json'},body:JSON.stringify({email,password})})),token=auth.access_token;
if(!token)throw new Error('Test login returned no access token.');
const authHeaders={Accept:'application/json',Authorization:`Bearer ${token}`};
const status=await read(await fetch(`${app}/api/workspaces/status`,{headers:authHeaders,cache:'no-store'}));
if(!status.signedIn)throw new Error('Workspace status did not recognize the E2E account.');
const resource=`${app}/api/workspaces/baseball_player/${encodeURIComponent(playerId)}`,now=new Date().toISOString(),saved=await read(await fetch(resource,{method:'PUT',headers:{...authHeaders,'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({intent:'publish',resource_title:`E2E Baseball player ${playerId}`,title:`E2E Baseball workspace ${playerId}`,body:`<p>Authenticated REST regression check ${now}</p>`,projections:[],is_shared:true,share_ai_analysis:true})}));
if(!saved.workspace?.id||!saved.workspace?.share_token)throw new Error('Workspace save/publish returned no canonical workspace or share token.');
const loaded=await read(await fetch(resource,{headers:authHeaders,cache:'no-store'}));
if(loaded.workspace?.id!==saved.workspace.id)throw new Error('Workspace read did not return the record just saved.');
const detail=`${app}/api/published-feed/${encodeURIComponent(saved.workspace.share_token)}`,anonymous=await read(await fetch(detail,{headers:{Accept:'application/json'},cache:'no-store'})),authenticated=await read(await fetch(detail,{headers:authHeaders,cache:'no-store'}));
if(anonymous.publication?.id!==saved.workspace.id||authenticated.publication?.id!==saved.workspace.id)throw new Error('Publication detail differs between anonymous and signed-in reads.');
console.log(JSON.stringify({ok:true,app,email,playerId,workspace:{id:saved.workspace.id,storage:saved.storage,shareToken:saved.workspace.share_token},publication:{anonymous:true,authenticated:true,title:anonymous.publication.title},workspaceStatus:status},null,2));

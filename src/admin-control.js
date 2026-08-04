import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {runAIHealthCheck,runEconomicsNow} from './admin-runs.js';

const defaultAI={primaryEndpoint:'https://openrouter.ai/api/v1',primaryModel:'openrouter/auto',backupEndpoint:'',backupModel:'',primaryKeyCiphertext:null,backupKeyCiphertext:null,instructionSet:'Score public submissions for originality, evidence, clarity, usefulness, and meaningful human-AI collaboration. Penalize spam, copied boilerplate, unsupported certainty, and low-effort repetition.',cadenceMinutes:10,monthlyBudgetUsd:25,spentThisMonthUsd:0,enabled:false,lastRunAt:null,lastError:null};
const defaultEconomics={source_name:'Financial Times',source_url:'',source_type:'rss',cadence_hours:12,max_items:20,ai_instruction:'Convert each economic story into a clear decision problem with stakeholders, constraints, tradeoffs, questions, and relevant topics.',enabled:false,last_run_at:null,last_error:null,last_result:null};
const JSON_HEADERS={'Content-Type':'application/json'};
const scrypt=(password,salt)=>new Promise((resolve,reject)=>crypto.scrypt(password,salt,64,(error,key)=>error?reject(error):resolve(key.toString('hex'))));
const b64=value=>Buffer.from(value).toString('base64url');
const unb64=value=>Buffer.from(value,'base64url');

function keyFor(env){return crypto.createHash('sha256').update(env.ADMIN_ENCRYPTION_KEY||env.SUPABASE_SECRET_KEY||'atlas-harbor-admin-key').digest()}
function encrypt(secret,env){if(!secret)return null;const key=keyFor(env),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv),body=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]),tag=cipher.getAuthTag();return`${b64(iv)}.${b64(tag)}.${b64(body)}`}
function decrypt(value,env){if(!value)return null;const[iv,tag,body]=value.split('.').map(unb64),decipher=crypto.createDecipheriv('aes-256-gcm',keyFor(env),iv);decipher.setAuthTag(tag);return Buffer.concat([decipher.update(body),decipher.final()]).toString('utf8')}
async function parse(response){response=await response;if(!response||typeof response.text!=='function')throw new TypeError('The request did not return a readable HTTP response.');const text=await response.text();let data=null;try{data=text?JSON.parse(text):null}catch{}if(!response.ok){const error=new Error(data?.message||data?.error||text||`Request failed (${response.status})`);error.status=response.status;throw error}return data}

function createSupabaseStore(env,fetchImpl){
 const configured=Boolean(env.SUPABASE_URL&&env.SUPABASE_PUBLISHABLE_KEY);
 const base=env.SUPABASE_URL;
 const apikey=env.SUPABASE_PUBLISHABLE_KEY;
 const legacyFile=path.resolve(env.ADMIN_STORE_PATH||'data/runtime/admin.json');
 const authUser=async token=>{if(!configured||!token)return null;const response=await fetchImpl(`${base}/auth/v1/user`,{headers:{apikey,Authorization:`Bearer ${token}`}});return response.ok?response.json():null};
 const userHeaders=token=>({apikey,Authorization:`Bearer ${token}`,...JSON_HEADERS});
 async function readForUser(token,userId){
  const response=await fetchImpl(`${base}/rest/v1/game_progress?user_id=eq.${encodeURIComponent(userId)}&select=state&limit=1`,{headers:userHeaders(token)});
  const rows=await parse(response);return rows?.[0]?.state?.__atlasAdmin||null;
 }
 async function writeForUser(token,userId,config){
  const response=await fetchImpl(`${base}/rest/v1/game_progress?user_id=eq.${encodeURIComponent(userId)}&select=state&limit=1`,{headers:userHeaders(token)});
  const rows=await parse(response),state={...(rows?.[0]?.state||{}),__atlasAdmin:config};
  await parse(fetchImpl(`${base}/rest/v1/game_progress`,{method:'POST',headers:{...userHeaders(token),Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:userId,state,updated_at:new Date().toISOString()})}));
  return config;
 }
 async function readLegacyFile(){try{return JSON.parse(await fs.readFile(legacyFile,'utf8'))}catch(error){if(error.code==='ENOENT')return null;throw error}}
 async function removeLegacyFile(){await fs.unlink(legacyFile).catch(()=>{})}
 async function listUsers(current){
  if(!env.SUPABASE_SECRET_KEY)return current?[current]:[];
  const response=await fetchImpl(`${base}/auth/v1/admin/users?per_page=1000`,{headers:{apikey:env.SUPABASE_SECRET_KEY,Authorization:`Bearer ${env.SUPABASE_SECRET_KEY}`}});
  if(!response.ok)return current?[current]:[];
  return (await response.json()).users||[];
 }
 return{configured,authUser,readForUser,writeForUser,readLegacyFile,removeLegacyFile,listUsers};
}

export function createAdminControl({env=process.env,fetchImpl=globalThis.fetch}={}){
 const router=express.Router(),store=createSupabaseStore(env,fetchImpl);let qualityTimer=null,economicsTimer=null,cachedOwner=null,cachedToken=null;
 const bearer=req=>String(req.get('authorization')||'').replace(/^Bearer\s+/i,'');
 const route=handler=>async(req,res)=>{try{await handler(req,res)}catch(error){console.error(error);res.status(error.status||500).json({error:error.message||'Admin request failed.'})}};
 async function loadForCurrent(req,{migrate=true}={}){
  const token=bearer(req),current=await store.authUser(token);if(!current)throw Object.assign(new Error('Sign in required.'),{status:401});
  let config=await store.readForUser(token,current.id);
  if(!config&&migrate){const legacy=await store.readLegacyFile();if(legacy){config=legacy;await store.writeForUser(token,current.id,config);await store.removeLegacyFile()}}
  if(config){cachedOwner=current.id;cachedToken=token}
  return{token,current,config};
 }
 async function verify(req,{master=false,password=true}={}){
  const loaded=await loadForCurrent(req);if(!loaded.config)throw Object.assign(new Error('Administrator has not been initialized.'),{status:409});
  const role=loaded.config.roles?.[loaded.current.id];if(!role||master&&role!=='master_admin')throw Object.assign(new Error(master?'Master administrator required.':'Administrator required.'),{status:403});
  if(password){const provided=String(req.get('x-admin-password')||req.body?.adminPassword||'');if(!provided)throw Object.assign(new Error('Admin password required.'),{status:401});const hash=await scrypt(provided,loaded.config.passwordSalt);if(hash!==loaded.config.passwordHash)throw Object.assign(new Error('Invalid admin password.'),{status:401})}
  return{...loaded,role};
 }
 const save=async(token,userId,config)=>{cachedOwner=userId;cachedToken=token;return store.writeForUser(token,userId,{...config,updatedAt:new Date().toISOString()})};
 const providers=ai=>[{name:'primary',endpoint:ai.primaryEndpoint,model:ai.primaryModel,key:decrypt(ai.primaryKeyCiphertext,env)},{name:'backup',endpoint:ai.backupEndpoint,model:ai.backupModel,key:decrypt(ai.backupKeyCiphertext,env)}];

 router.get('/api/admin/bootstrap-status',route(async(req,res)=>{if(!store.configured)return res.status(503).json({error:'The same Supabase configuration used by account login is not available to the server.'});const{current,config}=await loadForCurrent(req);res.json({initialized:Boolean(config),signedIn:true,role:config?.roles?.[current.id]||null,encryptionConfigured:true,storage:'supabase-game-progress'})}));
 router.post('/api/admin/bootstrap',route(async(req,res)=>{const{token,current,config}=await loadForCurrent(req);if(config)throw Object.assign(new Error('The administrator has already been initialized.'),{status:409});const password=String(req.body?.password||''),repeat=String(req.body?.repeatPassword||'');if(password.length<12)throw Object.assign(new Error('Use an admin password of at least 12 characters.'),{status:400});if(password!==repeat)throw Object.assign(new Error('The passwords do not match.'),{status:400});const salt=crypto.randomBytes(24).toString('hex'),hash=await scrypt(password,salt),now=new Date().toISOString();await save(token,current.id,{masterUserId:current.id,passwordHash:hash,passwordSalt:salt,roles:{[current.id]:'master_admin'},ai:{...defaultAI},economics:{...defaultEconomics},initializedAt:now,updatedAt:now});res.json({ok:true,role:'master_admin'})}));
 router.get('/api/admin/dashboard',route(async(req,res)=>{const{token,current,role,config}=await verify(req),users=await store.listUsers(current),roles=config.roles||{},ai={...defaultAI,...config.ai};cachedToken=token;res.json({role,masterUserId:config.masterUserId,users:users.map(u=>({id:u.id,email:u.email,createdAt:u.created_at,lastSignInAt:u.last_sign_in_at,role:roles[u.id]||null})),ai:{...ai,primaryKeyConfigured:Boolean(ai.primaryKeyCiphertext),backupKeyConfigured:Boolean(ai.backupKeyCiphertext),primaryKey:decrypt(ai.primaryKeyCiphertext,env)||'',backupKey:decrypt(ai.backupKeyCiphertext,env)||''}})}));
 router.patch('/api/admin/users/:id/role',route(async(req,res)=>{const{token,current,config}=await verify(req,{master:true}),target=req.params.id;if(target===current.id)throw Object.assign(new Error('Transfer master ownership before changing your own role.'),{status:400});const roles={...(config.roles||{})};if(req.body?.role==='admin')roles[target]='admin';else delete roles[target];await save(token,current.id,{...config,roles});res.json({ok:true})}));
 router.post('/api/admin/transfer-master',route(async(req,res)=>{throw Object.assign(new Error('Master transfer requires a dedicated shared admin table and is temporarily disabled while using persistent user-owned storage.'),{status:501})}));
 router.put('/api/admin/global-ai',route(async(req,res)=>{const{token,current,config}=await verify(req),body=req.body||{},old={...defaultAI,...config.ai},ai={...old,primaryEndpoint:String(body.primaryEndpoint||'https://openrouter.ai/api/v1').replace(/\/$/,''),primaryModel:String(body.primaryModel||'openrouter/auto'),primaryKeyCiphertext:body.primaryKey?encrypt(String(body.primaryKey),env):old.primaryKeyCiphertext,backupEndpoint:String(body.backupEndpoint||'').replace(/\/$/,''),backupModel:String(body.backupModel||''),backupKeyCiphertext:body.backupKey?encrypt(String(body.backupKey),env):old.backupKeyCiphertext,instructionSet:String(body.instructionSet||'').slice(0,12000),cadenceMinutes:Math.max(5,Math.min(1440,Number(body.cadenceMinutes)||10)),monthlyBudgetUsd:Math.max(0,Number(body.monthlyBudgetUsd)||0),enabled:Boolean(body.enabled)};await save(token,current.id,{...config,ai});await schedule();res.json({ok:true})}));
 router.get('/api/admin/economics/settings',route(async(req,res)=>{const{config}=await verify(req);res.json({settings:{...defaultEconomics,...config.economics}})}));
 router.put('/api/admin/economics/settings',route(async(req,res)=>{const{token,current,config}=await verify(req),b=req.body||{},old={...defaultEconomics,...config.economics},economics={...old,source_name:String(b.sourceName||'Financial Times'),source_url:String(b.sourceUrl||''),source_type:String(b.sourceType||'rss'),cadence_hours:Math.max(1,Math.min(168,Number(b.cadenceHours)||12)),max_items:Math.max(1,Math.min(50,Number(b.maxItems)||20)),ai_instruction:String(b.aiInstruction||defaultEconomics.ai_instruction),enabled:Boolean(b.enabled),last_error:null};await save(token,current.id,{...config,economics});await schedule();res.json({ok:true})}));
 router.post('/api/admin/run-quality',route(async(req,res)=>{const{token,current,config}=await verify(req),ai={...defaultAI,...config.ai};const result=await runAIHealthCheck({fetchImpl,providers:providers(ai)});await save(token,current.id,{...config,ai:{...ai,lastRunAt:new Date().toISOString(),lastError:result.ok?null:result.reason,lastRunResult:result}});res.json(result)}));
 router.post('/api/admin/economics/run',route(async(req,res)=>{const{token,current,config}=await verify(req),ai={...defaultAI,...config.ai},economics={...defaultEconomics,...config.economics};let result;try{result=await runEconomicsNow({fetchImpl,settings:economics,providers:providers(ai),instruction:economics.ai_instruction})}catch(error){result={ok:false,reason:error.message,fetched:0,converted:0,skipped:0,elapsedMs:0}}await save(token,current.id,{...config,economics:{...economics,last_run_at:new Date().toISOString(),last_error:result.ok?result.lastError:result.reason,last_result:{...result,problems:result.problems?.slice(0,20)||[]}}});res.json(result)}));
 router.post('/api/views',(_req,res)=>res.status(204).end());
 router.get('/api/featured',(_req,res)=>res.json({featured:[]}));

 async function schedule(){if(qualityTimer)clearInterval(qualityTimer);if(economicsTimer)clearInterval(economicsTimer);if(!cachedToken||!cachedOwner)return;const config=await store.readForUser(cachedToken,cachedOwner).catch(()=>null);if(!config)return;const ai={...defaultAI,...config.ai},economics={...defaultEconomics,...config.economics};if(ai.enabled){qualityTimer=setInterval(async()=>{const latest=await store.readForUser(cachedToken,cachedOwner).catch(()=>null);if(!latest)return;const currentAI={...defaultAI,...latest.ai},result=await runAIHealthCheck({fetchImpl,providers:providers(currentAI)});await save(cachedToken,cachedOwner,{...latest,ai:{...currentAI,lastRunAt:new Date().toISOString(),lastError:result.ok?null:result.reason,lastRunResult:result}})},Math.max(5,ai.cadenceMinutes)*60000);qualityTimer.unref?.()}if(economics.enabled){economicsTimer=setInterval(async()=>{const latest=await store.readForUser(cachedToken,cachedOwner).catch(()=>null);if(!latest)return;const currentAI={...defaultAI,...latest.ai},currentEconomics={...defaultEconomics,...latest.economics};try{const result=await runEconomicsNow({fetchImpl,settings:currentEconomics,providers:providers(currentAI),instruction:currentEconomics.ai_instruction});await save(cachedToken,cachedOwner,{...latest,economics:{...currentEconomics,last_run_at:new Date().toISOString(),last_error:result.lastError,last_result:{...result,problems:result.problems?.slice(0,20)||[]}}})}catch(error){await save(cachedToken,cachedOwner,{...latest,economics:{...currentEconomics,last_run_at:new Date().toISOString(),last_error:error.message}})}},Math.max(1,economics.cadence_hours)*3600000);economicsTimer.unref?.()}}
 return{router,runQualityCycle:async()=>({ok:false,reason:'Use /api/admin/run-quality'}),schedule};
}

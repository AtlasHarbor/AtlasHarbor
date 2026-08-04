import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {runAIHealthCheck,runEconomicsNow} from './admin-runs.js';

const JSON_HEADERS={'Content-Type':'application/json'};
const defaults={
 ai:{primaryEndpoint:'https://openrouter.ai/api/v1',primaryModel:'openrouter/auto',backupEndpoint:'',backupModel:'',primaryKeyCiphertext:null,backupKeyCiphertext:null,instructionSet:'Score public submissions for originality, evidence, clarity, usefulness, and meaningful human-AI collaboration. Penalize spam, copied boilerplate, unsupported certainty, and low-effort repetition.',cadenceMinutes:10,monthlyBudgetUsd:25,spentThisMonthUsd:0,enabled:false,lastRunAt:null,lastError:null},
 economics:{source_name:'Financial Times',source_url:'',source_type:'rss',cadence_hours:12,max_items:20,ai_instruction:'Convert each economic story into a clear decision problem with stakeholders, constraints, tradeoffs, questions, and relevant topics.',enabled:false,last_run_at:null,last_error:null,last_result:null}
};
const scrypt=(password,salt)=>new Promise((resolve,reject)=>crypto.scrypt(password,salt,64,(error,key)=>error?reject(error):resolve(key.toString('hex'))));
const parse=async response=>{response=await response;const text=typeof response?.text==='function'?await response.text():'';let data=null;try{data=text?JSON.parse(text):null}catch{}if(!response?.ok){const error=new Error(data?.error_description||data?.msg||data?.message||data?.error||text||`Request failed (${response?.status||'unknown'}).`);error.status=response?.status||500;throw error}return data};
function bearer(req){return String(req.get('authorization')||'').replace(/^Bearer\s+/i,'')}
function route(handler){return async(req,res)=>{try{await handler(req,res)}catch(error){console.error(error);res.status(error.status||500).json({error:error.message||'Admin request failed.'})}}}
function keyFrom(store){return crypto.createHash('sha256').update(store.passwordHash).digest()}
function encrypt(secret,store){if(!secret)return null;const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',keyFrom(store),iv),body=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]),tag=cipher.getAuthTag();return`${iv.toString('base64url')}.${tag.toString('base64url')}.${body.toString('base64url')}`}
function decrypt(value,store){if(!value)return'';const[iv,tag,body]=value.split('.').map(x=>Buffer.from(x,'base64url')),decipher=crypto.createDecipheriv('aes-256-gcm',keyFrom(store),iv);decipher.setAuthTag(tag);return Buffer.concat([decipher.update(body),decipher.final()]).toString('utf8')}

function createAccountStore(env,fetchImpl){
 const base=env.SUPABASE_URL,publishable=env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_SECRET_KEY;
 const configured=Boolean(base&&publishable);
 const headers=token=>({apikey:publishable,Authorization:`Bearer ${token}`,...JSON_HEADERS});
 async function user(token){if(!configured||!token)return null;const response=await fetchImpl(`${base}/auth/v1/user`,{headers:headers(token)});return response.ok?response.json():null}
 async function save(token,current,config){
  const existing=current.user_metadata||{};
  const updated=await parse(fetchImpl(`${base}/auth/v1/user`,{method:'PUT',headers:headers(token),body:JSON.stringify({data:{...existing,atlas_admin:config}})}));
  return updated?.user_metadata?.atlas_admin||config;
 }
 async function legacy(current){
  try{
   const response=await fetchImpl(`${base}/rest/v1/game_progress?user_id=eq.${encodeURIComponent(current.id)}&select=state&limit=1`,{headers:headers(current.__token)});
   if(!response.ok)return null;const rows=await response.json();return rows?.[0]?.state?.__atlasAdmin||null;
  }catch{return null}
 }
 async function legacyFile(){const file=path.resolve(env.ADMIN_STORE_PATH||'data/runtime/admin.json');try{return{file,config:JSON.parse(await fs.readFile(file,'utf8'))}}catch{return null}}
 async function listUsers(current){if(!env.SUPABASE_SECRET_KEY)return[current];try{const response=await fetchImpl(`${base}/auth/v1/admin/users?per_page=1000`,{headers:{apikey:env.SUPABASE_SECRET_KEY,Authorization:`Bearer ${env.SUPABASE_SECRET_KEY}`}});if(!response.ok)return[current];return(await response.json()).users||[current]}catch{return[current]}}
 return{configured,user,save,legacy,legacyFile,listUsers};
}

export function createLocalAdmin({env=process.env,fetchImpl=globalThis.fetch}={}){
 const router=express.Router(),account=createAccountStore(env,fetchImpl);
 async function load(req,{migrate=true}={}){
  const token=bearer(req);if(!token)throw Object.assign(new Error('Sign in required.'),{status:401});
  const current=await account.user(token);if(!current)throw Object.assign(new Error('Your sign-in session expired. Sign in again or refresh the page.'),{status:401});
  current.__token=token;
  let store=current.user_metadata?.atlas_admin||null;
  if(!store&&migrate){
   store=await account.legacy(current);
   if(!store){const old=await account.legacyFile();store=old?.config||null;if(store&&old?.file)await fs.unlink(old.file).catch(()=>{})}
   if(store)store=await account.save(token,current,store);
  }
  return{token,current,store};
 }
 async function verify(req,{master=false,password=true}={}){
  const loaded=await load(req);if(!loaded.store)throw Object.assign(new Error('Administrator has not been initialized.'),{status:409});
  const role=loaded.store.roles?.[loaded.current.id];if(!role||master&&role!=='master_admin')throw Object.assign(new Error(master?'Master administrator required.':'Administrator required.'),{status:403});
  if(password){const provided=String(req.get('x-admin-password')||req.body?.adminPassword||'');if(!provided)throw Object.assign(new Error('Admin password required.'),{status:401});const hash=await scrypt(provided,loaded.store.passwordSalt);if(hash!==loaded.store.passwordHash)throw Object.assign(new Error('Invalid admin password.'),{status:401})}
  return{...loaded,role};
 }
 const save=async(token,current,store)=>account.save(token,current,{...store,updatedAt:new Date().toISOString()});
 const providers=store=>{const ai={...defaults.ai,...store.ai};return[{name:'primary',endpoint:ai.primaryEndpoint,model:ai.primaryModel,key:decrypt(ai.primaryKeyCiphertext,store)},{name:'backup',endpoint:ai.backupEndpoint,model:ai.backupModel,key:decrypt(ai.backupKeyCiphertext,store)}]};

 router.get('/api/admin/bootstrap-status',route(async(req,res)=>{if(!account.configured)return res.status(503).json({error:'Account authentication is not configured on the server.'});const{current,store}=await load(req);res.json({initialized:Boolean(store),signedIn:true,role:store?.roles?.[current.id]||null,encryptionConfigured:true,storage:'supabase-user-metadata'})}));
 router.post('/api/admin/bootstrap',route(async(req,res)=>{const{token,current,store}=await load(req,{migrate:false});if(store)throw Object.assign(new Error('The administrator has already been initialized.'),{status:409});const password=String(req.body?.password||''),repeat=String(req.body?.repeatPassword||'');if(password.length<12)throw Object.assign(new Error('Use an admin password of at least 12 characters.'),{status:400});if(password!==repeat)throw Object.assign(new Error('The passwords do not match.'),{status:400});const passwordSalt=crypto.randomBytes(24).toString('hex'),passwordHash=await scrypt(password,passwordSalt),now=new Date().toISOString();await save(token,current,{masterUserId:current.id,passwordHash,passwordSalt,roles:{[current.id]:'master_admin'},ai:{...defaults.ai},economics:{...defaults.economics},initializedAt:now});res.json({ok:true,role:'master_admin'})}));
 router.get('/api/admin/dashboard',route(async(req,res)=>{const{current,role,store}=await verify(req),users=await account.listUsers(current),ai={...defaults.ai,...store.ai};res.json({role,masterUserId:store.masterUserId,users:users.map(u=>({id:u.id,email:u.email,createdAt:u.created_at,lastSignInAt:u.last_sign_in_at,role:store.roles?.[u.id]||null})),ai:{...ai,primaryKey:decrypt(ai.primaryKeyCiphertext,store),backupKey:decrypt(ai.backupKeyCiphertext,store),primaryKeyConfigured:Boolean(ai.primaryKeyCiphertext),backupKeyConfigured:Boolean(ai.backupKeyCiphertext)}})}));
 router.patch('/api/admin/users/:id/role',route(async(req,res)=>{const{token,current,store}=await verify(req,{master:true}),target=req.params.id;if(target===current.id)throw Object.assign(new Error('Transfer master ownership before changing your own role.'),{status:400});const roles={...(store.roles||{})};if(req.body?.role==='admin')roles[target]='admin';else delete roles[target];await save(token,current,{...store,roles});res.json({ok:true})}));
 router.post('/api/admin/transfer-master',route(async(_req,res)=>res.status(501).json({error:'Master transfer is temporarily unavailable while administration is stored in the master account metadata.'})));
 router.put('/api/admin/global-ai',route(async(req,res)=>{const{token,current,store}=await verify(req),body=req.body||{},old={...defaults.ai,...store.ai},ai={...old,primaryEndpoint:String(body.primaryEndpoint||'https://openrouter.ai/api/v1').replace(/\/$/,''),primaryModel:String(body.primaryModel||'openrouter/auto'),primaryKeyCiphertext:body.primaryKey?encrypt(String(body.primaryKey),store):old.primaryKeyCiphertext,backupEndpoint:String(body.backupEndpoint||'').replace(/\/$/,''),backupModel:String(body.backupModel||''),backupKeyCiphertext:body.backupKey?encrypt(String(body.backupKey),store):old.backupKeyCiphertext,instructionSet:String(body.instructionSet||'').slice(0,12000),cadenceMinutes:Math.max(5,Math.min(1440,Number(body.cadenceMinutes)||10)),monthlyBudgetUsd:Math.max(0,Number(body.monthlyBudgetUsd)||0),enabled:Boolean(body.enabled)};await save(token,current,{...store,ai});res.json({ok:true})}));
 router.get('/api/admin/economics/settings',route(async(req,res)=>{const{store}=await verify(req);res.json({settings:{...defaults.economics,...store.economics}})}));
 router.put('/api/admin/economics/settings',route(async(req,res)=>{const{token,current,store}=await verify(req),b=req.body||{},economics={...defaults.economics,...store.economics,source_name:String(b.sourceName||'Financial Times'),source_url:String(b.sourceUrl||''),source_type:String(b.sourceType||'rss'),cadence_hours:Math.max(1,Math.min(168,Number(b.cadenceHours)||12)),max_items:Math.max(1,Math.min(50,Number(b.maxItems)||20)),ai_instruction:String(b.aiInstruction||defaults.economics.ai_instruction),enabled:Boolean(b.enabled),last_error:null};await save(token,current,{...store,economics});res.json({ok:true})}));
 router.post('/api/admin/run-quality',route(async(req,res)=>{const{token,current,store}=await verify(req),ai={...defaults.ai,...store.ai};const result=await runAIHealthCheck({fetchImpl,providers:providers(store),instruction:ai.instructionSet});await save(token,current,{...store,ai:{...ai,lastRunAt:new Date().toISOString(),lastError:result.ok?null:result.reason,lastRunResult:result}});res.json(result)}));
 router.post('/api/admin/economics/run',route(async(req,res)=>{const{token,current,store}=await verify(req),economics={...defaults.economics,...store.economics};let result;try{result=await runEconomicsNow({fetchImpl,settings:economics,providers:providers(store),instruction:economics.ai_instruction})}catch(error){result={ok:false,reason:error.message,fetched:0,converted:0,skipped:0,elapsedMs:0}}await save(token,current,{...store,economics:{...economics,last_run_at:new Date().toISOString(),last_error:result.ok?result.lastError:result.reason,last_result:result}});res.json(result)}));
 return router;
}

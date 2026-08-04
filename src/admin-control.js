import express from 'express';
import crypto from 'node:crypto';

const JSON_HEADERS={'Content-Type':'application/json'};
const parse=async response=>{response=await response;const text=await response.text();let data=null;try{data=text?JSON.parse(text):null}catch{}if(!response.ok){const error=new Error(data?.message||data?.error||text||`Request failed (${response.status})`);error.status=response.status;throw error}return data};
const scrypt=(password,salt)=>new Promise((resolve,reject)=>crypto.scrypt(password,salt,64,(error,key)=>error?reject(error):resolve(key.toString('hex'))));
const b64=value=>Buffer.from(value).toString('base64url');
const unb64=value=>Buffer.from(value,'base64url');
const defaultAI={primaryEndpoint:'https://openrouter.ai/api/v1',primaryModel:'openrouter/auto',backupEndpoint:'',backupModel:'',primaryKeyCiphertext:null,backupKeyCiphertext:null,instructionSet:'Score public submissions for originality, evidence, clarity, usefulness, and meaningful human-AI collaboration. Penalize spam, copied boilerplate, unsupported certainty, and low-effort repetition.',cadenceMinutes:10,monthlyBudgetUsd:25,spentThisMonthUsd:0,enabled:false,lastRunAt:null,lastError:null};
const defaultEconomics={source_name:'Financial Times',source_url:'',source_type:'rss',cadence_hours:12,max_items:20,ai_instruction:'Convert each economic story into a clear decision problem with stakeholders, constraints, tradeoffs, questions, and relevant topics.',enabled:false,last_run_at:null,last_error:null};

function client(env,fetchImpl){
 const enabled=Boolean(env.SUPABASE_URL&&env.SUPABASE_SECRET_KEY);
 const headers=enabled?{apikey:env.SUPABASE_SECRET_KEY,Authorization:`Bearer ${env.SUPABASE_SECRET_KEY}`,...JSON_HEADERS}:{};
 const rest=(path,options={})=>parse(fetchImpl(`${env.SUPABASE_URL}/rest/v1/${path}`,{...options,headers:{...headers,...options.headers}}));
 const authUser=async token=>{if(!enabled||!token)return null;const response=await fetchImpl(`${env.SUPABASE_URL}/auth/v1/user`,{headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_SECRET_KEY,Authorization:`Bearer ${token}`}});return response.ok?response.json():null};
 const users=()=>parse(fetchImpl(`${env.SUPABASE_URL}/auth/v1/admin/users?per_page=1000`,{headers}));
 return{enabled,rest,authUser,users};
}
function keyFor(env){return env.ADMIN_ENCRYPTION_KEY?crypto.createHash('sha256').update(env.ADMIN_ENCRYPTION_KEY).digest():null}
function encrypt(secret,env){if(!secret)return null;const key=keyFor(env);if(!key)throw new Error('ADMIN_ENCRYPTION_KEY is required before saving provider keys.');const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv),body=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]),tag=cipher.getAuthTag();return`${b64(iv)}.${b64(tag)}.${b64(body)}`}
function decrypt(value,env){if(!value||!keyFor(env))return null;const[iv,tag,body]=value.split('.').map(unb64),decipher=crypto.createDecipheriv('aes-256-gcm',keyFor(env),iv);decipher.setAuthTag(tag);return Buffer.concat([decipher.update(body),decipher.final()]).toString('utf8')}

export function createAdminControl({env=process.env,fetchImpl=globalThis.fetch}={}){
 const db=client(env,fetchImpl),router=express.Router();let timer=null;
 const bearer=req=>String(req.get('authorization')||'').replace(/^Bearer\s+/i,'');
 const route=handler=>async(req,res)=>{try{await handler(req,res)}catch(error){console.error(error);res.status(error.status||500).json({error:error.message||'Admin request failed.'})}};

 async function system(){
  const rows=await db.rest('game_progress?select=user_id,state&limit=1000');
  for(const row of rows||[]){if(row.state?.__atlasAdmin)return{ownerId:row.user_id,config:row.state.__atlasAdmin,state:row.state}}
  return null;
 }
 async function write(ownerId,config){
  const rows=await db.rest(`game_progress?user_id=eq.${encodeURIComponent(ownerId)}&select=state&limit=1`).catch(()=>[]);
  const state={...(rows?.[0]?.state||{}),__atlasAdmin:config};
  await db.rest('game_progress',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({user_id:ownerId,state,updated_at:new Date().toISOString()})});
  return config;
 }
 async function verify(req,{master=false,password=true}={}){
  const current=await db.authUser(bearer(req));if(!current)throw Object.assign(new Error('Sign in required.'),{status:401});
  const stored=await system();if(!stored)throw Object.assign(new Error('Administrator has not been initialized.'),{status:409});
  const role=stored.config.roles?.[current.id];if(!role||master&&role!=='master_admin')throw Object.assign(new Error(master?'Master administrator required.':'Administrator required.'),{status:403});
  if(password){const provided=String(req.get('x-admin-password')||req.body?.adminPassword||'');if(!provided)throw Object.assign(new Error('Admin password required.'),{status:401});const hash=await scrypt(provided,stored.config.passwordSalt);if(hash!==stored.config.passwordHash)throw Object.assign(new Error('Invalid admin password.'),{status:401})}
  return{current,role,stored};
 }

 router.get('/api/admin/bootstrap-status',route(async(req,res)=>{if(!db.enabled)return res.status(503).json({error:'Server data storage is not configured.'});const stored=await system(),current=await db.authUser(bearer(req));res.json({initialized:Boolean(stored),signedIn:Boolean(current),role:current&&stored?stored.config.roles?.[current.id]||null:null,encryptionConfigured:Boolean(keyFor(env)),storage:'existing-user-data'})}));
 router.post('/api/admin/bootstrap',route(async(req,res)=>{const current=await db.authUser(bearer(req));if(!current)throw Object.assign(new Error('Sign in before claiming the first administrator role.'),{status:401});if(await system())throw Object.assign(new Error('The administrator has already been initialized.'),{status:409});const password=String(req.body?.password||''),repeat=String(req.body?.repeatPassword||'');if(password.length<12)throw Object.assign(new Error('Use an admin password of at least 12 characters.'),{status:400});if(password!==repeat)throw Object.assign(new Error('The passwords do not match.'),{status:400});const salt=crypto.randomBytes(24).toString('hex'),hash=await scrypt(password,salt),now=new Date().toISOString();await write(current.id,{masterUserId:current.id,passwordHash:hash,passwordSalt:salt,roles:{[current.id]:'master_admin'},ai:{...defaultAI},economics:{...defaultEconomics},initializedAt:now,updatedAt:now});res.json({ok:true,role:'master_admin'})}));
 router.get('/api/admin/dashboard',route(async(req,res)=>{const{role,stored}=await verify(req),auth=await db.users(),roles=stored.config.roles||{},ai={...defaultAI,...stored.config.ai};res.json({role,masterUserId:stored.config.masterUserId,users:(auth.users||[]).map(u=>({id:u.id,email:u.email,createdAt:u.created_at,lastSignInAt:u.last_sign_in_at,role:roles[u.id]||null})),ai:{...ai,primaryKeyConfigured:Boolean(ai.primaryKeyCiphertext),backupKeyConfigured:Boolean(ai.backupKeyCiphertext)}})}));
 router.patch('/api/admin/users/:id/role',route(async(req,res)=>{const{current,stored}=await verify(req,{master:true}),target=req.params.id,next=req.body?.role;if(target===current.id)throw Object.assign(new Error('Transfer master ownership before changing your own role.'),{status:400});const roles={...(stored.config.roles||{})};if(next==='admin')roles[target]='admin';else delete roles[target];await write(stored.ownerId,{...stored.config,roles,updatedAt:new Date().toISOString()});res.json({ok:true})}));
 router.post('/api/admin/transfer-master',route(async(req,res)=>{const{current,stored}=await verify(req,{master:true}),target=String(req.body?.userId||'');if(!target)throw Object.assign(new Error('Select a user.'),{status:400});const roles={...(stored.config.roles||{}),[target]:'master_admin',[current.id]:'admin'};await write(stored.ownerId,{...stored.config,masterUserId:target,roles,updatedAt:new Date().toISOString()});res.json({ok:true})}));
 router.put('/api/admin/global-ai',route(async(req,res)=>{const{stored}=await verify(req),body=req.body||{},old={...defaultAI,...stored.config.ai},ai={...old,primaryEndpoint:String(body.primaryEndpoint||'https://openrouter.ai/api/v1').replace(/\/$/,''),primaryModel:String(body.primaryModel||'openrouter/auto'),primaryKeyCiphertext:body.primaryKey?encrypt(String(body.primaryKey),env):old.primaryKeyCiphertext,backupEndpoint:String(body.backupEndpoint||'').replace(/\/$/,''),backupModel:String(body.backupModel||''),backupKeyCiphertext:body.backupKey?encrypt(String(body.backupKey),env):old.backupKeyCiphertext,instructionSet:String(body.instructionSet||'').slice(0,12000),cadenceMinutes:Math.max(5,Math.min(1440,Number(body.cadenceMinutes)||10)),monthlyBudgetUsd:Math.max(0,Number(body.monthlyBudgetUsd)||0),enabled:Boolean(body.enabled)};await write(stored.ownerId,{...stored.config,ai,updatedAt:new Date().toISOString()});schedule();res.json({ok:true})}));
 router.get('/api/admin/economics/settings',route(async(req,res)=>{const{stored}=await verify(req);res.json({settings:{...defaultEconomics,...stored.config.economics}})}));
 router.put('/api/admin/economics/settings',route(async(req,res)=>{const{stored}=await verify(req),b=req.body||{},economics={source_name:String(b.sourceName||'Financial Times'),source_url:String(b.sourceUrl||''),source_type:String(b.sourceType||'rss'),cadence_hours:Math.max(1,Math.min(168,Number(b.cadenceHours)||12)),max_items:Math.max(1,Math.min(50,Number(b.maxItems)||20)),ai_instruction:String(b.aiInstruction||defaultEconomics.ai_instruction),enabled:Boolean(b.enabled),last_run_at:stored.config.economics?.last_run_at||null,last_error:null};await write(stored.ownerId,{...stored.config,economics,updatedAt:new Date().toISOString()});res.json({ok:true})}));
 router.post('/api/admin/run-quality',route(async(req,res)=>{const{stored}=await verify(req);const ai={...defaultAI,...stored.config.ai};if(!ai.enabled)return res.json({ok:false,reason:'Global AI disabled'});res.json({ok:true,reviewed:0,estimatedCostUsd:0})}));
 router.post('/api/views',route(async(_req,res)=>res.status(204).end()));
 router.get('/api/featured',route(async(_req,res)=>res.json({featured:[]})));

 async function schedule(){if(timer)clearInterval(timer);const stored=await system().catch(()=>null),ai={...defaultAI,...stored?.config?.ai};if(!ai.enabled)return;timer=setInterval(()=>{},Math.max(5,Number(ai.cadenceMinutes)||10)*60_000);timer.unref?.()}
 schedule();
 return{router,runQualityCycle:async()=>({ok:false,reason:'No pending review'}),schedule};
}

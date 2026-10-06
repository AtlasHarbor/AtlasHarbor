import express from 'express';
import crypto from 'node:crypto';
import {supabaseSecretKey,supabaseServiceHeaders} from './supabase-server-key.js';
import {createProblemSpaceStorage} from './problem-space-storage.js';

const APP_DEFINITIONS={
  'slip-and-jump':{slug:'slip-and-jump',name:'Slip and Jump',status:'released'},
  'bible-with-original-names':{slug:'bible-with-original-names',name:'Bible with Original Names',status:'released'},
  'decision-iq-improver':{slug:'decision-iq-improver',name:'Decision: IQ Improver & Mazes',status:'prelaunch'},
  'pitch-recognition':{slug:'pitch-recognition',name:'Pitch Recognition',status:'prelaunch'}
};
const MAX_SIGNUPS=2500;
const WINDOW_MS=10*60*1000;
const MAX_PER_WINDOW=12;
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const rateBuckets=new Map();
let writeQueue=Promise.resolve();
const scrypt=(password,salt)=>new Promise((resolve,reject)=>crypto.scrypt(password,salt,64,(error,key)=>error?reject(error):resolve(key.toString('hex'))));

function clean(value,max=500){return String(value??'').trim().slice(0,max)}
function normalizeEmail(value){return clean(value,320).toLowerCase()}
function consented(value){return value===true||['true','1','on','yes'].includes(String(value||'').toLowerCase())}
function allowedOrigins(env){
 const configured=clean(env.SIGNUP_ALLOWED_ORIGINS,2000).split(',').map(x=>x.trim()).filter(Boolean);
 return new Set(configured.length?configured:['https://twpventures.com','https://www.twpventures.com','http://localhost:8888','http://localhost:3000','http://127.0.0.1:8888','http://127.0.0.1:3000']);
}
function cors(req,res,env){
 const origin=clean(req.get('origin'),500),allowed=allowedOrigins(env);
 if(origin&&allowed.has(origin)){res.set('Access-Control-Allow-Origin',origin);res.set('Vary','Origin')}
 res.set('Access-Control-Allow-Methods','POST, OPTIONS');
 res.set('Access-Control-Allow-Headers','Content-Type');
 res.set('Access-Control-Max-Age','86400');
 return !origin||allowed.has(origin);
}
function rateAllowed(req){
 const raw=clean(req.ip||req.socket?.remoteAddress||'unknown',200),key=crypto.createHash('sha256').update(raw).digest('hex').slice(0,24),now=Date.now();
 const current=(rateBuckets.get(key)||[]).filter(time=>now-time<WINDOW_MS);
 if(current.length>=MAX_PER_WINDOW){rateBuckets.set(key,current);return false}
 current.push(now);rateBuckets.set(key,current);
 if(rateBuckets.size>1000)for(const [bucket,times] of rateBuckets)if(!times.some(time=>now-time<WINDOW_MS))rateBuckets.delete(bucket);
 return true;
}
async function parse(response){
 const text=await response.text();let data={};try{data=text?JSON.parse(text):{}}catch{}
 if(!response.ok){const error=new Error(data?.error_description||data?.message||data?.error||text||`Request failed (${response.status})`);error.status=response.status;throw error}
 return data;
}
function createStore(env,fetchImpl){
 const base=clean(env.SUPABASE_URL,500),publishable=clean(env.SUPABASE_PUBLISHABLE_KEY,1000),secret=supabaseSecretKey(env);
 const configured=Boolean(base&&publishable&&secret);
 const serviceHeaders=()=>supabaseServiceHeaders(secret);
 async function masterAccount(){
  if(!configured)throw Object.assign(new Error('Signup storage is not configured.'),{status:503});
  const response=await fetchImpl(`${base}/auth/v1/admin/users?per_page=1000`,{headers:serviceHeaders()});
  const data=await parse(response),users=data.users||[];
  const master=users.find(item=>item?.user_metadata?.atlas_admin?.masterUserId===item.id)||users.find(item=>item?.user_metadata?.atlas_admin);
  if(!master)throw Object.assign(new Error('Atlas Harbor administrator has not been initialized.'),{status:503});
  return master;
 }
 async function saveRegistry(account,registry){
  const metadata={...(account.user_metadata||{}),atlas_signup_registry:registry};
  await parse(await fetchImpl(`${base}/auth/v1/admin/users/${account.id}`,{method:'PUT',headers:serviceHeaders(),body:JSON.stringify({user_metadata:metadata})}));
 }
 return{configured,masterAccount,saveRegistry};
}
function registryFor(account){
 const saved=account?.user_metadata?.atlas_signup_registry||{},apps={...(saved.apps||{})};
 for(const app of Object.values(APP_DEFINITIONS))if(!apps[app.slug])apps[app.slug]={...app,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
 return{version:1,apps,signups:Array.isArray(saved.signups)?saved.signups:[],updatedAt:saved.updatedAt||null};
}
function withWriteLock(task){
 const run=writeQueue.then(task,task);writeQueue=run.catch(()=>{});return run;
}
function safeScriptJson(value){
 return JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
}

export function createSignupRouter({env=process.env,fetchImpl=globalThis.fetch}={}){
 const router=express.Router(),store=createStore(env,fetchImpl),accountStorage=createProblemSpaceStorage({env,fetchImpl});

 async function submitSignup(payload,req){
  if(!rateAllowed(req))throw Object.assign(new Error('Too many signup attempts. Please try again later.'),{status:429});
  const app=clean(payload?.app,80),definition=APP_DEFINITIONS[app],name=clean(payload?.name,120),email=normalizeEmail(payload?.email),source=clean(payload?.source,700),honeypot=clean(payload?.website,300),consent=consented(payload?.consent);
  if(honeypot)return{ok:true,existing:false,app:definition?.name||'TWP app',appSlug:app,bot:true};
  if(!definition)throw Object.assign(new Error('Unknown app signup list.'),{status:400});
  if(!emailPattern.test(email))throw Object.assign(new Error('Enter a valid email address.'),{status:400});
  if(!consent)throw Object.assign(new Error('Consent is required for launch updates.'),{status:400});
  const result=await withWriteLock(async()=>{
   const account=await store.masterAccount(),registry=registryFor(account),now=new Date().toISOString(),index=registry.signups.findIndex(item=>item.app_slug===app&&normalizeEmail(item.email)===email);
   let existing=index>=0,row;
   if(existing){row={...registry.signups[index],name:name||registry.signups[index].name,email,source:source||registry.signups[index].source,consent:true,updatedAt:now};registry.signups[index]=row}
   else{
    if(registry.signups.length>=MAX_SIGNUPS)throw Object.assign(new Error('The launch list is temporarily full. Please contact TWP Ventures directly.'),{status:507});
    row={id:crypto.randomUUID(),app_slug:app,app_name:definition.name,name,email,source,consent:true,createdAt:now,updatedAt:now};registry.signups.unshift(row);
   }
   registry.apps[app]={...(registry.apps[app]||definition),...definition,updatedAt:now};
   registry.updatedAt=now;await store.saveRegistry(account,registry);return{existing,row};
  });
  return{ok:true,existing:result.existing,app:definition.name,appSlug:definition.slug};
 }

 router.options('/api/app-signups',(req,res)=>cors(req,res,env)?res.status(204).end():res.status(403).end());
 router.post('/api/app-signups',async(req,res)=>{
  if(!cors(req,res,env))return res.status(403).json({error:'This signup form is not allowed from this origin.'});
  try{
   const result=await submitSignup(req.body||{},req);
   return res.status(result.existing?200:201).json(result);
  }catch(error){
   console.error('app signup failed',error);
   return res.status(error.status||500).json({error:error.message||'Could not save signup.'});
  }
 });

 router.post('/api/app-signups-form',express.urlencoded({extended:false,limit:'32kb'}),async(req,res)=>{
  const requestedOrigin=clean(req.body?.parentOrigin,500),allowed=allowedOrigins(env),targetOrigin=allowed.has(requestedOrigin)?requestedOrigin:'https://twpventures.com';
  let payload;
  try{payload=await submitSignup(req.body||{},req)}
  catch(error){console.error('app signup form failed',error);payload={ok:false,error:error.message||'Could not save signup.'}}
  res.set('Cache-Control','no-store');
  res.type('html').send(`<!doctype html><meta charset="utf-8"><script>window.parent.postMessage(${safeScriptJson({type:'atlas-app-signup-result',...payload})},${safeScriptJson(targetOrigin)});<\/script>`);
 });

 async function verifyAdmin(req){
  const {current,verification}=await accountStorage.requestUser(req);
  const config=current?.user_metadata?.atlas_admin,role=config?.roles?.[current.id];
  if(!config||!role)throw Object.assign(new Error('Administrator required.'),{status:403});
  const provided=clean(req.get('x-admin-password'),1000);
  if(!provided)throw Object.assign(new Error('Admin password required.'),{status:401});
  const hash=await scrypt(provided,config.passwordSalt);
  if(hash!==config.passwordHash)throw Object.assign(new Error('Invalid admin password.'),{status:401});
  return{current,role,verification};
 }
 router.get('/api/admin/signups',async(req,res)=>{
  try{
   const admin=await verifyAdmin(req),account=await store.masterAccount(),registry=registryFor(account);
   const apps=Object.values(registry.apps).map(app=>({...app,count:registry.signups.filter(item=>item.app_slug===app.slug).length}));
   const signups=registry.signups.map(({id,app_slug,app_name,name,email,source,createdAt,updatedAt})=>({id,app_slug,app_name,name,email,source,createdAt,updatedAt}));
   res.set('Cache-Control','no-store');return res.json({role:admin.role,sessionVerification:admin.verification,storage:'supabase-master-account-metadata',apps,signups,updatedAt:registry.updatedAt});
  }catch(error){return res.status(error.status||500).json({error:error.message||'Could not load signups.'})}
 });
 return router;
}

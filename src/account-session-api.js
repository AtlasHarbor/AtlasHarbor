import express from 'express';
import {createAccountSessionCookie} from './account-session-cookie.js';
import {supabaseSecretKey,supabaseServiceHeaders} from './supabase-server-key.js';

const text=(value,max)=>String(value??'').trim().slice(0,max);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function responseData(response){
 const raw=await response.text();
 let data={};
 try{data=raw?JSON.parse(raw):{}}catch{}
 if(!response.ok){
  const message=data?.error_description||data?.msg||data?.error?.message||data?.error||data?.message||`Account service failed (${response.status}).`;
  throw Object.assign(new Error(String(message)),{status:[400,401,403,404,409,422,429].includes(response.status)?response.status:502});
 }
 return data;
}

export function createAccountSessionRouter({env=process.env,fetchImpl=globalThis.fetch,sessionCookie=createAccountSessionCookie({env})}={}){
 const router=express.Router(),base=String(env.SUPABASE_URL||'').replace(/\/$/,''),key=String(env.SUPABASE_PUBLISHABLE_KEY||'').trim(),secret=supabaseSecretKey(env);
 const protect=res=>{res.set('Cache-Control','private, no-store, max-age=0');res.vary('Cookie')};
 const route=handler=>async(req,res)=>{protect(res);try{await handler(req,res)}catch(error){res.status(error.status||500).json({error:error.message||'Account session request failed.'})}};
 function requireSameOrigin(req){
  const origin=String(req.get('origin')||'').trim();
  if(!origin)return;
  let host='';try{host=new URL(origin).host}catch{}
  if(!host||host!==String(req.get('host')||''))throw Object.assign(new Error('Cross-origin account session request rejected.'),{status:403});
 }
 async function auth(path,body){
  if(!base||!key)throw Object.assign(new Error('Account authentication is not configured.'),{status:503});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
   const response=await fetchImpl(`${base}/auth/v1/${path}`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body),signal:controller.signal});
   return await responseData(response);
  }catch(error){
   if(error?.name==='AbortError')throw Object.assign(new Error('Account authentication timed out.'),{status:504});
   throw error;
  }finally{clearTimeout(timer)}
 }
 async function confirmSignup(userId){
  if(!base||!secret)throw Object.assign(new Error('Immediate account activation is not configured.'),{status:503});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
   const response=await fetchImpl(`${base}/auth/v1/admin/users/${userId}`,{method:'PUT',headers:{...supabaseServiceHeaders(secret),Accept:'application/json'},body:JSON.stringify({email_confirm:true}),signal:controller.signal});
   return await responseData(response);
  }catch(error){
   if(error?.name==='AbortError')throw Object.assign(new Error('Immediate account activation timed out.'),{status:504});
   throw error;
  }finally{clearTimeout(timer)}
 }
 function establish(req,res,data){
  const session=data?.session||data;
  if(session?.access_token&&session?.user&&!sessionCookie.set(res,req,session))throw Object.assign(new Error('Atlas Harbor could not establish the server account session.'),{status:503});
  return data;
 }
 router.post('/api/account/session/sign-in',route(async(req,res)=>{
  requireSameOrigin(req);
  const email=text(req.body?.email,320),password=String(req.body?.password||'').slice(0,4096);
  if(!email||!password)throw Object.assign(new Error('Email and password are required.'),{status:400});
  res.json(establish(req,res,await auth('token?grant_type=password',{email,password})));
 }));
 router.post('/api/account/session/sign-up',route(async(req,res)=>{
  requireSameOrigin(req);
  const email=text(req.body?.email,320),password=String(req.body?.password||'').slice(0,4096);
  if(!email||!password)throw Object.assign(new Error('Email and password are required.'),{status:400});
  const created=await auth('signup',{email,password}),createdSession=created?.session||created;
  if(createdSession?.access_token)return res.status(201).json(establish(req,res,created));
  const createdUser=created?.user||createdSession?.user||created,userId=String(createdUser?.id||'');
  if(!UUID.test(userId)||Array.isArray(createdUser?.identities)&&createdUser.identities.length===0)throw Object.assign(new Error('That account already exists. Sign in instead.'),{status:409});
  await confirmSignup(userId);
  const signedIn=await auth('token?grant_type=password',{email,password});
  if(!(signedIn?.session||signedIn)?.access_token)throw Object.assign(new Error('Atlas Harbor created the account but could not start its session. Sign in and retry.'),{status:502});
  res.status(201).json(establish(req,res,signedIn));
 }));
 router.post('/api/account/session/refresh',route(async(req,res)=>{
  requireSameOrigin(req);
  const refresh_token=String(req.body?.refresh_token||'').trim().slice(0,12000);
  if(!refresh_token)throw Object.assign(new Error('Refresh token is required.'),{status:400});
  res.json(establish(req,res,await auth('token?grant_type=refresh_token',{refresh_token})));
 }));
 router.delete('/api/account/session',route(async(req,res)=>{
  requireSameOrigin(req);sessionCookie.clear(res,req);res.status(204).end();
 }));
 return router;
}

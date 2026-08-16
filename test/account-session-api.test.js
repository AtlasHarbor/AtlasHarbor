import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createAccountSessionCookie} from '../src/account-session-cookie.js';
import {createAccountSessionRouter} from '../src/account-session-api.js';
import {createProblemSpaceStorage} from '../src/problem-space-storage.js';
import {createWorkspaceRouter} from '../src/workspace-api.js';

const subject='11111111-1111-4111-8111-111111111111';
const now=1_800_000_000_000;
const env={NODE_ENV:'production',SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test'};
const session={access_token:'header.payload.signature',refresh_token:'refresh-token',expires_at:Math.floor(now/1000)+3600,user:{id:subject,user_metadata:{}}};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});

test('Atlas Harbor server-session cookies reject tampering and expiry',()=>{
 const cookie=createAccountSessionCookie({env,now:()=>now}),value=cookie.issue(session);
 assert.ok(value);
 assert.deepEqual(cookie.verify(value),{sub:subject,exp:Math.floor(now/1000)+3600});
 assert.equal(cookie.verify(`${value.slice(0,-1)}x`),null);
 const expired=createAccountSessionCookie({env,now:()=>now+3_700_000});
 assert.equal(expired.verify(value),null);
});

test('server-proxied sign-in establishes a cookie that loads and saves a workspace without bearer re-verification',async()=>{
 let account={id:subject,user_metadata:{}},passwordGrant=0,userEndpointCalls=0;
 const fetchImpl=async(url,options={})=>{
  const parsed=new URL(url),method=options.method||'GET';
  if(parsed.pathname==='/auth/v1/token'&&parsed.searchParams.get('grant_type')==='password'){
   passwordGrant++;
   assert.deepEqual(JSON.parse(options.body),{email:'author@example.com',password:'correct horse battery staple'});
   return json(session);
  }
  if(parsed.pathname==='/auth/v1/user'){userEndpointCalls++;return json({message:'must not be called'},500)}
  if(parsed.pathname===`/auth/v1/admin/users/${subject}`&&method==='GET')return json({user:structuredClone(account)});
  if(parsed.pathname===`/auth/v1/admin/users/${subject}`&&method==='PUT'){
   const patch=JSON.parse(options.body).user_metadata;
   account={...account,user_metadata:{...account.user_metadata,...patch}};
   return json({user:structuredClone(account)});
  }
  throw new Error(`Unexpected request: ${method} ${url}`);
 };
 const sessionCookie=createAccountSessionCookie({env}),storage=createProblemSpaceStorage({env,fetchImpl});
 const app=express();app.use(express.json({limit:'1mb'}));app.use(createAccountSessionRouter({env,fetchImpl,sessionCookie}));app.use(createWorkspaceRouter({env,fetchImpl,storage}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{
  const base=`http://127.0.0.1:${server.address().port}`;
  const signedIn=await fetch(`${base}/api/account/session/sign-in`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'author@example.com',password:'correct horse battery staple'})});
  assert.equal(signedIn.status,200);
  assert.equal(passwordGrant,1);
  const setCookie=signedIn.headers.get('set-cookie');
  assert.match(setCookie,/^atlas_harbor_session=/);
  assert.match(setCookie,/HttpOnly/);
  assert.match(setCookie,/SameSite=Lax/);
  assert.match(setCookie,/Secure/);
  const cookie=setCookie.split(';')[0];
  const status=await fetch(`${base}/api/workspaces/status`,{headers:{Cookie:cookie}}),statusData=await status.json();
  assert.equal(status.status,200);
  assert.equal(statusData.signedIn,true);
  assert.equal(statusData.sessionVerification,'server-session-cookie');
  const save=await fetch(`${base}/api/workspaces/baseball_player/605141`,{method:'PUT',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({resource_title:'Mookie Betts',title:'Server session save',body:'<p>Saved once.</p>',intent:'save'})}),saved=await save.json();
  assert.equal(save.status,200);
  assert.equal(saved.workspace.resource_id,'605141');
  assert.equal(saved.workspace.title,'Server session save');
  assert.equal(userEndpointCalls,0);
  assert.equal(Object.keys(account.user_metadata).filter(key=>key.startsWith('atlas_workspace_record_v2_')).length,1);
  const loggedOut=await fetch(`${base}/api/account/session`,{method:'DELETE',headers:{Cookie:cookie}});
  assert.equal(loggedOut.status,204);
  assert.match(loggedOut.headers.get('set-cookie'),/Max-Age=0/);
 }finally{await new Promise(resolve=>server.close(resolve))}
});

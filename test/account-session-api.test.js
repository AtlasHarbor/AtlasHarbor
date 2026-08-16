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

test('sign-up immediately confirms the new account and starts its server session',async()=>{
 const calls=[];
 const fetchImpl=async(url,options={})=>{
  const parsed=new URL(url),method=options.method||'GET',body=JSON.parse(options.body||'{}');calls.push({path:parsed.pathname,grant:parsed.searchParams.get('grant_type'),method,body,headers:options.headers});
  if(parsed.pathname==='/auth/v1/signup')return json({user:{id:subject,email:'new@example.com',identities:[{id:'identity-1'}]},session:null});
  if(parsed.pathname===`/auth/v1/admin/users/${subject}`&&method==='PUT')return json({user:{id:subject,email_confirmed_at:new Date(now).toISOString()}});
  if(parsed.pathname==='/auth/v1/token'&&parsed.searchParams.get('grant_type')==='password')return json(session);
  throw new Error(`Unexpected request: ${method} ${url}`);
 };
 const sessionCookie=createAccountSessionCookie({env}),app=express();app.use(express.json());app.use(createAccountSessionRouter({env,fetchImpl,sessionCookie}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{
  const base=`http://127.0.0.1:${server.address().port}`,response=await fetch(`${base}/api/account/session/sign-up`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email:'new@example.com',password:'correct horse battery staple'})}),data=await response.json();
  assert.equal(response.status,201);
  assert.equal(data.access_token,session.access_token);
  assert.match(response.headers.get('set-cookie'),/^atlas_harbor_session=/);
  assert.deepEqual(calls.map(call=>[call.method,call.path,call.grant]),[['POST','/auth/v1/signup',null],['PUT',`/auth/v1/admin/users/${subject}`,null],['POST','/auth/v1/token','password']]);
  assert.deepEqual(calls[1].body,{email_confirm:true});
  assert.equal(calls[1].headers.apikey,env.SUPABASE_SECRET_KEY);
  assert.equal(calls[1].headers.Authorization,undefined);
 }finally{await new Promise(resolve=>server.close(resolve))}
});

test('server-proxied sign-in establishes one cookie that saves every shared Problem Space without bearer re-verification',async()=>{
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
  const resources=[
   {type:'baseball_player',id:'605141',title:'Mookie Betts analysis'},
   {type:'baseball_game',id:'777001',title:'Baseball game analysis'},
   {type:'baseball_team',id:'119',title:'Baseball team analysis'},
   {type:'legal_case',id:'ny-kalshi-enforcement-2026',title:'Legal case analysis',publish:true},
   {type:'economics_story',id:'digital-iron-curtain',title:'Economics analysis'},
   {type:'life_science_problem',id:'biomarker-response',title:'Life Sciences analysis'},
   {type:'go_to_market_report',id:'partner-proposal',title:'Proposition analysis'},
   {type:'lead_project',id:'qualified-leads',title:'Lead Discovery analysis'},
   {type:'logistics_project',id:'resilient-lanes',title:'Logistics Planner analysis'}
  ];
  for(const resource of resources){
   const save=await fetch(`${base}/api/workspaces/${resource.type}/${resource.id}`,{method:'PUT',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({resource_title:resource.title,title:resource.title,body:`<p>${resource.title}</p>`,is_shared:Boolean(resource.publish),intent:resource.publish?'publish':'save'})}),saved=await save.json();
   assert.equal(save.status,200,`${resource.type} save failed: ${JSON.stringify(saved)}`);
   assert.equal(saved.workspace.resource_type,resource.type);
   assert.equal(saved.workspace.resource_id,resource.id);
   if(resource.publish)assert.match(saved.workspace.share_token,/^[A-Za-z0-9_-]{24}$/);
  }
  assert.equal(userEndpointCalls,0);
  const records=Object.entries(account.user_metadata).filter(([key])=>key.startsWith('atlas_workspace_record_v2_')).map(([,value])=>value);
  assert.equal(records.length,resources.length);
  assert.deepEqual(new Set(records.map(record=>record.resource_type)),new Set(resources.map(resource=>resource.type)));
  const loggedOut=await fetch(`${base}/api/account/session`,{method:'DELETE',headers:{Cookie:cookie}});
  assert.equal(loggedOut.status,204);
  assert.match(loggedOut.headers.get('set-cookie'),/Max-Age=0/);
 }finally{await new Promise(resolve=>server.close(resolve))}
});

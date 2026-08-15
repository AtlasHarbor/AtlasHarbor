import test from 'node:test';
import assert from 'node:assert/strict';
import {createProblemSpaceStorage} from '../src/problem-space-storage.js';

const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
const request=token=>({get:name=>String(name).toLowerCase()==='authorization'?`Bearer ${token}`:''});
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});

test('user writes are serialized per account without blocking another account',async()=>{
 let releaseSlow,markFast;
 const slowGate=new Promise(resolve=>{releaseSlow=resolve});
 const fastStarted=new Promise(resolve=>{markFast=resolve});
 const accounts={slow:{id:'slow',user_metadata:{}},fast:{id:'fast',user_metadata:{}}};
 const fetchImpl=async(url,options={})=>{
  const token=String(options.headers?.Authorization||'').replace(/^Bearer\s+/,'');
  if((options.method||'GET')==='GET'){
   if(token==='slow')await slowGate;
   if(token==='fast')markFast();
   return json(accounts[token]);
  }
  const metadata=JSON.parse(options.body).data;
  accounts[token]={...accounts[token],user_metadata:metadata};
  return json({user:accounts[token]});
 };
 const storage=createProblemSpaceStorage({env,fetchImpl});
 const slow=storage.writeUser(request('slow'),'space',value=>({...value,saved:true}));
 await new Promise(resolve=>setImmediate(resolve));
 const fast=storage.writeUser(request('fast'),'space',value=>({...value,saved:true}));
 const started=await Promise.race([fastStarted.then(()=>true),new Promise(resolve=>setTimeout(()=>resolve(false),100))]);
 releaseSlow();
 await Promise.all([slow,fast]);
 assert.equal(started,true,'an unrelated user write must not wait behind a stalled account');
});

test('writes for one account remain serial and preserve both updates',async()=>{
 let account={id:'same-user',user_metadata:{atlas_problem_spaces:{space:{count:0}}}};
 const calls=[];
 const fetchImpl=async(url,options={})=>{
  const method=options.method||'GET';calls.push(method);
  if(method==='GET')return json(structuredClone(account));
  account={...account,user_metadata:JSON.parse(options.body).data};
  return json({user:structuredClone(account)});
 };
 const storage=createProblemSpaceStorage({env,fetchImpl}),req=request('same-token');
 await Promise.all([
  storage.writeUser(req,'space',value=>({...value,count:value.count+1})),
  storage.writeUser(req,'space',value=>({...value,count:value.count+1}))
 ]);
 assert.deepEqual(calls,['GET','PUT','GET','PUT']);
 assert.equal(account.user_metadata.atlas_problem_spaces.space.count,2);
});

test('an invalid bearer is reported as an expired account session instead of a missing sign-in',async()=>{
 const storage=createProblemSpaceStorage({env,fetchImpl:async()=>json({message:'invalid JWT'},401)});
 await assert.rejects(storage.requestUser(request('expired-token')),error=>{
  assert.equal(error.status,401);
  assert.match(error.message,/session expired or is invalid/i);
  return true;
 });
});

test('an upstream authentication outage is not collapsed into a sign-in error',async()=>{
 const storage=createProblemSpaceStorage({env,fetchImpl:async()=>json({message:'Authentication service unavailable'},503)});
 await assert.rejects(storage.requestUser(request('otherwise-valid-token')),error=>{
  assert.equal(error.status,503);
  assert.equal(error.message,'Authentication service unavailable');
  return true;
 });
});

test('server authentication uses its secret app key while preserving the user bearer for reads and bounded patches',async()=>{
 const serverEnv={...env,SUPABASE_SECRET_KEY:'sb_secret_test'};
 let account={id:'user-1',user_metadata:{unrelated:{large:'x'.repeat(10000)}}};
 const calls=[];
 const fetchImpl=async(url,options={})=>{
  calls.push({method:options.method||'GET',headers:options.headers,body:options.body});
  assert.equal(options.headers.apikey,'sb_secret_test');
  assert.equal(options.headers.Authorization,'Bearer browser-user-jwt');
  if((options.method||'GET')==='PUT'){
   const patch=JSON.parse(options.body).data;
   account={...account,user_metadata:{...account.user_metadata,...patch}};
   return json({user:account});
  }
  return json(account);
 };
 const storage=createProblemSpaceStorage({env:serverEnv,fetchImpl});
 await storage.patchUser(request('browser-user-jwt'),()=>({atlas_workspace_record_v2_player:{title:'Saved'}}));
 assert.deepEqual(calls.map(call=>call.method),['GET','PUT']);
 assert.ok(calls[1].body.length<200);
 assert.doesNotMatch(calls[1].body,/unrelated/);
});

test('server authentication falls back to the publishable app key when the configured secret is rejected',async()=>{
 const serverEnv={...env,SUPABASE_SECRET_KEY:'sb_secret_stale'},seen=[];
 const storage=createProblemSpaceStorage({env:serverEnv,fetchImpl:async(url,options={})=>{
  seen.push(options.headers.apikey);
  assert.equal(options.headers.Authorization,'Bearer user-token');
  return options.headers.apikey==='sb_secret_stale'?json({message:'Invalid API key'},403):json({id:'user-1',user_metadata:{}});
 }});
 const result=await storage.requestUser(request('user-token'));
 assert.equal(result.current.id,'user-1');
 assert.deepEqual(seen,['sb_secret_stale','sb_publishable_test']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createProblemSpaceStorage} from '../src/problem-space-storage.js';

const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
const request=token=>({get:name=>String(name).toLowerCase()==='authorization'?`Bearer ${token}`:''});
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
function signedToken({base=env.SUPABASE_URL,subject='11111111-1111-4111-8111-111111111111',expiresAt=Math.floor(Date.now()/1000)+3600,keyPair=crypto.generateKeyPairSync('ec',{namedCurve:'P-256'}),kid='test-signing-key',claims={}}={}){
 const header=Buffer.from(JSON.stringify({alg:'ES256',kid,typ:'JWT'})).toString('base64url'),payload=Buffer.from(JSON.stringify({iss:`${base}/auth/v1`,aud:'authenticated',role:'authenticated',sub:subject,iat:Math.floor(Date.now()/1000),exp:expiresAt,...claims})).toString('base64url'),input=`${header}.${payload}`,signature=crypto.sign('sha256',Buffer.from(input),{key:keyPair.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url'),jwk={...keyPair.publicKey.export({format:'jwk'}),kid,alg:'ES256',use:'sig'};
 return{token:`${input}.${signature}`,jwk,keyPair,subject};
}

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
  assert.equal(error.code,'AUTH_REMOTE_REJECTED');
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

test('legacy remote verification keeps the user bearer while the server writes a bounded admin patch',async()=>{
 const serverEnv={...env,SUPABASE_SECRET_KEY:'sb_secret_test'};
 let account={id:'user-1',user_metadata:{unrelated:{large:'x'.repeat(10000)}}};
 const calls=[];
 const fetchImpl=async(url,options={})=>{
  const path=new URL(url).pathname;calls.push({path,method:options.method||'GET',headers:options.headers,body:options.body});
  assert.equal(options.headers.apikey,'sb_secret_test');
  if(path==='/auth/v1/user'){assert.equal(options.headers.Authorization,'Bearer browser-user-jwt');return json(account)}
  if(path==='/auth/v1/admin/users/user-1'&&(options.method||'GET')==='PUT'){
   assert.equal(options.headers.Authorization,undefined);
   const patch=JSON.parse(options.body).user_metadata;
   account={...account,user_metadata:{...account.user_metadata,...patch}};
   return json(account);
  }
  return json({},404);
 };
 const storage=createProblemSpaceStorage({env:serverEnv,fetchImpl});
 await storage.patchUser(request('browser-user-jwt'),()=>({atlas_workspace_record_v2_player:{title:'Saved'}}));
 assert.deepEqual(calls.map(call=>[call.path,call.method]),[['/auth/v1/user','GET'],['/auth/v1/admin/users/user-1','PUT']]);
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

test('asymmetric Supabase sessions verify through JWKS and bypass the failing user endpoint',async()=>{
 const fixture=signedToken(),serverEnv={...env,SUPABASE_SECRET_KEY:'sb_secret_test'},calls=[];
 let account={id:fixture.subject,user_metadata:{unrelated:{large:'x'.repeat(10000)}}};
 const storage=createProblemSpaceStorage({env:serverEnv,fetchImpl:async(url,options={})=>{
  const path=new URL(url).pathname,method=options.method||'GET';calls.push({path,method,headers:options.headers,body:options.body});
  if(path==='/auth/v1/.well-known/jwks.json')return json({keys:[fixture.jwk]});
  if(path==='/auth/v1/user')throw new Error('the remote user endpoint must not be needed for a valid asymmetric session');
  if(path===`/auth/v1/admin/users/${fixture.subject}`){
   assert.equal(options.headers.apikey,'sb_secret_test');
   assert.equal(options.headers.Authorization,undefined);
   if(method==='PUT'){const patch=JSON.parse(options.body).user_metadata;account={...account,user_metadata:{...account.user_metadata,...patch}}}
   return json(structuredClone(account));
  }
  return json({},404);
 }});
 await storage.patchUser(request(fixture.token),()=>({atlas_workspace_record_v2_player:{title:'Verified save'}}));
 assert.deepEqual(calls.map(call=>[call.path,call.method]),[
  ['/auth/v1/.well-known/jwks.json','GET'],
  [`/auth/v1/admin/users/${fixture.subject}`,'GET'],
  [`/auth/v1/admin/users/${fixture.subject}`,'PUT']
 ]);
 assert.ok(calls[2].body.length<220);
 assert.doesNotMatch(calls[2].body,/unrelated/);
 assert.equal(account.user_metadata.atlas_workspace_record_v2_player.title,'Verified save');
});

test('verified sessions fall back to the admin account list when direct account lookup is unavailable',async()=>{
 const fixture=signedToken(),serverEnv={...env,SUPABASE_SECRET_KEY:'sb_secret_test'},account={id:fixture.subject,user_metadata:{saved:true}},calls=[];
 const storage=createProblemSpaceStorage({env:serverEnv,fetchImpl:async(url,options={})=>{
  const parsed=new URL(url),path=parsed.pathname;calls.push(path);
  if(path==='/auth/v1/.well-known/jwks.json')return json({keys:[fixture.jwk]});
  if(path===`/auth/v1/admin/users/${fixture.subject}`)return json({message:'temporary direct lookup failure'},503);
  if(path==='/auth/v1/admin/users'&&parsed.searchParams.get('per_page')==='1000')return json({users:[account]});
  if(path==='/auth/v1/user')throw new Error('the remote user endpoint must not be needed when the admin list resolves the verified subject');
  return json({},404);
 }});
 const result=await storage.requestUser(request(fixture.token));
 assert.equal(result.current.id,fixture.subject);
 assert.deepEqual(calls,[
  '/auth/v1/.well-known/jwks.json',
  `/auth/v1/admin/users/${fixture.subject}`,
  '/auth/v1/admin/users'
 ]);
});

test('a forged asymmetric bearer is rejected before any account read',async()=>{
 const trusted=signedToken(),forged=signedToken({keyPair:crypto.generateKeyPairSync('ec',{namedCurve:'P-256'}),kid:'test-signing-key'}),calls=[];
 const storage=createProblemSpaceStorage({env:{...env,SUPABASE_SECRET_KEY:'sb_secret_test'},fetchImpl:async url=>{const path=new URL(url).pathname;calls.push(path);if(path==='/auth/v1/.well-known/jwks.json')return json({keys:[trusted.jwk]});if(path==='/rest/v1/__atlas_session_verification_never_create__')return json({code:'PGRST301',message:'No suitable key or wrong key type'},401);throw new Error('a forged token must not reach account storage')}});
 await assert.rejects(storage.requestUser(request(forged.token)),error=>error.status===401&&error.code==='AUTH_TOKEN_REJECTED');
 assert.deepEqual(calls,['/auth/v1/.well-known/jwks.json','/rest/v1/__atlas_session_verification_never_create__']);
});

test('expired, wrong-project, and wrong-role sessions are rejected before account storage',async()=>{
 const keyPair=crypto.generateKeyPairSync('ec',{namedCurve:'P-256'}),fixtures=[
  signedToken({keyPair,expiresAt:Math.floor(Date.now()/1000)-120}),
  signedToken({keyPair,base:'https://another-project.supabase.co'}),
  signedToken({keyPair,claims:{role:'anon'}})
 ];
 for(const fixture of fixtures){
  const calls=[],storage=createProblemSpaceStorage({env:{...env,SUPABASE_SECRET_KEY:'sb_secret_test'},fetchImpl:async url=>{const path=new URL(url).pathname;calls.push(path);if(path==='/auth/v1/.well-known/jwks.json')return json({keys:[fixture.jwk]});throw new Error('an invalid token must not reach account storage')}});
  await assert.rejects(storage.requestUser(request(fixture.token)),error=>error.status===401);
  assert.deepEqual(calls,['/auth/v1/.well-known/jwks.json']);
 }
});

test('a gateway-verified non-JWKS session bypasses the failing user endpoint',async()=>{
 const subject='22222222-2222-4222-8222-222222222222',now=Math.floor(Date.now()/1000),header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),payload=Buffer.from(JSON.stringify({iss:`${env.SUPABASE_URL}/auth/v1`,aud:'authenticated',role:'authenticated',sub:subject,iat:now,exp:now+3600})).toString('base64url'),token=`${header}.${payload}.legacy-signature`,calls=[],account={id:subject,user_metadata:{}};
 const storage=createProblemSpaceStorage({env:{...env,SUPABASE_SECRET_KEY:'sb_secret_test'},fetchImpl:async(url,options={})=>{
  const parsed=new URL(url),path=parsed.pathname,method=options.method||'GET';calls.push({path,method,headers:options.headers});
  if(path==='/rest/v1/__atlas_session_verification_never_create__'){
   assert.equal(options.headers.apikey,'sb_publishable_test');
   if(options.headers.Authorization===`Bearer ${token}`)return json({code:'PGRST205',message:"Could not find the table 'public.__atlas_session_verification_never_create__' in the schema cache"},404);
   return json({code:'PGRST301',message:'No suitable key or wrong key type'},401);
  }
  if(path===`/auth/v1/admin/users/${subject}`)return json(account);
  if(path==='/auth/v1/user')throw new Error('the broken user endpoint must not be required');
  return json({},404);
 }});
 const result=await storage.requestUser(request(token));
 assert.equal(result.current.id,subject);
 assert.deepEqual(calls.map(call=>[call.path,call.method]),[
  ['/rest/v1/__atlas_session_verification_never_create__','GET'],
  ['/rest/v1/__atlas_session_verification_never_create__','GET'],
  [`/auth/v1/admin/users/${subject}`,'GET']
 ]);
});

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

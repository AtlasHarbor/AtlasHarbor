import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import crypto from 'node:crypto';
import {createMovementRouter} from '../src/movement.js';

// End-to-end HTTP routing with a fake Supabase PostgREST transport; no real credentials.
function fixture(){
 const rows=[],ideas=[],prayers=new Set(),votes=new Set(),history=[];
 const accountId='6c5ed290-f96e-4f3d-b1a3-99031f34b297';
 const env={SUPABASE_URL:'https://fake.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test_only',
   MOVEMENT_VISITOR_SALT:'some-long-secret-only-for-test-123',MOVEMENT_ADMIN_TOKEN:'this-is-32-characters-long-at-least'};
 const store={requestUser:async(req)=>{
   if(req.get('x-test-user')!=='yes')throw Object.assign(new Error('Sign in required.'),{status:401});
   return {current:{id:accountId}};
 }};
 const json=value=>({ok:true,status:200,text:async()=>JSON.stringify(value)});
 async function fakeFetch(url,opts={}){
  const uri=new URL(url),table=uri.pathname.split('/').pop(),m=opts.method||'GET',body=opts.body?JSON.parse(opts.body):{};
  const query=uri.searchParams,id=query.get('id')?.replace(/^eq\./,''),author=query.get('author_id')?.replace(/^eq\./,'');
  const projected=row=>{const select=query.get('select');if(!select||select==='*')return row;return Object.fromEntries(select.split(',').filter(k=>Object.hasOwn(row,k)).map(k=>[k,row[k]]))};
  if(table==='movement_requests'){
   if(m==='POST'){const row={...body,id:crypto.randomUUID(),status:'discussion',prayer_count:0,no_money_yes:0,no_money_no:0,no_money_unsure:0,amount_spent:0,beneficiaries_verified:0,created_at:new Date().toISOString()};rows.push(row);return json([projected(row)]);}
   if(m==='PATCH'){const row=rows.find(x=>x.id===id&&(!author||x.author_id===author));if(!row)return json([]);
      if(body.status)history.push({previous_status:row.status,new_status:body.status});
      Object.assign(row,body);return json([projected(row)]);}
   let selected=rows.filter(x=>(!id||x.id===id)&&(!author||x.author_id===author));
   if(query.get('limit')==='0')selected=[];return json(selected.map(projected));
  }
  if(table==='movement_ideas'){
   if(m==='POST'){const idea={id:crypto.randomUUID(),...body,created_at:new Date().toISOString()};ideas.push(idea);return json([idea]);}
   const requestId=query.get('request_id')?.replace(/^eq\./,'');return json(ideas.filter(x=>x.request_id===requestId));
  }
  if(table==='movement_prayers'||table==='movement_votes'){
   const key=body.request_id+':'+body.visitor_digest;const dest=table==='movement_prayers'?prayers:votes;
   if(m!=='POST')return json([]);
   if(dest.has(key))return json([]);
   dest.add(key);const row=rows.find(x=>x.id===body.request_id);
   if(row){if(table==='movement_prayers')row.prayer_count++;else row['no_money_'+body.answer]++;}
   return json([{request_id:body.request_id}]);
  }
  if(table==='movement_review_events')return json(history);
  throw Error('Unexpected test table: '+table);
 }
 const app=express();app.use(express.json());app.use('/api/movement',createMovementRouter({env,fetchImpl:fakeFetch,storage:store}));
 return {app,rows,accountId};
}
const baseData={title:'Sharing a neighborhood repair kit',description:'Several volunteers have hands-on repair skills but need access to a shared tool.',how_help_others:'Three volunteers will help their neighbors repair their equipment.',repeatable_step:'Repairers share the tool and pass on the skill to others.',verse_ref:'Galatians 6:2',requested_amount:0,beneficiaries_target:1};
test('Atlas movement: signup-required posting, ideas, prayer dedup, vote dedup, private fields and honest failure',async()=>{
 const {app,rows}=fixture();const server=app.listen(0);await new Promise(r=>server.once('listening',r));
 const base='http://127.0.0.1:'+server.address().port+'/api/movement';
 const call=async(path,method='GET',body=null,headers={})=>{
   const opts={method,headers:{Accept:'application/json',...headers}};
   if(body!==null){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(body)}
   const res=await fetch(base+path,opts);return {code:res.status,payload:await res.json()};
 };
 try{
  assert.equal((await call('/health')).payload.ok,true);
  assert.equal((await call('/requests','POST',baseData)).code,401);
  const create=await call('/requests','POST',{...baseData,contact_email:'private@example.test'}, {'x-test-user':'yes'});
  assert.equal(create.code,201);const id=create.payload.request.id;
  assert.ok(id);assert.ok(rows[0].author_id);
  assert.equal(JSON.stringify(create.payload).includes('private@example.test'),false);
  assert.equal(JSON.stringify((await call('/requests')).payload).includes('private@example.test'),false);
  assert.equal((await call('/requests/'+id)).code,200);
  assert.equal((await call('/requests/'+id+'/ideas','POST',{kind:'no-money',body:'Ask a neighbor who already owns the tools.'})).code,401);
  assert.equal((await call('/requests/'+id+'/ideas','POST',{kind:'no-money',body:'Ask a neighbor who already owns the tools.'},{'x-test-user':'yes'})).code,201);
  const browser=crypto.randomUUID();
  const first=await call('/requests/'+id+'/prayers','POST',{visitor_id:browser});
  const twice=await call('/requests/'+id+'/prayers','POST',{visitor_id:browser});
  assert.equal(first.payload.count,1);assert.equal(first.payload.added,true);
  assert.equal(twice.payload.count,1);assert.equal(twice.payload.added,false);
  const yes=await call('/requests/'+id+'/votes','POST',{visitor_id:browser,answer:'yes'});
  const no=await call('/requests/'+id+'/votes','POST',{visitor_id:browser,answer:'no'});
  assert.equal(yes.payload.counts.yes,1);assert.equal(no.payload.counts.no,0);
  assert.equal((await call('/admin/requests')).code,403);
  const admin={'x-movement-admin-token':'this-is-32-characters-long-at-least'};
  const finished=await call('/admin/requests/'+id,'PATCH',{status:'completed',video_verified:true,amount_spent:100,beneficiaries_verified:0,outcome_summary:'The trial did not achieve its aim.'},admin);
  assert.equal(finished.code,200);
  assert.equal(finished.payload.request.status,'completed');
  assert.equal((await call('/admin/requests/'+id+'/history','GET',null,admin)).payload.events.length,1);
 }finally{server.close();}
});

import test from'node:test';
import assert from'node:assert/strict';
import express from'express';
import{createPublishedFeedRouter}from'../src/published-feed.js';
import{createWorkspaceRouter}from'../src/workspace-api.js';

const account={
 id:'user-1',
 user_metadata:{
  atlas_profile:{username:'Atlas Tester',profile_slug:'atlas-tester',avatar_seed:'seed'},
  atlas_problem_spaces:{
   publishing_workspace:{notes:[{
    id:'note-1',user_id:'user-1',resource_type:'legal_case',resource_id:'ny-kalshi-enforcement-2026',resource_title:'New York v. KalshiEX',title:'Kalshi analysis',body:'<p>Recovered</p>',is_shared:true,is_published:true,share_token:'shared-token',featured:true,updated_at:'2026-08-06T12:00:00Z',published_at:'2026-08-06T12:00:00Z'
   }]}
  }
 }
};

function mockSupabase(){
 const calls=[];
 const fetchImpl=async(url,options={})=>{
  const parsed=new URL(url),headers=options.headers||{};calls.push({path:parsed.pathname,search:parsed.search,headers,method:options.method||'GET'});
  if(parsed.pathname==='/auth/v1/user'){
   if((options.method||'GET')==='PUT')return new Response(JSON.stringify({user:account}),{status:200,headers:{'Content-Type':'application/json'}});
   return new Response(JSON.stringify(account),{status:200,headers:{'Content-Type':'application/json'}});
  }
  if(parsed.pathname==='/auth/v1/admin/users')return new Response(JSON.stringify({users:[account]}),{status:200,headers:{'Content-Type':'application/json'}});
  if(parsed.pathname.startsWith('/rest/v1/'))return new Response('[]',{status:200,headers:{'Content-Type':'application/json'}});
  return new Response('{}',{status:404,headers:{'Content-Type':'application/json'}});
 };
 return{fetchImpl,calls};
}

async function withServer(router,run){
 const app=express();app.use(express.json());app.use(router);const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve));
 try{return await run(`http://127.0.0.1:${server.address().port}`)}finally{await new Promise(resolve=>server.close(resolve))}
}

test('published feed reads account metadata with an opaque Supabase secret key',async()=>{
 const mock=mockSupabase(),env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test'};
 await withServer(createPublishedFeedRouter({env,fetchImpl:mock.fetchImpl}),async base=>{
  const response=await fetch(`${base}/api/published-feed`),data=await response.json();
  assert.equal(response.status,200);assert.equal(data.publications.length,1);assert.equal(data.publications[0].title,'Kalshi analysis');
 });
 const adminCall=mock.calls.find(call=>call.path==='/auth/v1/admin/users');
 assert.equal(adminCall.headers.apikey,'sb_secret_test');assert.equal(adminCall.headers.Authorization,undefined);
});

test('signed-in workspace loads the persistent account copy when SQL adapters are empty',async()=>{
 const mock=mockSupabase(),env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test'};
 await withServer(createWorkspaceRouter({env,fetchImpl:mock.fetchImpl}),async base=>{
  const response=await fetch(`${base}/api/workspaces/legal_case/ny-kalshi-enforcement-2026`,{headers:{Authorization:'Bearer user-token'}}),data=await response.json();
  assert.equal(response.status,200);assert.equal(data.workspace.title,'Kalshi analysis');assert.equal(data.workspace.body,'<p>Recovered</p>');
 });
 const tableCall=mock.calls.find(call=>call.path==='/rest/v1/workspace_notes');
 assert.equal(tableCall.headers.apikey,'sb_secret_test');assert.equal(tableCall.headers.Authorization,undefined);
});

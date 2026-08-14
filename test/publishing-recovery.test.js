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

test('workspace PUT performs one server auth read and one canonical metadata update',async()=>{
 const mock=mockSupabase(),env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test'};
 await withServer(createWorkspaceRouter({env,fetchImpl:mock.fetchImpl}),async base=>{
  const response=await fetch(`${base}/api/workspaces/baseball_player/669461`,{method:'PUT',headers:{Authorization:'Bearer user-token','Content-Type':'application/json'},body:JSON.stringify({resource_title:'Matthew Liberatore',title:'API-only draft',body:'<p>Saved</p>',intent:'save'})}),data=await response.json();
  assert.equal(response.status,200);
  assert.equal(data.workspace.resource_type,'baseball_player');
  assert.equal(data.workspace.resource_id,'669461');
  assert.equal(data.workspace.title,'API-only draft');
 });
 const authCalls=mock.calls.filter(call=>call.path==='/auth/v1/user');
 assert.deepEqual(authCalls.map(call=>call.method),['GET','PUT']);
 assert.equal(mock.calls.some(call=>call.path==='/rest/v1/workspace_notes'),false);
});

test('form-navigation fallback saves and publishes a first workspace to canonical account metadata',async()=>{
 let current={id:'user-form',user_metadata:{atlas_profile:{username:'Form Tester'},atlas_problem_spaces:{}}};
 const storage={
  requestUser:async req=>{
   assert.equal(req.get('authorization'),'Bearer form-token');
   return{token:'form-token',current};
  },
  writeUser:async(req,space,updater)=>{
   assert.equal(req.get('authorization'),'Bearer form-token');
   assert.equal(space,'publishing_workspace');
   const spaces={...(current.user_metadata.atlas_problem_spaces||{})};
   const value=await updater(structuredClone(spaces[space]||{}),current);
   spaces[space]=value;
   current={...current,user_metadata:{...current.user_metadata,atlas_problem_spaces:spaces}};
   return{value,user:current};
  }
 };
 await withServer(createWorkspaceRouter({env:{},storage}),async base=>{
  const payload={resource_title:'Matthew Liberatore',title:'First player note',body:'<p>Draft analysis</p>',is_shared:false,intent:'save'};
  const form=new URLSearchParams({request_id:'form-request-1',access_token:'form-token',payload:JSON.stringify(payload)});
  const response=await fetch(`${base}/api/workspaces-form/baseball_player/669461`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form}),html=await response.text();
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-type'),/^text\/html/);
  assert.match(html,/atlas-workspace-form-result/);
  assert.match(html,/form-request-1/);
  assert.match(html,/First player note/);
  const notes=current.user_metadata.atlas_problem_spaces.publishing_workspace.notes;
  assert.equal(notes.length,1);
  assert.equal(notes[0].resource_type,'baseball_player');
  assert.equal(notes[0].resource_id,'669461');
  assert.equal(notes[0].title,'First player note');
  assert.equal(notes[0].is_published,false);

  const publishPayload={...payload,is_shared:true,intent:'publish'};
  const publishForm=new URLSearchParams({request_id:'form-request-2',access_token:'form-token',payload:JSON.stringify(publishPayload)});
  const publishResponse=await fetch(`${base}/api/workspaces-form/baseball_player/669461`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:publishForm}),publishHtml=await publishResponse.text();
  assert.equal(publishResponse.status,200);
  assert.match(publishHtml,/form-request-2/);
  const published=current.user_metadata.atlas_problem_spaces.publishing_workspace.notes;
  assert.equal(published.length,1);
  assert.equal(published[0].is_published,true);
  assert.equal(published[0].is_shared,true);
  assert.match(published[0].share_token,/^[A-Za-z0-9_-]{24}$/);
 });
});

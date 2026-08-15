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

function mockSupabase(initial=account){
 const calls=[];let current=structuredClone(initial);
 const fetchImpl=async(url,options={})=>{
  const parsed=new URL(url),headers=options.headers||{};calls.push({path:parsed.pathname,search:parsed.search,headers,method:options.method||'GET',body:options.body});
  if(parsed.pathname==='/auth/v1/user'){
   if((options.method||'GET')==='PUT'){current={...current,user_metadata:{...current.user_metadata,...JSON.parse(options.body).data}};return new Response(JSON.stringify({user:current}),{status:200,headers:{'Content-Type':'application/json'}})}
   return new Response(JSON.stringify(current),{status:200,headers:{'Content-Type':'application/json'}});
  }
  if(parsed.pathname.startsWith('/auth/v1/admin/users/')){
   if((options.method||'GET')==='PUT')current={...current,user_metadata:{...current.user_metadata,...JSON.parse(options.body).user_metadata}};
   return new Response(JSON.stringify(current),{status:200,headers:{'Content-Type':'application/json'}});
  }
  if(parsed.pathname==='/auth/v1/admin/users')return new Response(JSON.stringify({users:[current]}),{status:200,headers:{'Content-Type':'application/json'}});
  if(parsed.pathname.startsWith('/rest/v1/'))return new Response('[]',{status:200,headers:{'Content-Type':'application/json'}});
  return new Response('{}',{status:404,headers:{'Content-Type':'application/json'}});
 };
 return{fetchImpl,calls,current:()=>current};
}

async function withServer(router,run){
 const app=express();app.use(express.json({limit:'1mb'}));app.use(router);const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve));
 try{return await run(`http://127.0.0.1:${server.address().port}`)}finally{await new Promise(resolve=>server.close(resolve))}
}

function gatewaySession(subject){const now=Math.floor(Date.now()/1000),header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),payload=Buffer.from(JSON.stringify({iss:'https://project.supabase.co/auth/v1',aud:'authenticated',role:'authenticated',sub:subject,iat:now,exp:now+3600})).toString('base64url');return`${header}.${payload}.gateway-signature`}

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

test('workspace accepts the same-origin session mirror and never caches missing-token errors',async()=>{
 const mock=mockSupabase(),env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test'};
 await withServer(createWorkspaceRouter({env,fetchImpl:mock.fetchImpl}),async base=>{
  const verified=await fetch(`${base}/api/workspaces/legal_case/ny-kalshi-enforcement-2026`,{headers:{'X-Atlas-Session':'user-token'}}),data=await verified.json();
  assert.equal(verified.status,200);assert.equal(data.workspace.title,'Kalshi analysis');
  const missing=await fetch(`${base}/api/workspaces/baseball_player/777777`),error=await missing.json(),cache=missing.headers.get('cache-control')||'',vary=(missing.headers.get('vary')||'').toLowerCase();
  assert.equal(missing.status,401);assert.equal(error.code,'AUTH_TOKEN_MISSING');assert.match(cache,/private/);assert.match(cache,/no-store/);assert.match(vary,/authorization/);assert.match(vary,/x-atlas-session/);
 });
});

test('workspace status reports the server-side JWKS verification strategy',async()=>{
 const mock=mockSupabase(),env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test'};
 await withServer(createWorkspaceRouter({env,fetchImpl:mock.fetchImpl}),async base=>{
  const response=await fetch(`${base}/api/workspaces/status`),data=await response.json();
  assert.equal(response.status,200);
  assert.equal(data.signedIn,false);
  assert.equal(data.userSessionVerification,'jwks-or-postgrest-admin-with-auth-fallback');
  assert.equal(data.sessionVerification,'missing');
 });
});

test('workspace PUT performs one compatibility auth read and one bounded server metadata update',async()=>{
 const mock=mockSupabase(),env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test'};
 await withServer(createWorkspaceRouter({env,fetchImpl:mock.fetchImpl}),async base=>{
  const response=await fetch(`${base}/api/workspaces/baseball_player/669461`,{method:'PUT',headers:{Authorization:'Bearer user-token','Content-Type':'application/json'},body:JSON.stringify({resource_title:'Matthew Liberatore',title:'API-only draft',body:'<p>Saved</p>',intent:'save'})}),data=await response.json();
  assert.equal(response.status,200);
  assert.equal(data.workspace.resource_type,'baseball_player');
  assert.equal(data.workspace.resource_id,'669461');
  assert.equal(data.workspace.title,'API-only draft');
 });
 const authRead=mock.calls.find(call=>call.path==='/auth/v1/user'),update=mock.calls.find(call=>call.path==='/auth/v1/admin/users/user-1'&&call.method==='PUT');
 assert.equal(authRead.method,'GET');
 assert.equal(authRead.headers.apikey,'sb_secret_test');
 assert.equal(authRead.headers.Authorization,'Bearer user-token');
 assert.equal(update.headers.apikey,'sb_secret_test');
 assert.equal(update.headers.Authorization,undefined);
 const patch=JSON.parse(update.body).user_metadata;
 assert.deepEqual(Object.keys(patch).map(key=>key.startsWith('atlas_workspace_record_v2_')), [true]);
 assert.equal('atlas_problem_spaces'in patch,false);
 assert.equal(mock.calls.some(call=>call.path==='/rest/v1/workspace_notes'),false);
});

test('a gateway-verified session can open and save a first player workspace without the user endpoint',async()=>{
 const subject='33333333-3333-4333-8333-333333333333',token=gatewaySession(subject),initial={id:subject,user_metadata:{atlas_profile:{username:'New Player Tester'}}},mock=mockSupabase(initial),calls=[];
 const fetchImpl=async(url,options={})=>{
  const parsed=new URL(url);calls.push({path:parsed.pathname,method:options.method||'GET',headers:options.headers,body:options.body});
  if(parsed.pathname==='/rest/v1/__atlas_session_verification_never_create__')return options.headers.Authorization===`Bearer ${token}`?new Response(JSON.stringify({code:'PGRST205',message:"Could not find the table 'public.__atlas_session_verification_never_create__' in the schema cache"}),{status:404,headers:{'Content-Type':'application/json'}}):new Response(JSON.stringify({code:'PGRST301',message:'No suitable key or wrong key type'}),{status:401,headers:{'Content-Type':'application/json'}});
  if(parsed.pathname==='/auth/v1/user')throw new Error('the failing user endpoint must not be used');
  return mock.fetchImpl(url,options);
 };
 const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test'};
 await withServer(createWorkspaceRouter({env,fetchImpl}),async base=>{
  const load=await fetch(`${base}/api/workspaces/baseball_player/777777`,{headers:{Authorization:`Bearer ${token}`}}),loaded=await load.json();
  assert.equal(load.status,200);assert.equal(loaded.workspace,null);
  const save=await fetch(`${base}/api/workspaces/baseball_player/777777`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({resource_title:'New player',title:'First scouting list',body:'<ul><li>First note</li></ul>',intent:'save'})}),saved=await save.json();
  assert.equal(save.status,200);assert.equal(saved.workspace.resource_id,'777777');assert.equal(saved.workspace.title,'First scouting list');
 });
 assert.equal(calls.filter(call=>call.path==='/rest/v1/__atlas_session_verification_never_create__').length,2,'one positive and one tampered-signature probe are cached across load and save');
 assert.equal(calls.some(call=>call.path==='/auth/v1/user'),false);
 const update=mock.calls.find(call=>call.path===`/auth/v1/admin/users/${subject}`&&call.method==='PUT'),patch=JSON.parse(update.body).user_metadata;
 assert.deepEqual(Object.keys(patch).map(key=>key.startsWith('atlas_workspace_record_v2_')),[true]);
});

test('workspace PUT does not resend unrelated large account metadata',async()=>{
 const largeAccount=structuredClone(account);largeAccount.user_metadata.atlas_problem_spaces.logistics_game={progress:{state:'x'.repeat(400000)}};
 largeAccount.user_metadata.atlas_problem_spaces.publishing_workspace.notes.push({id:'existing-player-note',user_id:'user-1',resource_type:'baseball_player',resource_id:'695491',resource_title:'Joshua Báez',title:'Earlier scouting note',body:'<p>Old</p>',updated_at:'2026-08-01T00:00:00Z'});
 const mock=mockSupabase(largeAccount),env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test'};
 await withServer(createWorkspaceRouter({env,fetchImpl:mock.fetchImpl}),async base=>{
  const response=await fetch(`${base}/api/workspaces/baseball_player/695491`,{method:'PUT',headers:{Authorization:'Bearer user-token','Content-Type':'application/json'},body:JSON.stringify({title:'Updated scouting note',body:'<p>One player only</p>',intent:'save'})}),data=await response.json();
  assert.equal(response.status,200);
  assert.equal(data.workspace.id,'existing-player-note');
  assert.equal(data.workspace.title,'Updated scouting note');
 });
 const update=mock.calls.find(call=>call.path==='/auth/v1/admin/users/user-1'&&call.method==='PUT');
 assert.ok(update.body.length<5000,`workspace update unexpectedly sent ${update.body.length} bytes`);
 assert.doesNotMatch(update.body,/logistics_game/);
});

test('a newly segmented publication is immediately discoverable',async()=>{
 const fresh={id:'publisher',user_metadata:{atlas_profile:{username:'Scout',profile_slug:'scout'}}},mock=mockSupabase(fresh),env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test'};
 const app=express();app.use(express.json({limit:'1mb'}));app.use(createWorkspaceRouter({env,fetchImpl:mock.fetchImpl}));app.use(createPublishedFeedRouter({env,fetchImpl:mock.fetchImpl}));const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve));
 try{
  const base=`http://127.0.0.1:${server.address().port}`,save=await fetch(`${base}/api/workspaces/baseball_player/669461`,{method:'PUT',headers:{Authorization:'Bearer user-token','Content-Type':'application/json'},body:JSON.stringify({resource_title:'Matthew Liberatore',title:'Fresh publication',body:'<p>Published</p>',is_shared:true,intent:'publish'})}),saved=await save.json();
  assert.equal(save.status,200);assert.match(saved.workspace.share_token,/^[A-Za-z0-9_-]{24}$/);
  const feed=await fetch(`${base}/api/published-feed`),data=await feed.json();assert.equal(feed.status,200);assert.equal(data.publications.length,1);assert.equal(data.publications[0].title,'Fresh publication');assert.equal(data.publications[0].share_token,saved.workspace.share_token);
 }finally{await new Promise(resolve=>server.close(resolve))}
});

test('form-navigation fallback saves and publishes a first workspace to canonical account metadata',async()=>{
 let current={id:'user-form',user_metadata:{atlas_profile:{username:'Form Tester'},atlas_problem_spaces:{}}};
 const storage={
  requestUser:async req=>{
   assert.equal(req.get('authorization'),'Bearer form-token');
   return{token:'form-token',current};
  },
  patchUser:async(req,updater)=>{
   assert.equal(req.get('authorization'),'Bearer form-token');
   const patch=await updater(structuredClone(current.user_metadata),current);
   current={...current,user_metadata:{...current.user_metadata,...patch}};
   return{patch,user:current};
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
  const notes=Object.entries(current.user_metadata).filter(([key])=>key.startsWith('atlas_workspace_record_v2_')).map(([,value])=>value);
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
  const published=Object.entries(current.user_metadata).filter(([key])=>key.startsWith('atlas_workspace_record_v2_')).map(([,value])=>value);
  assert.equal(published.length,1);
  assert.equal(published[0].is_published,true);
  assert.equal(published[0].is_shared,true);
  assert.match(published[0].share_token,/^[A-Za-z0-9_-]{24}$/);
 });
});

test('large Unicode workspace payloads fit both JSON and form save transports',async()=>{
 let current={id:'large-user',user_metadata:{atlas_profile:{username:'Large Writer'}}};
 const storage={
  patchUser:async(req,updater)=>{const patch=await updater(structuredClone(current.user_metadata),current);current={...current,user_metadata:{...current.user_metadata,...patch}};return{patch,user:current}}
 };
 const body=`<p>${'数'.repeat(59990)}</p>`,payload={resource_title:'Large player note',title:'Large note',body,ai_prompt:'分'.repeat(11900),intent:'save'};
 await withServer(createWorkspaceRouter({env:{},storage}),async base=>{
  const direct=await fetch(`${base}/api/workspaces/baseball_player/695491`,{method:'PUT',headers:{Authorization:'Bearer large-token','Content-Type':'application/json'},body:JSON.stringify(payload)});
  assert.equal(direct.status,200);
  const form=new URLSearchParams({request_id:'large-form',access_token:'large-token',payload:JSON.stringify(payload)});
  assert.ok(form.toString().length>160*1024,'fixture must exceed the former form limit');
  const fallback=await fetch(`${base}/api/workspaces-form/baseball_player/695492?request_id=large-form`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form}),html=await fallback.text();
  assert.equal(fallback.status,200);
  assert.match(html,/large-form/);
  assert.match(html,/"ok":true/);
 });
});

test('an oversized form returns an immediate structured error envelope',async()=>{
 const storage={patchUser:async()=>{throw new Error('should not run')}};
 await withServer(createWorkspaceRouter({env:{},storage}),async base=>{
  const form=new URLSearchParams({request_id:'too-large',access_token:'token',payload:'x'.repeat(3*1024*1024)});
  const response=await fetch(`${base}/api/workspaces-form/baseball_player/1?request_id=too-large`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form}),html=await response.text();
  assert.equal(response.status,200);
  assert.match(html,/too-large/);
  assert.match(html,/Workspace payload is too large/);
  assert.match(html,/"status":413/);
 });
});

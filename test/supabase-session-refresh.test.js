import test from 'node:test';
import assert from 'node:assert/strict';

const SESSION_KEY='atlas-harbor-session';
const runtime={configured:true,supabaseUrl:'https://project.supabase.co',supabasePublishableKey:'sb_publishable_test'};
let serial=0;

function json(value,status=200){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}})}
function storage(initial={}){const values=new Map(Object.entries(initial));return{getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),clear:()=>values.clear()}}
function savedSession(overrides={}){return{access_token:'old-access',refresh_token:'old-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'user-1',user_metadata:{}},...overrides}}
async function loadClient(initialSession,fetchImpl){globalThis.localStorage=storage({[SESSION_KEY]:JSON.stringify(initialSession)});globalThis.__atlasNativeFetch=fetchImpl;return import(`../public/supabase-client.js?session-test=${++serial}`)}
function cleanup(){delete globalThis.localStorage;delete globalThis.__atlasNativeFetch}

test('concurrent refresh callers share one rotating refresh-token request',async()=>{
 let refreshCalls=0,startRefresh,releaseRefresh;
 const started=new Promise(resolve=>{startRefresh=resolve}),gate=new Promise(resolve=>{releaseRefresh=resolve});
 const next=savedSession({access_token:'new-access',refresh_token:'new-refresh'});
 const client=await loadClient(savedSession(),async url=>{
  if(url==='/api/config')return json(runtime);
  if(url==='/api/account/session/refresh'){refreshCalls++;startRefresh();await gate;return json(next)}
  throw new Error(`Unexpected request: ${url}`);
 });
 try{
  const first=client.refreshSession(),second=client.refreshSession();
  await started;
  assert.equal(refreshCalls,1);
  releaseRefresh();
  const [left,right]=await Promise.all([first,second]);
  assert.equal(left.access_token,'new-access');
  assert.equal(right.access_token,'new-access');
  assert.equal(client.accessToken(),'new-access');
 }finally{cleanup()}
});

test('freshAccessToken proactively refreshes an expired cached session',async()=>{
 let refreshCalls=0;
 const client=await loadClient(savedSession({expires_at:Math.floor(Date.now()/1000)-5}),async url=>{
  if(url==='/api/config')return json(runtime);
  if(url==='/api/account/session/refresh'){refreshCalls++;return json(savedSession({access_token:'proactive-access',refresh_token:'proactive-refresh'}))}
  throw new Error(`Unexpected request: ${url}`);
 });
 try{
  assert.equal(await client.freshAccessToken(),'proactive-access');
  assert.equal(refreshCalls,1);
 }finally{cleanup()}
});

test('a stale failed refresh adopts a newer session instead of clearing it',async()=>{
 const newer=savedSession({access_token:'other-access',refresh_token:'other-refresh'});
 const client=await loadClient(savedSession(),async url=>{
  if(url==='/api/config')return json(runtime);
  if(url==='/api/account/session/refresh'){localStorage.setItem(SESSION_KEY,JSON.stringify(newer));throw new TypeError('network failed after another caller refreshed')}
  throw new Error(`Unexpected request: ${url}`);
 });
 try{
  const result=await client.refreshSession();
  assert.equal(result.access_token,'other-access');
  assert.equal(client.accessToken(),'other-access');
 }finally{cleanup()}
});

test('authenticatedFetch retries a rejected request with the refreshed bearer',async()=>{
 const seen=[];
 const client=await loadClient(savedSession(),async(url,options={})=>{
  if(url==='/api/config')return json(runtime);
  if(url==='/api/account/session/refresh')return json(savedSession({access_token:'retry-access',refresh_token:'retry-refresh'}));
  if(url==='/api/workspaces/status'){const headers=new Headers(options.headers);seen.push({authorization:headers.get('Authorization'),session:headers.get('X-Atlas-Session'),refreshRetry:options.atlasSessionRefreshRetry===true});return seen.length===1?json({error:'expired'},401):json({ok:true,signedIn:true})}
  throw new Error(`Unexpected request: ${url}`);
 });
 try{
  const response=await client.authenticatedFetch('/api/workspaces/status',{headers:{Accept:'application/json'}});
  assert.equal(response.status,200);
  assert.deepEqual(seen,[{authorization:'Bearer old-access',session:'old-access',refreshRetry:false},{authorization:'Bearer retry-access',session:'retry-access',refreshRetry:true}]);
 }finally{cleanup()}
});

test('sign-in and refresh stay behind the Atlas Harbor session API',async()=>{
 const seen=[];
 const client=await loadClient(null,async(url,options={})=>{seen.push({url,options});return json(savedSession())});
 try{
  await client.signIn('author@example.com','password');
  await client.refreshSession();
  assert.deepEqual(seen.map(item=>item.url),['/api/account/session/sign-in','/api/account/session/refresh']);
  assert.ok(seen.every(item=>item.options.credentials==='same-origin'));
  assert.ok(seen.every(item=>!String(item.url).includes('supabase.co')));
 }finally{cleanup()}
});

test('authenticatedFetch never mirrors the Atlas session header to another origin',async()=>{
 let seen;
 const client=await loadClient(savedSession(),async(url,options={})=>{seen=new Headers(options.headers);return json({ok:true})});
 try{
  const response=await client.authenticatedFetch('https://project.supabase.co/rest/v1/example');
  assert.equal(response.status,200);
  assert.equal(seen.get('Authorization'),'Bearer old-access');
  assert.equal(seen.get('X-Atlas-Session'),null);
 }finally{cleanup()}
});

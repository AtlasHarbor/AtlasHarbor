import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('public publication discovery does not use the signed-in session snapshot as its canonical account dataset',()=>{
 const source=read('../src/published-feed.js');
 assert.match(source,/const publicAccounts=\[\]/);
 assert.match(source,/let current=null/);
 assert.match(source,/if\(response\.ok\)current=await readJson\(response\)/);
 assert.match(source,/for\(const account of data\?\.users\|\|\[\]\)publicAccounts\.push\(account\)/);
 assert.match(source,/if\(!adminLoaded&&current\)publicAccounts\.push\(current\)/);
 assert.doesNotMatch(source,/found\.push\(current\)/);
 assert.match(source,/isOwner=Boolean\(row&&current&&row\.user_id===current\.id\)/);
});

test('Baseball workspace transport retries only the same-origin workspace API',()=>{
 const source=read('../public/workspace-transport-fallback.js');
 assert.doesNotThrow(()=>new Function(source.replace(/export\s+/g,'')));
 assert.match(source,/url\.pathname\.startsWith\('\/api\/workspaces\/'\)/);
 assert.match(source,/url\.origin===location\.origin/);
 assert.match(source,/xhrRequest/);
 assert.doesNotMatch(source,/auth\/v1\/user/);
 assert.doesNotMatch(source,/configuredSupabaseOrigin/);
 assert.doesNotMatch(source,/rest\/v1\/workspace_notes/);
 assert.doesNotMatch(source,/localStorage\.setItem\([^)]*workspace/i);
});

test('AUTH_TOKEN_MISSING from fetch advances to XHR with both session headers',async()=>{
 const priorLocation=globalThis.location,priorFetch=globalThis.__atlasNativeFetch,priorXhr=globalThis.XMLHttpRequest,seen=[];
 globalThis.location={origin:'https://atlas.test',href:'https://atlas.test/baseball/players/777777'};
 globalThis.__atlasNativeFetch=async()=>new Response(JSON.stringify({error:'Sign in required.',code:'AUTH_TOKEN_MISSING'}),{status:401,headers:{'Content-Type':'application/json'}});
 globalThis.XMLHttpRequest=class{
  open(method,url){this.method=method;this.url=url}
  setRequestHeader(name,value){seen.push([name,value])}
  getAllResponseHeaders(){return'Content-Type: application/json'}
  send(){this.status=200;this.statusText='OK';this.responseText=JSON.stringify({workspace:null,storage:'empty'});queueMicrotask(()=>this.onload())}
 };
 try{
  const{installWorkspaceTransportFallback}=await import(`../public/workspace-transport-fallback.js?missing-token=${Date.now()}`);installWorkspaceTransportFallback();
  const response=await globalThis.__atlasNativeFetch('/api/workspaces/baseball_player/777777',{headers:{Authorization:'Bearer browser-token','X-Atlas-Session':'browser-token'}}),data=await response.json();
  assert.equal(response.status,200);assert.equal(data.storage,'empty');
  assert.ok(seen.some(([name,value])=>name.toLowerCase()==='authorization'&&value==='Bearer browser-token'));
  assert.ok(seen.some(([name,value])=>name.toLowerCase()==='x-atlas-session'&&value==='browser-token'));
 }finally{
  if(priorLocation===undefined)delete globalThis.location;else globalThis.location=priorLocation;
  if(priorFetch===undefined)delete globalThis.__atlasNativeFetch;else globalThis.__atlasNativeFetch=priorFetch;
  if(priorXhr===undefined)delete globalThis.XMLHttpRequest;else globalThis.XMLHttpRequest=priorXhr;
 }
});

test('shared workspace saves only through the same-origin API and never calls Supabase directly',()=>{
 const source=read('../public/workspace.js');
 assert.match(source,/atlas_problem_spaces/);
 assert.match(source,/publishing_workspace/);
 assert.match(source,/accountRecord/);
 assert.match(source,/\/api\/workspaces\//);
 assert.doesNotMatch(source,/auth\/v1\/user/);
 assert.doesNotMatch(source,/freshAccount|persistDirectMetadata|updateUserMetadata/);
 assert.doesNotMatch(source,/localStorage\.setItem/);
});

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

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

test('Baseball workspace fallback retries both the canonical workspace API and canonical Supabase account metadata over XHR',()=>{
 const source=read('../public/workspace-transport-fallback.js');
 assert.doesNotThrow(()=>new Function(source.replace(/export\s+/g,'')));
 assert.match(source,/url\.pathname\.startsWith\('\/api\/workspaces\/'\)/);
 assert.match(source,/url\.pathname==='\/auth\/v1\/user'/);
 assert.match(source,/configuredSupabaseOrigin/);
 assert.match(source,/atlas-harbor-public-config/);
 assert.match(source,/xhrRequest/);
 assert.doesNotMatch(source,/workspace_notes/);
 assert.doesNotMatch(source,/localStorage\.setItem\([^)]*workspace/i);
});

test('shared workspace still uses the account metadata record and never a device analysis store',()=>{
 const source=read('../public/workspace.js');
 assert.match(source,/atlas_problem_spaces/);
 assert.match(source,/publishing_workspace/);
 assert.match(source,/accountRecord/);
 assert.match(source,/freshAccount/);
 assert.match(source,/persistDirectMetadata/);
 assert.doesNotMatch(source,/localStorage\.setItem/);
});

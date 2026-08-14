import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ensureE2ETestUser} from '../src/e2e-test-user.js';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('published list is anonymous while publication detail keeps viewer identity only for owner controls',()=>{
 const guard=read('../public/published-public-feed.js');
 const server=read('../src/published-feed.js');
 assert.match(guard,/url\.pathname === '\/api\/published-feed'/);
 assert.match(guard,/headers\.delete\('Authorization'\)/);
 assert.match(guard,/credentials: 'omit'/);
 assert.doesNotMatch(guard,/published-feed\\\/\[\^\/\]\+/);
 assert.doesNotMatch(server,/publicAccounts\.push\(current\)/);
 assert.match(server,/isOwner=Boolean\(row&&current&&row\.user_id===current\.id\)/);
 assert.match(server,/safeDetail\(row,isOwner\)/);
});

test('Baseball workspace read recovery uses authenticated session metadata without creating a local editable store',()=>{
 const fallback=read('../public/workspace-transport-fallback.js');
 assert.match(fallback,/atlas_problem_spaces\?\.publishing_workspace\?\.notes/);
 assert.match(fallback,/authenticated-session-empty/);
 assert.match(fallback,/X-Atlas-Workspace-Recovery/);
 assert.doesNotMatch(fallback,/localStorage\.setItem\([^\n]*(workspace|draft|analysis)/i);
 assert.match(fallback,/if\(method!=='GET'\)return null/);
});

test('player and admin Baseball exports package the current account analysis',()=>{
 const playerExport=read('../public/baseball-player-export.js');
 const admin=read('../src/baseball-admin-router.js');
 assert.match(playerExport,/myAnalysis:analysis\|\|null/);
 assert.match(playerExport,/publishing_workspace\?\.notes/);
 assert.match(admin,/myPlayerAnalyses/);
 assert.match(admin,/analysisByPlayerId/);
 assert.match(admin,/resource_type==='baseball_player'/);
});

test('E2E account seeding is off by default and never hardcodes credentials',async()=>{
 const source=read('../src/e2e-test-user.js');
 assert.doesNotMatch(source,/test11111!/i);
 assert.doesNotMatch(source,/test@test\.com/i);
 const result=await ensureE2ETestUser({env:{},fetchImpl:async()=>{throw new Error('must not fetch')}});
 assert.deepEqual(result,{enabled:false,created:false,user:null});
});

test('production E2E seeding requires an explicit second guard',async()=>{
 await assert.rejects(()=>ensureE2ETestUser({env:{ATLAS_E2E_TEST_ENABLED:'true',NODE_ENV:'production',SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEY:'secret',ATLAS_E2E_TEST_EMAIL:'example@example.com',ATLAS_E2E_TEST_PASSWORD:'example-password'},fetchImpl:async()=>{throw new Error('must not fetch')}}),/ATLAS_E2E_ALLOW_PRODUCTION=true/);
});

test('REST smoke script checks workspace save plus anonymous and authenticated publication detail',()=>{
 const smoke=read('../scripts/baseball-workspace-smoke.js');
 assert.match(smoke,/\/api\/workspaces\/status/);
 assert.match(smoke,/method:'PUT'/);
 assert.match(smoke,/featured:false/);
 assert.match(smoke,/const anonymous=/);
 assert.match(smoke,/const authenticated=/);
 assert.match(smoke,/anonymous\.publication\.share_token!==authenticated\.publication\.share_token/);
});

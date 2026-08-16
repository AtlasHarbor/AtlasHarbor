import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const transport=fs.readFileSync(new URL('../public/workspace-transport-fallback.js',import.meta.url),'utf8');
const workspaceApi=fs.readFileSync(new URL('../src/workspace-api.js',import.meta.url),'utf8');
const publicFeed=fs.readFileSync(new URL('../public/published-public-feed.js',import.meta.url),'utf8');
const publishedHtml=fs.readFileSync(new URL('../public/published.html',import.meta.url),'utf8');
const playerExport=fs.readFileSync(new URL('../public/baseball-player-export.js',import.meta.url),'utf8');
const accountPosts=fs.readFileSync(new URL('../public/account-posts.js',import.meta.url),'utf8');
const accountExport=fs.readFileSync(new URL('../public/account-baseball-export.js',import.meta.url),'utf8');
const accountHtml=fs.readFileSync(new URL('../public/account.html',import.meta.url),'utf8');
const accountJs=fs.readFileSync(new URL('../public/account.js',import.meta.url),'utf8');
const messages=fs.readFileSync(new URL('../public/messages.js',import.meta.url),'utf8');
const searchRouter=fs.readFileSync(new URL('../src/baseball-search-router.js',import.meta.url),'utf8');
const bootstrap=fs.readFileSync(new URL('../src/test-account-bootstrap.js',import.meta.url),'utf8');
const authScript=fs.readFileSync(new URL('../scripts/test-auth-api.js',import.meta.url),'utf8');
const sessionApi=fs.readFileSync(new URL('../src/account-session-api.js',import.meta.url),'utf8');
const sessionCookie=fs.readFileSync(new URL('../src/account-session-cookie.js',import.meta.url),'utf8');
const supabaseClient=fs.readFileSync(new URL('../public/supabase-client.js',import.meta.url),'utf8');

test('first Baseball analysis opens empty only after read transports fail and retains a canonical save path',()=>{
 assert.match(transport,/firstBaseballWorkspaceCanOpenEmpty/);
 assert.match(transport,/await xhrRequest\(input,init\)/);
 assert.match(transport,/authenticated-session-empty/);
 assert.match(transport,/method!==['"]GET['"]/);
 assert.match(transport,/baseball_player/);
 assert.match(transport,/formWorkspaceRequest/);
 assert.match(transport,/\/api\/workspaces-form\//);
 assert.match(transport,/rememberWorkspaceInSession/);
 assert.match(workspaceApi,/router\.post\('\/api\/workspaces-form\/:resourceType\/:resourceId'/);
 assert.match(workspaceApi,/const result=await saveWorkspace\(req,body\)/);
 assert.match(workspaceApi,/await storage\.patchUser\(req,\(metadata,current\)=>/);
 assert.match(workspaceApi,/workspaceMetadataKey\(resourceType,resourceId\)/);
 assert.doesNotMatch(workspaceApi,/mirrorWorkspaceTable/);
});

test('published list and publication detail are session-independent public reads',()=>{
 assert.match(publicFeed,/atlasPublishedPublicFirst/);
 assert.match(publicFeed,/published-feed/);
 assert.match(publicFeed,/headers\.delete\(['"]Authorization['"]\)/);
 assert.match(publicFeed,/credentials:\s*['"]omit['"]/);
 assert.ok(publishedHtml.indexOf('/published-public-feed.js')<publishedHtml.indexOf('/published.js'),'public-read wrapper must load before published.js');
});

test('single-player JSON export includes signed-in analysis when available',()=>{
 assert.match(playerExport,/analysis/);
 assert.match(playerExport,/api\/workspaces\/baseball_player/);
 assert.match(playerExport,/Authorization/);
 assert.match(playerExport,/sessionAnalysis/);
});

test('Account recovers posts and Space Blocks independently from canonical session metadata',()=>{
 assert.match(accountPosts,/sessionPosts/);
 assert.match(accountPosts,/publishing_workspace/);
 assert.match(accountPosts,/sessionBlocks/);
 assert.match(accountPosts,/manual_space_blocks/);
 assert.doesNotMatch(accountPosts,/Promise\.all\(\[api\('\/api\/workspaces\/account'/);
});

test('Account exposes signed-in league exports with player analyses',()=>{
 assert.match(accountHtml,/Baseball player data exports/);
 assert.match(accountHtml,/Triple-A/);
 assert.match(accountHtml,/Double-A/);
 assert.match(accountHtml,/account-baseball-export\.js/);
 assert.match(accountExport,/api\/baseball\/account-export/);
 assert.match(searchRouter,/router\.get\('\/api\/baseball\/account-export'/);
 assert.match(searchRouter,/metadataWorkspaceRecords/);
 assert.match(searchRouter,/analysisCount/);
});

test('Account puts verified session recovery and logout before long-form settings',()=>{
 assert.ok(accountHtml.indexOf('id="session-card"')<accountHtml.indexOf('id="settings-card"'));
 assert.match(accountHtml,/Log out and sign in again/);
 assert.equal((accountHtml.match(/id="sign-out"/g)||[]).length,1);
 assert.match(accountJs,/authenticatedFetch\('\/api\/workspaces\/status'/);
 assert.match(accountJs,/sessionCard\.hidden=!current/);
 assert.match(accountJs,/verify-session/);
 assert.match(accountJs,/addEventListener\('click',signOut\)/);
});

test('workspace auth is established through a signed same-origin server session',()=>{
 assert.match(sessionApi,/\/api\/account\/session\/sign-in/);
 assert.match(sessionApi,/token\?grant_type=password/);
 assert.match(sessionCookie,/HttpOnly/);
 assert.match(sessionCookie,/SameSite=Lax/);
 assert.match(sessionCookie,/timingSafeEqual/);
 assert.match(supabaseClient,/\/api\/account\/session\/\$\{path\}/);
 assert.match(supabaseClient,/signIn=.*auth\('sign-in'/);
 assert.match(supabaseClient,/\/api\/account\/session\/refresh/);
 assert.doesNotMatch(supabaseClient,/auth\('token\?grant_type=password'/);
 assert.match(sessionApi,/email_confirm:true/);
 assert.match(sessionApi,/await confirmSignup\(userId\)/);
 assert.match(accountJs,/Account created and signed in/);
 assert.doesNotMatch(accountJs,/Check email if confirmation is enabled/);
});

test('messaging failure never tells ordinary users to run SQL',()=>{
 assert.doesNotMatch(messages,/supabase\/dropshipping-space\.sql/);
 assert.match(messages,/Messaging is not enabled on this deployment yet/);
});

test('authenticated E2E account is secret-backed and exercises save plus public read parity',()=>{
 assert.match(bootstrap,/ATLAS_E2E_TEST_BOOTSTRAP/);
 assert.match(bootstrap,/ATLAS_E2E_TEST_EMAIL/);
 assert.match(bootstrap,/ATLAS_E2E_TEST_PASSWORD/);
 assert.doesNotMatch(bootstrap,/test@test\.com/);
 assert.match(authScript,/api\/workspaces\/baseball_player/);
 assert.match(authScript,/api\/published-feed/);
 assert.match(authScript,/anonymous/);
 assert.match(authScript,/authenticated/);
});

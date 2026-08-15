import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('Baseball player pages mount the shared publishable database workspace',()=>{
 const js=read('../public/account-indicator.js');
 assert.match(js,/type:'baseball_player'/);
 assert.match(js,/mountWorkspace/);
 assert.match(js,/workspace\.css/);
 assert.match(js,/installWorkspaceTransportFallback/);
 assert.match(js,/prospect-players/);
});

test('Baseball workspace transport can open a first note and save it without a device-only draft',()=>{
 const js=read('../public/workspace-transport-fallback.js');
 const server=read('../src/workspace-api.js');
 const app=read('../src/app.js');
 assert.match(js,/pathname\.startsWith\('\/api\/workspaces\/'\)/);
 assert.match(js,/XMLHttpRequest/);
 assert.match(js,/await xhrRequest/);
 assert.match(js,/firstBaseballWorkspaceCanOpenEmpty/);
 assert.match(js,/authenticated-session-empty/);
 assert.match(js,/formWorkspaceRequest/);
 assert.match(js,/X-Atlas-Session/);
 assert.match(js,/requestHeaders/);
 assert.match(js,/missingTokenResponse/);
 assert.match(js,/AUTH_TOKEN_MISSING/);
 assert.match(js,/method!==['"]PUT['"]/);
 assert.match(js,/\/api\/workspaces-form\//);
 assert.match(js,/form\.submit\(\)/);
 assert.match(js,/atlas-workspace-form-result/);
 assert.match(js,/event\.origin!==location\.origin/);
 assert.match(js,/rememberWorkspaceInSession/);
 assert.match(js,/atlas-harbor-session/);
 assert.doesNotMatch(js,/localStorage\.(?:setItem|getItem)\(['"]workspace_notes/);
 assert.match(server,/express\.urlencoded/);
 assert.match(server,/router\.post\('\/api\/workspaces-form\/:resourceType\/:resourceId'/);
 assert.match(server,/const result=await saveWorkspace\(req,body\)/);
 assert.match(server,/workspaceMetadataKey/);
 assert.match(server,/limit:'3mb'/);
 assert.match(app,/express\.json\(\{limit:["']1mb["']\}\)/);
});

test('Baseball stat grids expose hover and tap definitions for common abbreviations',()=>{
 const js=read('../public/baseball-stat-help.js');
 for(const stat of ['ERA','WHIP','IP','K/9','BB/9','AVG','OBP','SLG','OPS','BABIP','ISO','RBI','FLD%'])assert.ok(js.includes(`'${stat}'`),`missing ${stat} definition`);
 assert.match(js,/\.decision-grid span/);
 assert.match(js,/button\.title=/);
 assert.match(js,/baseball-stat-dialog/);
 assert.match(js,/aria-label/);
});

test('Baseball workspace starts before the optional account configuration status finishes',()=>{
 const js=read('../public/account-indicator.js');
 assert.ok(js.indexOf("mountBaseballWorkspace();")<js.indexOf('await configurationStatus()'));
});

test('Baseball workspace refreshes authentication centrally without a second blocking account-badge preflight',()=>{
 const workspace=read('../public/workspace.js'),indicator=read('../public/account-indicator.js'),client=read('../public/supabase-client.js');
 assert.match(workspace,/import\{user,ai,authenticatedFetch\}/);
 assert.match(workspace,/authenticatedFetch\(`\/api\/workspaces\//);
 assert.doesNotMatch(workspace,/Authorization:`Bearer/);
 assert.doesNotMatch(indicator,/authenticatedFetch/);
 assert.doesNotMatch(indicator,/\/api\/workspaces\/status/);
 assert.match(indicator,/const status=await configurationStatus\(\),current=user\(\)/);
 assert.match(client,/let cachedConfig,refreshPromise/);
 assert.match(client,/export async function freshAccessToken/);
 assert.match(client,/if\(refreshPromise\)return refreshPromise/);
 assert.match(client,/X-Atlas-Session/);
});

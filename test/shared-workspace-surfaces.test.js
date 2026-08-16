import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('every current analytical Problem Space mounts the shared workspace with its canonical resource type',()=>{
 const surfaces=[
  ['Legal',read('../public/legal.js'),['legal_case']],
  ['Economics',read('../public/economics.js'),['economics_story']],
  ['Life Sciences',read('../public/life-sciences.js'),['life_science_problem']],
  ['Propositions',read('../public/prop.js'),['go_to_market_report']],
  ['Lead Discovery and Logistics Planner',read('../public/research-projects.js'),['lead_project','logistics_project']],
  ['Baseball',read('../public/account-indicator.js'),['baseball_player','baseball_game','baseball_team']]
 ];
 for(const[name,source,resourceTypes]of surfaces){
  assert.match(source,/mountWorkspace/,`${name} must mount the shared workspace`);
  for(const resourceType of resourceTypes)assert.ok(source.includes(resourceType),`${name} is missing ${resourceType}`);
 }
});

test('all mounted surfaces persist through the one parameterized Atlas Harbor workspace API',()=>{
 const workspace=read('../public/workspace.js'),server=read('../src/workspace-api.js');
 assert.match(workspace,/import\{installWorkspaceTransportFallback\}from'\.\/workspace-transport-fallback\.js'/);
 assert.match(workspace,/installWorkspaceTransportFallback\(\)/);
 assert.match(workspace,/authenticatedFetch\(`\/api\/workspaces\/\$\{encodeURIComponent\(resource\.type\)\}\/\$\{encodeURIComponent\(resource\.id\)\}`/);
 assert.match(server,/router\.put\('\/api\/workspaces\/:resourceType\/:resourceId'/);
 assert.match(server,/workspaceMetadataKey\(resourceType,resourceId\)/);
 assert.doesNotMatch(workspace,/supabase\.co|\/auth\/v1\/user/);
});

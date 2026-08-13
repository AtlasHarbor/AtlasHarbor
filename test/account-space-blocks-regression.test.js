import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('account posts use canonical workspace service instead of direct workspace_notes REST',()=>{
 const js=read('../public/account-posts.js'),router=read('../src/problem-router.js');
 assert.match(js,/\/api\/workspaces\/account/);
 assert.doesNotMatch(js,/rest\(['"]workspace_notes/);
 assert.match(router,/router\.get\('\/api\/workspaces\/account'/);
 assert.match(router,/storage\.readUser\(req,'publishing_workspace'/);
});

test('manual proposition Space Blocks do not require Perplexity and remain normal prop resources',()=>{
 const html=read('../public/prop.html'),router=read('../src/problem-router.js');
 assert.match(html,/MANUAL SPACE BLOCK · NO AI REQUIRED/);
 assert.match(html,/contenteditable="true"/);
 assert.match(html,/data-cmd="bold"/);
 assert.match(html,/data-cmd="underline"/);
 assert.match(html,/data-link/);
 assert.match(router,/router\.post\('\/api\/prop\/manual'/);
 assert.match(router,/creation_mode:'manual'/);
 assert.match(router,/status:'published'/);
 assert.match(router,/storage\.writeGlobal\('go_to_market'/);
 assert.match(html,/go_to_market_report|prop-workspace/);
});

test('account settings expose owned Space Blocks',()=>{
 const html=read('../public/account.html'),js=read('../public/account-posts.js'),router=read('../src/problem-router.js');
 assert.match(html,/id="space-blocks-card"/);
 assert.match(js,/\/api\/prop\/manual\/mine/);
 assert.match(router,/router\.get\('\/api\/prop\/manual\/mine'/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('Baseball player pages mount the shared publishable database workspace',()=>{
 const js=read('../public/account-indicator.js');
 assert.match(js,/\/baseball\\\/players\\\/\(\\d\+\)/);
 assert.match(js,/type:'baseball_player'/);
 assert.match(js,/mountWorkspace/);
 assert.match(js,/workspace\.css/);
 assert.match(js,/installWorkspaceTransportFallback/);
});

test('Baseball workspace transport falls back to same-origin XHR without creating local drafts',()=>{
 const js=read('../public/workspace-transport-fallback.js');
 assert.match(js,/pathname\.startsWith\('\/api\/workspaces\/'\)/);
 assert.match(js,/XMLHttpRequest/);
 assert.match(js,/Authorization/);
 assert.match(js,/return await xhrRequest/);
 assert.doesNotMatch(js,/localStorage/);
 assert.doesNotMatch(js,/workspace_notes/);
});

test('Baseball stat grids expose hover and tap definitions for common abbreviations',()=>{
 const js=read('../public/baseball-stat-help.js');
 for(const stat of ['ERA','WHIP','IP','K/9','BB/9','AVG','OBP','SLG','OPS','BABIP','ISO','RBI','FLD%'])assert.match(js,new RegExp(`'${stat.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&')}'`));
 assert.match(js,/\.decision-grid span/);
 assert.match(js,/button\.title=/);
 assert.match(js,/baseball-stat-dialog/);
 assert.match(js,/aria-label/);
});

test('Baseball workspace starts before the optional account configuration status finishes',()=>{
 const js=read('../public/account-indicator.js');
 assert.ok(js.indexOf("mountBaseballWorkspace();")<js.indexOf('await configurationStatus()'));
});

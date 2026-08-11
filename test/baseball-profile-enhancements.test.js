import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const enhancements=read('../public/baseball-profile-enhancements.js');

test('Baseball player profiles use an icon-only top-layer autocomplete search',()=>{
 assert.doesNotThrow(()=>new Function(enhancements));
 assert.match(enhancements,/baseball-profile-search-launch/);
 assert.match(enhancements,/aria-label','Search baseball'/);
 assert.match(enhancements,/baseball-profile-search-overlay/);
 assert.match(enhancements,/aria-modal="true"/);
 assert.match(enhancements,/baseball-profile-search-close/);
 assert.match(enhancements,/body\.baseball-profile-search-open/);
 assert.match(enhancements,/backdrop-filter:blur/);
 assert.match(enhancements,/\/api\/baseball\/search\?q=/);
 assert.match(enhancements,/\/api\/baseball\/prospect-search\?q=/);
 assert.match(enhancements,/levels=mlb,aaa,aa,higha,lowa/);
 assert.match(enhancements,/AbortController/);
 assert.match(enhancements,/setTimeout\(\(\)=>search\(query\),280\)/);
 assert.match(enhancements,/ArrowDown/);
 assert.match(enhancements,/ArrowUp/);
 assert.match(enhancements,/Escape/);
 assert.match(enhancements,/\/baseball\/players\/\$\{item\.id\}/);
 assert.match(enhancements,/\/baseball\/teams\/\$\{item\.id\}/);
 assert.match(enhancements,/\/baseball\/games\/\$\{item\.id\}/);
 assert.doesNotMatch(enhancements,/profile-search-toggle.*<b>Search<\/b>/s);
});

test('Shohei Ohtani alone receives the combined hitting and pitching profile',()=>{
 assert.match(enhancements,/if\(Number\(match\[1\]\)!==660271\)return/);
 assert.match(enhancements,/SHOHEI OHTANI · TWO-WAY PLAYER/);
 assert.match(enhancements,/HITTING \+ PITCHING/);
 assert.match(enhancements,/hitting:season/);
 assert.match(enhancements,/pitching:season/);
 assert.match(enhancements,/hitting:career/);
 assert.match(enhancements,/pitching:career/);
 assert.match(enhancements,/title==='Professional career totals'/);
 assert.match(enhancements,/atlas-baseball-stats-rendered/);
});

test('Baseball bootstrap avoids document-wide mutation scanning',()=>{
 const indicator=read('../public/account-indicator.js');
 const workspace=read('../public/workspace-enhancements.js');
 assert.match(indicator,/import'\.\/baseball-profile-enhancements\.js';/);
 assert.doesNotMatch(indicator,/new MutationObserver/);
 assert.doesNotMatch(workspace,/observe\(document\.documentElement/);
 assert.match(workspace,/observer\.observe\(status,\{subtree:true,childList:true,characterData:true\}\)/);
 assert.match(workspace,/atlas-workspace-loaded/);
});

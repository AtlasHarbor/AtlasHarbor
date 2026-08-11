import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const enhancements=read('../public/baseball-profile-enhancements.js');

test('Baseball player profiles mount a responsive autocomplete search',()=>{
 assert.doesNotThrow(()=>new Function(enhancements));
 assert.match(enhancements,/\.report-nav\{position:sticky/);
 assert.match(enhancements,/@media\(max-width:900px\)/);
 assert.match(enhancements,/profile-search-toggle/);
 assert.match(enhancements,/aria-autocomplete=\"list\"/);
 assert.match(enhancements,/\/api\/baseball\/search\?q=/);
 assert.match(enhancements,/\/api\/baseball\/prospect-search\?q=/);
 assert.match(enhancements,/levels=mlb,aaa,aa,higha,lowa/);
 assert.match(enhancements,/ArrowDown/);
 assert.match(enhancements,/ArrowUp/);
 assert.match(enhancements,/Escape/);
 assert.match(enhancements,/\/baseball\/players\/\$\{item\.id\}/);
 assert.match(enhancements,/\/baseball\/teams\/\$\{item\.id\}/);
 assert.match(enhancements,/\/baseball\/games\/\$\{item\.id\}/);
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

test('Account indicator loads the Baseball player-profile enhancement module',()=>{
 const indicator=read('../public/account-indicator.js');
 assert.match(indicator,/import'\.\/baseball-profile-enhancements\.js';/);
});

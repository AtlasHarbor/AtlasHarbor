import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';

const polish=fs.readFileSync(new URL('../public/game-runtime-polish.js',import.meta.url),'utf8');
const gate=fs.readFileSync(new URL('../public/game-first-run-gate.js',import.meta.url),'utf8');
const progress=fs.readFileSync(new URL('../public/progress-v2.js',import.meta.url),'utf8');

test('runtime polish loads for the logistics game',()=>{
 assert.match(gate,/game-runtime-polish\.js/);
 assert.match(polish,/Export my game state/);
 assert.match(polish,/atlas-harbor-logistics-game-state-v1/);
});

test('legacy competitor markers cannot impersonate time-linked traffic',()=>{
 assert.match(polish,/\.map-marker\.rival\{display:none!important\}/);
 assert.match(polish,/global-live-shipment:not\(\[hidden\]\)/);
});

test('map details and related contracts are foreground interactions',()=>{
 assert.match(polish,/data-action=\"related\"/);
 assert.match(polish,/player-controlled contract/);
 assert.match(polish,/data-open-related/);
 assert.match(polish,/position:fixed!important;z-index:7600/);
});

test('capabilities are implementation projects rather than instant levels',()=>{
 assert.match(polish,/capabilityProjects/);
 assert.match(polish,/REVIEW IMPLEMENTATION/);
 assert.match(polish,/implementation started/);
 assert.match(polish,/completesAt/);
 assert.match(polish,/Network Visibility/);
 assert.match(polish,/early warning caught/i);
});

test('save messaging is concise',()=>{
 assert.doesNotMatch(progress,/account sync will retry on the next change/i);
 assert.match(progress,/status\('Saved'\)/);
});

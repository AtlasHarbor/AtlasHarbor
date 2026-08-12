import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';

const rebase=fs.readFileSync(new URL('../public/game-rebase-v3.js',import.meta.url),'utf8');
const time=fs.readFileSync(new URL('../public/game-time-authority.js',import.meta.url),'utf8');
const gate=fs.readFileSync(new URL('../public/game-first-run-gate.js',import.meta.url),'utf8');

test('opening premise matches an established operating 3PL',()=>{
 assert.match(rebase,/Stabilize the inherited network/);
 assert.doesNotMatch(rebase,/Win the first customer/);
});

test('network clock persists a career wall-clock anchor and original timezone',()=>{
 assert.match(time,/displayTimeZone/);
 assert.match(time,/displayAnchorMs/);
 assert.match(time,/Intl\.DateTimeFormat/);
 assert.match(time,/network-v3-wall-anchor/);
});

test('mobile keeps the operating map above customer promises',()=>{
 assert.match(rebase,/\.game-shell>\.map-panel\{order:-2!important\}/);
 assert.match(rebase,/\.game-shell>\.orders-panel\{order:-1!important\}/);
});

test('map objects surface their action panels in the foreground',()=>{
 assert.match(rebase,/leaflet-marker-icon/);
 assert.match(rebase,/network-object-surface/);
 assert.match(rebase,/foregroundPanels/);
});

test('receivables are actionable and can resolve early',()=>{
 assert.match(rebase,/Contact about payment/);
 assert.match(rebase,/CUSTOMER FOLLOW-UP PENDING/);
 assert.match(rebase,/paid .* early/i);
 assert.match(rebase,/Due within/);
 assert.match(rebase,/RECEIVABLE FOLLOW-UP/);
});

test('the rebase module is loaded through the game gate',()=>{
 assert.match(gate,/game-rebase-v3\.js/);
});

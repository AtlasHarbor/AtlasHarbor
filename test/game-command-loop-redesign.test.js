import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';

const gate=fs.readFileSync(new URL('../public/game-first-run-gate.js',import.meta.url),'utf8');
const command=fs.readFileSync(new URL('../public/game-command-loop-v2.js',import.meta.url),'utf8');
const entities=fs.readFileSync(new URL('../public/game-entity-interactions-v2.js',import.meta.url),'utf8');
const career=fs.readFileSync(new URL('../public/game-career-loop-v2.js',import.meta.url),'utf8');

test('new command experience loads with the game',()=>{
 assert.match(gate,/game-command-loop-v2\.js/);
 assert.match(gate,/game-entity-interactions-v2\.js/);
 assert.match(gate,/game-career-loop-v2\.js/);
});

test('primary dashboard exposes an actionable manager queue and hides artificial disruption control',()=>{
 assert.match(command,/WHAT NEEDS YOU NOW/);
 assert.match(command,/Manager command queue/);
 assert.match(command,/#generate-issue\{display:none!important\}/);
 assert.match(command,/REQUESTS & COMMITMENTS/);
});

test('see on map closes text layers and focuses physical map state',()=>{
 assert.match(command,/data-focus-map/);
 assert.match(command,/closeTextLayers/);
 assert.match(command,/focusSelectedMapAction/);
 assert.match(command,/scrollIntoView/);
});

test('renewal is a real timed commercial request rather than a missing proxy action',()=>{
 assert.match(command,/data-portal-action=\"renew\"/);
 assert.match(command,/commercialRequests/);
 assert.match(command,/readyAt:Number\(state\.totalHours\|\|0\)\+48/);
 assert.match(command,/Commercial follow-up/);
});

test('requests can be withdrawn or accelerated and live in career state',()=>{
 assert.match(command,/Cancel \/ withdraw/);
 assert.match(command,/Accelerate/);
 assert.match(command,/staffingPipeline/);
 assert.match(command,/capacityPipeline/);
 assert.match(command,/capabilityProjects/);
 assert.doesNotMatch(command,/localStorage\.setItem\([^)]*request/i);
});

test('people competitors and operations history are interactive',()=>{
 assert.match(entities,/\.staff-card/);
 assert.match(entities,/\.rival-card/);
 assert.match(entities,/\.feed-item/);
 assert.match(entities,/CLICK FOR ROLE & ACTIONS/);
 assert.match(entities,/CLICK FOR COMPETITIVE CONTEXT/);
 assert.match(entities,/tabIndex=0/);
});

test('career can create follow-on orders and expose failure pressure',()=>{
 assert.match(career,/GROWTH OPPORTUNITIES/);
 assert.match(career,/Accept work/);
 assert.match(career,/PO-R/);
 assert.match(career,/TURNAROUND REQUIRED/);
 assert.match(career,/Your company can fail from here/);
});

test('redesign does not use a document-wide mutation observer',()=>{
 assert.doesNotMatch(command,/observe\(document\.(?:documentElement|body)/);
 assert.doesNotMatch(entities,/MutationObserver/);
 assert.doesNotMatch(career,/MutationObserver/);
});

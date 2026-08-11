import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';

const replay=fs.readFileSync(new URL('../public/game-replay-controller.js',import.meta.url),'utf8');
const game=fs.readFileSync(new URL('../public/game.html',import.meta.url),'utf8');

test('catch-up replay owns the visible dashboard clock',()=>{
 assert.match(replay,/CATCH-UP NETWORK TIME/);
 assert.match(replay,/Catching up \$\{from\} → \$\{to\}/);
 assert.match(replay,/CATCHING UP · \$\{current\} · \$\{percent\}%/);
 assert.match(replay,/atlas-game-replay-clock/);
 assert.match(replay,/detail\.currentHour/);
});

test('catch-up is a ten second presentation and disables live speed controls',()=>{
 assert.match(replay,/TARGET_MS=10000/);
 assert.match(replay,/button\.disabled=true/);
 assert.match(replay,/button\.disabled=false/);
 assert.match(replay,/atlas-network-catching-up/);
});

test('first-run catch-up waits until onboarding and incident overlays are out of the way',()=>{
 assert.match(replay,/atlas-first-run-tour/);
 assert.match(replay,/#intro:not\(\[hidden\]\)/);
 assert.match(replay,/if\(blocked\(\)\)/);
});

test('game loads replay controller before the time authority and simulation',()=>{
 const replayIndex=game.indexOf('/game-replay-controller.js');
 const timeIndex=game.indexOf('/game-time-authority.js');
 const simulationIndex=game.indexOf('/game-global-simulation-v2.js');
 assert.ok(replayIndex>=0&&timeIndex>replayIndex&&simulationIndex>timeIndex);
});

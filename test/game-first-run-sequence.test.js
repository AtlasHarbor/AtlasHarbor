import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('first-run gate keeps the incident behind the dashboard tutorial',()=>{const gate=read('../public/game-first-run-gate.js'),html=read('../public/game.html');assert.doesNotThrow(()=>new Function(gate));assert.match(gate,/dashboardTourVersion/);assert.match(gate,/atlas-first-run-tour/);assert.match(gate,/node\.hidden=true/);assert.match(gate,/releaseIncident/);assert.ok(html.indexOf('game-first-run-gate.js')<html.indexOf('game-onboarding-v2.js'))});

test('first incident is framed as the post-tutorial decision rather than the tutorial itself',()=>{const html=read('../public/game.html');assert.match(html,/FIRST LIVE EXCEPTION/);assert.match(html,/The walkthrough is complete/);assert.match(html,/Open first exception/);assert.match(html,/You can close this brief without deciding/)});

test('incident lightbox is independently scrollable and close button cannot stretch full width',()=>{const css=read('../public/game-first-run.css');assert.match(css,/\.intro\{[^}]*overflow-y:auto/);assert.match(css,/\.intro-card\{[^}]*max-height:/);assert.match(css,/\.intro-card\{[^}]*overflow-y:auto/);assert.match(css,/\.intro-card>\.intro-close\{[^}]*width:44px!important/);assert.match(css,/min-width:44px!important/);assert.match(css,/#take-command\{width:100%/)});

test('the existing first exception action still opens the base-game exception',()=>{const game=read('../public/game-v3.js');assert.match(game,/#take-command/);assert.match(game,/openException\('EX-001'\)/)});

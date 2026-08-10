import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('game loads the interaction feedback layer after core game modules',()=>{
 const html=read('../public/game.html');
 assert.match(html,/game-interactions\.css/);
 assert.match(html,/game-interactions\.js/);
 assert.ok(html.indexOf('/game-interactions.js')>html.indexOf('/game-v3.js'));
});

test('contract cards reveal the existing actionable detail panel instead of silently selecting state',()=>{
 const js=read('../public/game-interactions.js');
 assert.match(js,/\.order-card\[data-order\]/);
 assert.match(js,/revealContractDetails/);
 assert.match(js,/#map-action-card/);
 assert.match(js,/#decision-card/);
 assert.match(js,/scrollIntoView/);
 assert.match(js,/Opening \$\{order\} details and actions/);
 assert.match(js,/aria-current/);
});

test('mobile contract details are an immediate bottom action sheet',()=>{
 const css=read('../public/game-interactions.css');
 assert.match(css,/@media\(max-width:780px\)/);
 assert.match(css,/\.map-action-card:not\(\[hidden\]\)/);
 assert.match(css,/position:fixed!important/);
 assert.match(css,/bottom:calc\(10px \+ env\(safe-area-inset-bottom\)\)/);
 assert.match(css,/Contract details & actions/);
 assert.match(css,/\.map-actions button\{width:100%;min-height:46px/);
});

test('all game actions have immediate pressed or acknowledgment feedback',()=>{
 const js=read('../public/game-interactions.js'),css=read('../public/game-interactions.css');
 assert.match(js,/pointerdown/);
 assert.match(js,/button,\.order-card,\.fleet-card/);
 assert.match(js,/game-pressed/);
 assert.match(js,/game-action-ack/);
 assert.match(js,/role','status/);
 assert.match(css,/\.game-pressed/);
 assert.match(css,/@keyframes gameActionAck/);
});

test('disruption control is framed as an optional scenario drill',()=>{
 const html=read('../public/game.html'),js=read('../public/game-interactions.js');
 assert.doesNotMatch(html,/>Create disruption</);
 assert.match(html,/Run scenario drill/);
 assert.match(html,/Optional: inject a simulated disruption to practice exception management/);
 assert.match(js,/Run scenario drill/);
});

test('contract and movement cards expose a clear detail affordance',()=>{
 const css=read('../public/game-interactions.css'),html=read('../public/game.html');
 assert.match(css,/Tap for details →/);
 assert.match(html,/Tap any contract to open its details and actions/);
 assert.match(html,/On mobile, the action sheet opens immediately/);
});

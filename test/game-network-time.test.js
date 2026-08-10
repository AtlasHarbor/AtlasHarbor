import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('authoritative clock suppresses both legacy simulation timers',()=>{const js=read('../public/game-time-authority.js'),html=read('../public/game.html');assert.doesNotThrow(()=>new Function(js));assert.match(js,/REAL_MS_PER_GAME_HOUR=15\*60\*1000/);assert.match(js,/suppressed\.base/);assert.match(js,/advance/);assert.match(js,/suppressed\.command/);assert.match(js,/clockTick/);assert.match(js,/authority='network-v2'/);assert.ok(html.indexOf('game-time-authority.js')<html.indexOf('game-v3.js'));assert.ok(html.indexOf('game-time-authority.js')<html.indexOf('game-command-center.js'))});

test('normal one-times speed accumulates every real second instead of only extra speed',()=>{const js=read('../public/game-time-authority.js');assert.match(js,/clock\.extraCarryMs\+=delta\*clock\.speed/);assert.doesNotMatch(js,/delta\*Math\.max\(0,clock\.speed-1\)/);assert.match(js,/Math\.floor\(clock\.extraCarryMs\/REAL_MS_PER_GAME_HOUR\)/);assert.match(js,/nativeSetInterval\(tick,1000\)/)});

test('continuous network time exposes fractional hours to the map',()=>{const js=read('../public/game-time-authority.js');assert.match(js,/function continuousHours/);assert.match(js,/clock\.extraCarryMs\+pending/);assert.match(js,/window\.atlasGameTime=/);assert.match(js,/nowHours:\(\)=>continuousHours\(\)/);assert.match(js,/format:formatHours/)});

test('global map derives every vehicle from authoritative game hours and realistic mode speeds',()=>{const js=read('../public/game-global-simulation-v2.js');assert.doesNotThrow(()=>new Function(js));assert.match(js,/MODE_KPH=\{truck:68,ocean:35,air:820\}/);assert.match(js,/atlasGameTime\?\.nowHours/);assert.match(js,/snapshot\(shipment,gameHour\)/);assert.match(js,/pathDistance\(leg\.path\)/);assert.match(js,/distanceKm\/MODE_KPH\[leg\.mode\]/);assert.doesNotMatch(js,/visualClock=performance/)});

test('startup runs an eighteen-second historical catch-up replay before live pace',()=>{const js=read('../public/game-global-simulation-v2.js'),css=read('../public/game-network-time.css');assert.match(js,/const REPLAY_MS=18000/);assert.match(js,/const REPLAY_WINDOW_HOURS=24/);assert.match(js,/CATCH-UP REPLAY/);assert.match(js,/requestAnimationFrame\(replayStep\)/);assert.match(js,/finishReplay/);assert.match(js,/LIVE NETWORK/);assert.match(css,/network-replay-active/);assert.match(css,/networkReplayPulse/)});

test('shipment detail explains distance speed and movement in the last game hour',()=>{const js=read('../public/game-global-simulation-v2.js');assert.match(js,/distanceLastHour/);assert.match(js,/km in last game hour/);assert.match(js,/km modeled/);assert.match(js,/km remaining/);assert.match(js,/current leg/)});

test('global scenario includes multiple long-haul air cargo chains',()=>{const js=read('../public/game-global-simulation-v2.js');for(const id of['SC-808','SC-901','SC-902','SC-903','SC-904'])assert.match(js,new RegExp(id));for(const gateway of['Shanghai Pudong Air Cargo','Incheon Air Cargo Gateway','Narita Air Cargo Gateway','Dubai World Central Cargo','Nairobi JKIA Cargo','London Heathrow Cargo'])assert.match(js,new RegExp(gateway));const airLegs=(js.match(/air\('/g)||[]).length;assert.ok(airLegs>=5,`expected at least five air legs, found ${airLegs}`)});

test('live map pulse communicates activity without faking additional distance',()=>{const js=read('../public/game-global-simulation-v2.js'),css=read('../public/game-network-time.css');assert.match(js,/setLatLng\(snap\.position\)/);assert.match(css,/networkVehiclePulse/);assert.match(css,/global-vehicle>i/);assert.match(js,/Markers now move only when network time moves/)});

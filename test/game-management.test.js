import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('game loads the global 3PL management layer',()=>{const html=read('../public/game.html');assert.match(html,/game-management\.css/);assert.match(html,/game-management\.js/);assert.match(html,/General Manager & Lead Dispatcher/);assert.match(html,/Global 3PL Control Tower/i)});

test('routine departments open an interactive management console',()=>{const js=read('../public/game-management.js');assert.match(js,/#open-team/);assert.match(js,/\.automation-state/);assert.match(js,/openControl\('departments'\)/);assert.match(js,/Dispatch & Capacity/);assert.match(js,/Production Control/);assert.match(js,/Customer Operations/);assert.match(js,/Global Trade Desk/);assert.match(js,/delegation:\{dispatch:/)});

test('global network covers requested markets and lanes',()=>{const js=read('../public/game-management.js');for(const place of['China','South Korea','Netherlands','United Kingdom','Australia','United Arab Emirates','India','Kenya','Japan','Indonesia','Colombia','Cartagena'])assert.match(js,new RegExp(place.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert.match(js,/Shanghai/);assert.match(js,/Rotterdam/);assert.match(js,/Jebel Ali/);assert.match(js,/Mombasa/);assert.match(js,/Tanjung Priok/);assert.match(js,/Sydney \/ Port Botany/)});

test('fleet carrier and HR systems are playable',()=>{const js=read('../public/game-management.js');assert.match(js,/Owned truck/);assert.match(js,/Contracted vessel slot/);assert.match(js,/Contracted air block/);assert.match(js,/Contracted truck/);assert.match(js,/reputation/);assert.match(js,/relationship/);assert.match(js,/Call carrier/);assert.match(js,/Contract capacity/);assert.match(js,/Offer priority load/);assert.match(js,/HR recruiting pipeline/);assert.match(js,/Recruit/)});

test('management state joins the same cloud-synced game object',()=>{const js=read('../public/game-management.js'),progress=read('../public/progress-v2.js');assert.match(js,/management:clone\(management\)/);assert.match(js,/window\.__atlasGameState/);assert.match(js,/atlas-game-loaded/);assert.match(js,/atlas-game-changed/);assert.match(progress,/user_metadata\?\.atlas_problem_spaces\?\.logistics_game\?\.progress/);assert.match(progress,/window\.__atlasGameState/)});

test('game jargon has clickable explainers including challenge lane',()=>{const js=read('../public/game-management.js');assert.match(js,/'challenge lane'/);assert.match(js,/game-info-button/);assert.match(js,/showInfo/);assert.match(js,/Open game glossary/);assert.match(js,/commercial\/network action/)});

test('game documentation describes the manager dispatcher model',()=>{const docs=read('../docs/logistics-game/README.md'),manual=read('../public/game-docs.html');for(const text of[docs,manual]){assert.match(text,/General Manager/);assert.match(text,/Lead Dispatcher/);assert.match(text,/carrier relationship/i);assert.match(text,/People.*HR|People & HR/s);assert.match(text,/global/i);assert.match(text,/Challenge lane/i)}});

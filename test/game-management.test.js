import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('stable browser game modules parse as JavaScript',()=>{for(const path of['../public/game-map-bridge.js','../public/game-management-v2.js'])assert.doesNotThrow(()=>new Function(read(path)),`${path} must parse`)});

test('game loads only the stable global 3PL management runtime',()=>{const html=read('../public/game.html');assert.match(html,/game-management\.css/);assert.match(html,/game-map-bridge\.js/);assert.match(html,/game-management-v2\.js/);assert.doesNotMatch(html,/src="\/game-management\.js"/);assert.match(html,/General Manager & Lead Dispatcher/);assert.match(html,/Global 3PL Control Tower/i)});

test('stable management runtime never observes the whole document',()=>{const js=read('../public/game-management-v2.js');assert.doesNotMatch(js,/new MutationObserver/);assert.doesNotMatch(js,/document\.documentElement[\s\S]*subtree:true/);assert.match(js,/scheduleRefresh/);assert.match(js,/setTimeout\(\(\)=>\{renderDeck/)});

test('main game map is bridged and opens on the global network',()=>{const bridge=read('../public/game-map-bridge.js'),js=read('../public/game-management-v2.js'),html=read('../public/game.html');assert.match(bridge,/__atlasMainGameMap/);assert.match(js,/fitGlobal/);assert.match(js,/fitBounds\(globalBounds/);assert.match(js,/setMinZoom\(2\)/);assert.match(js,/renderMainMapOverlay/);assert.match(js,/Focus active chapter/);assert.match(html,/Fit global network/)});

test('routine departments open an interactive management console',()=>{const js=read('../public/game-management-v2.js');assert.match(js,/#open-team/);assert.match(js,/\.automation-state/);assert.match(js,/openControl\('departments'\)/);assert.match(js,/Dispatch & Capacity/);assert.match(js,/Production Control/);assert.match(js,/Customer Operations/);assert.match(js,/Global Trade Desk/);assert.match(js,/delegation:\{dispatch:/)});

test('global network covers requested markets and lanes',()=>{const js=read('../public/game-management-v2.js');for(const place of['China','South Korea','Netherlands','United Kingdom','Australia','United Arab Emirates','India','Kenya','Japan','Indonesia','Colombia','Cartagena'])assert.match(js,new RegExp(place.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert.match(js,/Shanghai/);assert.match(js,/Rotterdam/);assert.match(js,/Jebel Ali/);assert.match(js,/Mombasa/);assert.match(js,/Tanjung Priok/);assert.match(js,/Sydney \/ Port Botany/)});

test('fleet carrier and HR systems remain playable',()=>{const js=read('../public/game-management-v2.js');assert.match(js,/Owned truck/);assert.match(js,/Contracted vessel slot/);assert.match(js,/Contracted air block/);assert.match(js,/Contracted truck/);assert.match(js,/reputation/);assert.match(js,/relationship/);assert.match(js,/Call carrier/);assert.match(js,/Contract capacity/);assert.match(js,/Offer priority load/);assert.match(js,/HR recruiting pipeline/);assert.match(js,/Recruit/)});

test('management state joins the same cloud-synced game object',()=>{const js=read('../public/game-management-v2.js'),progress=read('../public/progress-v2.js');assert.match(js,/management:clone\(management\)/);assert.match(js,/window\.__atlasGameState/);assert.match(js,/atlas-game-loaded/);assert.match(js,/atlas-game-changed/);assert.match(progress,/user_metadata\?\.atlas_problem_spaces\?\.logistics_game\?\.progress/);assert.match(progress,/window\.__atlasGameState/)});

test('game jargon has clickable explainers including challenge lane',()=>{const js=read('../public/game-management-v2.js');assert.match(js,/'challenge lane'/);assert.match(js,/game-info-button/);assert.match(js,/showInfo/);assert.match(js,/Open game glossary/);assert.match(js,/commercial action/i)});

test('game documentation describes the manager dispatcher model',()=>{const docs=read('../docs/logistics-game/README.md'),manual=read('../public/game-docs.html');for(const text of[docs,manual]){assert.match(text,/General Manager/);assert.match(text,/Lead Dispatcher/);assert.match(text,/carrier relationship/i);assert.match(text,/People.*HR|People & HR/s);assert.match(text,/global/i);assert.match(text,/Challenge lane/i)}});

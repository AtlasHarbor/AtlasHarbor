import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('v2 onboarding module parses and loads after the older command center tour',()=>{const js=read('../public/game-onboarding-v2.js'),html=read('../public/game.html');assert.doesNotThrow(()=>new Function(js));assert.match(html,/game-onboarding-v2\.css/);assert.match(html,/game-onboarding-v2\.js/);assert.ok(html.indexOf('game-onboarding-v2.js')>html.indexOf('game-command-center.js'));assert.doesNotMatch(js,/new MutationObserver/)});

test('walkthrough uses a curved white SVG arrow overlay rather than silent tooltips',()=>{const js=read('../public/game-onboarding-v2.js'),css=read('../public/game-onboarding-v2.css');assert.match(js,/<svg class="onboarding-arrow"/);assert.match(js,/coach-arrow-head/);assert.match(js,/ C \$\{bendX\}/);assert.match(css,/stroke:#fff/);assert.match(css,/marker-end:url\(#coach-arrow-head\)/);assert.match(css,/onboarding-scrim/)});

test('tour explicitly teaches objective time decisions working capital map and departments',()=>{const js=read('../public/game-onboarding-v2.js');for(const target of['#game-objective-banner','.clock','.orders-panel','.working-capital-cash','#map-panel','#open-team'])assert.match(js,new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert.match(js,/Cash, A\/R and A\/P/);assert.match(js,/15 real minutes equals one game hour/);assert.match(js,/origin, current location, destination/)});

test('tour seen state is versioned inside the same offline and account-synced career',()=>{const js=read('../public/game-onboarding-v2.js'),progress=read('../public/progress-v2.js');assert.match(js,/const TOUR_VERSION=2/);assert.match(js,/dashboardTourVersion:TOUR_VERSION/);assert.match(js,/state\.onboarding=/);assert.match(js,/localStorage\.setItem\(GAME_KEY/);assert.match(js,/atlas-game-changed/);assert.match(progress,/user_metadata\?\.atlas_problem_spaces\?\.logistics_game\?\.progress/)});

test('new tutorial intercepts first command click so old tour cannot double-open',()=>{const js=read('../public/game-onboarding-v2.js');assert.match(js,/document\.addEventListener\('click',interceptTakeCommand,true\)/);assert.match(js,/state\.tutorialDone=true/);assert.match(js,/setTimeout\(\(\)=>start\(false\),700\)/);assert.match(js,/data-restart-tour/)});

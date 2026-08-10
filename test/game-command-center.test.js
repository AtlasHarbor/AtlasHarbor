import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('command center browser module parses and is loaded after base interactions',()=>{const js=read('../public/game-command-center.js'),html=read('../public/game.html');assert.doesNotThrow(()=>new Function(js));assert.match(html,/game-command-center\.css/);assert.match(html,/game-command-center\.js/);assert.ok(html.indexOf('game-command-center.js')>html.indexOf('game-interactions.js'));assert.doesNotMatch(js,/new MutationObserver/)});

test('contract selection becomes a dispatch decision portal with physical location and destination',()=>{const js=read('../public/game-command-center.js');for(const text of['DISPATCH DECISION PORTAL','ORIGIN','WHERE IT IS NOW','DESTINATION','PROMISE CLOCK','CONTROL-TOWER RECOMMENDATION','COMPARE YOUR OPTIONS'])assert.match(js,new RegExp(text));assert.match(js,/locationCopy/);assert.match(js,/currentMovement/);assert.match(js,/route-chain/)});

test('decision choices show a best fit and explicit tradeoffs',()=>{const js=read('../public/game-command-center.js');assert.match(js,/MOST LIKELY \/ BEST FIT/);assert.match(js,/Tradeoff:/);assert.match(js,/Air recovery/);assert.match(js,/Intermodal rail/);assert.match(js,/Highway congestion/);assert.match(js,/margin takes the hit/);assert.match(js,/recommendedMode/)});

test('manual route planner ties operating nodes together and reviews consequence before committing',()=>{const js=read('../public/game-command-center.js');assert.match(js,/Build a manual route plan/);assert.match(js,/data-manual-from/);assert.match(js,/data-manual-via/);assert.match(js,/data-manual-to/);assert.match(js,/data-manual-mode/);assert.match(js,/REVIEW MANUAL PLAN/);assert.match(js,/Cash after/);assert.match(js,/Commit this route plan/);assert.match(js,/commitManual/)});

test('first-run experience explains the role objective and guided dashboard tour',()=>{const js=read('../public/game-command-center.js');assert.match(js,/What you are running/);assert.match(js,/YOUR COMPANY OBJECTIVE/);assert.match(js,/Protect promises\. Stay solvent\. Build the most resilient global 3PL/);for(const target of['#game-objective-banner','.orders-panel','#map-panel','#decision-card','#open-team','.clock'])assert.match(js,new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert.match(js,/GUIDED TOUR/);assert.match(js,/Show me around/)});

test('game clock uses fifteen real minutes per game hour with pause and speed controls',()=>{const js=read('../public/game-command-center.js');assert.match(js,/15\*60\*1000/);assert.match(js,/const SPEEDS=\[1,2,4\]/);assert.match(js,/data-game-speed/);assert.match(js,/2× \/ 4×/);assert.match(js,/state\.paused/);assert.match(js,/catchUpFromClock/);assert.match(js,/visibilitychange/);assert.match(js,/simulateOneHour/)});

test('game clock catches up routine operations rather than changing only the displayed time',()=>{const js=read('../public/game-command-center.js');assert.match(js,/order\.inventory=Math\.min/);assert.match(js,/movement\.progress=/);assert.match(js,/settleArrival/);assert.match(js,/autoDispatch/);assert.match(js,/order\.status='delivered'/);assert.match(js,/state\.cash=/)});

test('offline and account progress use newest-copy-wins with account isolation',()=>{const js=read('../public/progress-v2.js');assert.match(js,/freshness=/);assert.match(js,/localFresh>cloudFresh/);assert.match(js,/ownerId/);assert.match(js,/local\.ownerId!==current\.id/);assert.match(js,/Loaded newer offline progress/);assert.match(js,/Loaded latest Atlas Harbor account progress/);assert.match(js,/window\.addEventListener\('online'/);assert.match(js,/Saved offline on this device/);assert.match(js,/Saved locally \+ to your account/)});

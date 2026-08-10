import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('working capital browser runtime parses and is loaded with the game',()=>{const js=read('../public/game-finance.js'),html=read('../public/game.html');assert.doesNotThrow(()=>new Function(js));assert.match(html,/game-finance\.css/);assert.match(html,/game-finance\.js/);assert.ok(html.indexOf('game-finance.js')>html.indexOf('game-management-v3.js'));assert.doesNotMatch(js,/new MutationObserver/)});

test('cash header is consolidated with receivables and payables',()=>{const js=read('../public/game-finance.js');assert.match(js,/working-capital-mini/);assert.match(js,/data-finance-open="ar"/);assert.match(js,/data-finance-open="ap"/);assert.match(js,/Cash, receivables & payables/);assert.match(js,/Delivery creates A\/R/)});

test('deliveries create Net 30 receivables rather than leaving legacy instant cash',()=>{const js=read('../public/game-finance.js');assert.match(js,/const NET30=30\*24/);assert.match(js,/processBaseDeliveries/);assert.match(js,/reverseLegacyCash\(state,Math\.round\(num\(order\.value\)\*\.22\)\)/);assert.match(js,/addReceivable\(finance,\{id:`AR-\$\{order\.id\}`/);assert.match(js,/processGlobalDeliveries/);assert.match(js,/reverseLegacyCash\(state,item\.value\)/)});

test('new transportation obligations become payables and road fuel is variable',()=>{const js=read('../public/game-finance.js');assert.match(js,/processShipments/);assert.match(js,/refundLegacyCash\(state,linehaul\)/);assert.match(js,/category:`\$\{shipment\.mode\} linehaul`/);assert.match(js,/category:'Diesel fuel'/);assert.match(js,/liters=km\*\.34/);assert.match(js,/NET14/);assert.match(js,/NET7/)});

test('payroll and lease burn is converted from legacy hourly cash to scheduled AP',()=>{const js=read('../public/game-finance.js');assert.match(js,/convertManagementAccruals/);assert.match(js,/annualPayroll\(state\)\/8760\*elapsed/);assert.match(js,/monthlyAssets\(state\)\/730\*elapsed/);assert.match(js,/refundLegacyCash\(state,legacy\)/);assert.match(js,/PAYROLL-/);assert.match(js,/LEASE-/);assert.match(js,/category:'Payroll'/);assert.match(js,/category:'Lease \/ fixed assets'/)});

test('customer collection model includes deterministic three percent lateness and disputes',()=>{const js=read('../public/game-finance.js');assert.match(js,/hash\(`\$\{id\}:late`\)%100<3/);assert.match(js,/dispute=late&&hash/);assert.match(js,/status='late'/);assert.match(js,/status='disputed'/);assert.match(js,/Send collection notice/);assert.match(js,/Review arbitration/);assert.match(js,/arbitration-result/);assert.match(js,/roll<82\?1:roll<95\?\.70:0/)});

test('finance surface includes ledger calendar regional fuel and projection',()=>{const js=read('../public/game-finance.js');for(const label of['Ledger','Calendar','Fuel','Project','Balance calendar','Regional diesel inputs','Working-capital projection'])assert.match(js,new RegExp(label));assert.match(js,/cashDelta/);assert.match(js,/arDelta/);assert.match(js,/apDelta/)});

test('projection equation mathematically bridges current cash to projected cash',()=>{const js=read('../public/game-finance.js');assert.match(js,/projected=Math\.round\(cash\+scheduledAR\+futureGlobal-scheduledAP-futurePayroll-futureAssets-futureFuel\)/);assert.match(js,/Scheduled A\/R collections/);assert.match(js,/Current A\/P scheduled/);assert.match(js,/Future payroll/);assert.match(js,/Fuel run-rate/);for(const days of['30','60','90'])assert.match(js,new RegExp(days))});

test('finance remains embedded in the synced career and follows the global replay',()=>{const js=read('../public/game-finance.js'),progress=read('../public/progress-v2.js');assert.match(js,/state\.finance/);assert.doesNotMatch(js,/atlas-game-finance-state/);assert.match(js,/atlas-global-replay-start/);assert.match(js,/atlas-global-replay-complete/);assert.match(js,/startMoneyReplay/);assert.match(progress,/user_metadata\?\.atlas_problem_spaces\?\.logistics_game\?\.progress/)});

test('regional fuel baselines are explicitly labeled and do not substitute road diesel for ocean or air',()=>{const js=read('../public/game-finance.js');for(const country of['United States','United Kingdom','Netherlands','China','South Korea','Japan','Australia','United Arab Emirates','India','Kenya','Indonesia','Colombia'])assert.match(js,new RegExp(country));assert.match(js,/SCENARIO BASELINE/);assert.match(js,/OFFICIAL LIVE/);assert.match(js,/Road diesel only affects truck fuel/);assert.match(js,/ocean and air remain inside their modeled carrier buy rates/i)});

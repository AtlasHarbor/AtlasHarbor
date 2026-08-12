import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {isInjuredRosterEntry,isUsefulPlayerTransaction} from '../src/mlb.js';
import {renderBaseballTeamPage} from '../src/baseball-team-page.js';
import {renderBaseballPlayerPage} from '../src/baseball-player-page.js';

test('injured list requires an actual injured or IL roster status',()=>{
 assert.equal(isInjuredRosterEntry({status:{description:'10-Day Injured List'}}),true);
 assert.equal(isInjuredRosterEntry({status:{description:'60-Day Injured List'}}),true);
 assert.equal(isInjuredRosterEntry({status:{description:'Active'}}),false);
 assert.equal(isInjuredRosterEntry({person:{fullName:'Healthy Player'}}),false);
});

test('cosmetic jersey number transactions are omitted',()=>{
 assert.equal(isUsefulPlayerTransaction({description:'Player changed number to 42'}),false);
 assert.equal(isUsefulPlayerTransaction({description:'Player changed jersey number from 17 to 42'}),false);
 assert.equal(isUsefulPlayerTransaction({description:'Placed on the 10-day injured list'}),true);
});

test('team page puts record and division place near the top and links roster profiles',()=>{
 const html=renderBaseballTeamPage({id:120,name:'Washington Nationals',abbreviation:'WSH',league:'National League',division:'National League East',sportName:'Major League Baseball',venue:'Nationals Park',season:2026,seasonPhase:'regular-season',record:{wins:63,losses:55,pct:'.534'},standing:{divisionRank:'2',leagueRank:'5',gamesBack:'3.5',wildCardRank:'2',streak:'W2'},stats:{hitting:{},pitching:{},fielding:{}},lineup:{status:'projected-unavailable',players:[]},injuredList:[],roster:[{id:123,name:'Test Player',position:'Outfielder'}]},'https://example.test/baseball/teams/120/washington-nationals');
 const hero=html.slice(html.indexOf('<header class="game-hero">'),html.indexOf('</header>')+9);
 assert.match(hero,/63-55/);
 assert.match(hero,/#2/);
 assert.match(html,/REGULAR SEASON/);
 assert.match(html,/\/baseball\/players\/123\/test-player/);
});

test('postseason team page switches away from regular division-race emphasis',()=>{
 const html=renderBaseballTeamPage({id:1,name:'Club',league:'League',division:'Division',sportName:'Triple-A',season:2026,seasonPhase:'postseason',record:{wins:80,losses:60,pct:'.571'},standing:{divisionRank:'1'},stats:{hitting:{},pitching:{},fielding:{}},lineup:{players:[]},injuredList:[],roster:[],nextGame:{seriesDescription:'League Championship Series',status:'Scheduled'}},'https://example.test/baseball/teams/1/club');
 assert.match(html,/POSTSEASON/);
 assert.match(html,/League Championship Series/);
 assert.doesNotMatch(html,/DIVISION PLACE/);
});

test('player profile surfaces age and labels season stats with years',()=>{
 const html=renderBaseballPlayerPage({id:10,name:'Prospect Player',team:'Affiliate',position:'Shortstop',age:22,bats:'Right',throws:'Right',stats:{},seasonLines:[{season:2025,level:'Double-A',shortLevel:'AA',team:'Affiliate',stat:{avg:'.280',gamesPlayed:80}}],careerLines:[],professionalSeason:{},professionalCareer:{},recentGames:[],transactions:[]},'https://example.test/baseball/players/10/prospect-player');
 const hero=html.slice(html.indexOf('<header class="game-hero">'),html.indexOf('</header>')+9);
 assert.match(hero,/Age 22/);
 assert.match(html,/2025 · Double-A/);
 assert.match(html,/Cosmetic jersey\/uniform-number changes are intentionally omitted|Cosmetic jersey\/uniform-number changes/);
});

test('baseball route loader is cleared on browser back and does not use a document mutation observer',()=>{
 const js=fs.readFileSync(new URL('../public/baseball-navigation.js',import.meta.url),'utf8');
 assert.match(js,/addEventListener\('pageshow'/);
 assert.match(js,/clearLoader\(\)/);
 assert.doesNotMatch(js,/MutationObserver/);
});

test('baseball dashboard roster uses real profile links',()=>{
 const js=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(js,/playerHref/);
 assert.match(js,/class=\"player-report-link\"/);
 assert.match(js,/divisionPlace/);
 assert.match(js,/Age \$\{escapeHtml\(player\.age\)\}/);
});

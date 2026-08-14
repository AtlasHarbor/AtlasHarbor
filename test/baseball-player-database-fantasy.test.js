import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildIdealFantasyLineup,scorePlayerForm} from '../src/baseball-fantasy.js';

function hitter(id,name,position,points){
 const splits=points.map((hits,index)=>({date:`2026-08-${String(13-index).padStart(2,'0')}`,stat:{hits,doubles:0,triples:0,homeRuns:0,runs:1,rbi:1,baseOnBalls:0,hitByPitch:0,stolenBases:0,caughtStealing:0,strikeOuts:0}}));
 return{id,name,position,team:'Test Club',teamId:1,level:'Major League Baseball',stats:{'hitting:gameLog:1':splits},professionalSeason:{gamesPlayed:20,hits:20,runs:10,rbi:10}};
}

test('recent baseball form weights newer games more heavily',()=>{
 const hot=hitter(1,'Hot Catcher','Catcher',[4,3,2,1,1,1,1,1]);
 const cold=hitter(2,'Cold Catcher','Catcher',[0,0,1,1,2,3,4,4]);
 assert.ok(scorePlayerForm(hot).hitterScore>scorePlayerForm(cold).hitterScore);
});

test('ideal fantasy lineup fills baseball positions without duplicating players',()=>{
 const players=[
  hitter(1,'C','Catcher',[2,2,2]),hitter(2,'1B','First Base',[2,2,2]),hitter(3,'2B','Second Base',[2,2,2]),hitter(4,'3B','Third Base',[2,2,2]),hitter(5,'SS','Shortstop',[2,2,2]),
  hitter(6,'OF1','Outfielder',[3,3,3]),hitter(7,'OF2','Outfielder',[2,2,2]),hitter(8,'OF3','Outfielder',[1,1,1]),hitter(9,'UTIL','Designated Hitter',[4,4,4])
 ];
 const result=buildIdealFantasyLineup(players,{games:8});
 assert.deepEqual(result.battingLineup.map(row=>row.slot),['C','1B','2B','3B','SS','OF','OF','OF','UTIL']);
 assert.equal(new Set(result.battingLineup.map(row=>row.playerId)).size,9);
 assert.equal(result.model,'atlas-recent-form-v1');
});

test('baseball database wiring is incremental and uses the normalized player endpoint',()=>{
 const admin=fs.readFileSync(new URL('../src/baseball-admin-router.js',import.meta.url),'utf8');
 const capture=fs.readFileSync(new URL('../src/baseball-player-capture-router.js',import.meta.url),'utf8');
 const schema=fs.readFileSync(new URL('../supabase/baseball-player-database.sql',import.meta.url),'utf8');
 const nav=fs.readFileSync(new URL('../public/problem-nav.js',import.meta.url),'utf8');
 assert.match(admin,/await sleep\(delay\)/);
 assert.match(admin,/\/api\/baseball\/prospect-players\/\$\{entry\.id\}/);
 assert.doesNotMatch(admin,/Promise\.all\(\s*roster/);
 assert.match(capture,/upsertPlayer\(payload\.player/);
 assert.match(schema,/create table if not exists public\.baseball_player_snapshots/);
 assert.match(schema,/create table if not exists public\.baseball_refresh_jobs/);
 assert.match(nav,/baseball-player-export\.js/);
 assert.match(nav,/baseball-admin-patch\.js/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPlayerStatsPath,aggregateHittingStats,aggregatePitchingStats} from '../src/baseball-prospect-router.js';
import {playerSlug} from '../src/baseball-player-page.js';

test('MiLB player stat paths use bracket arrays and singular sportId',()=>{
 const path=buildPlayerStatsPath(695491,{types:['season','career','yearByYear'],groups:['hitting','fielding'],sportId:11,year:2026});
 const query=new URL(`https://example.test${path}`).searchParams;
 assert.equal(query.get('stats'),'[season,career,yearByYear]');
 assert.equal(query.get('group'),'[hitting,fielding]');
 assert.equal(query.get('sportId'),'11');
 assert.equal(query.get('sportIds'),null);
 assert.equal(query.get('season'),'2026');
});

test('hitting totals merge MLB and MiLB counting stats and recalculate rates',()=>{
 const total=aggregateHittingStats([
  {gamesPlayed:80,plateAppearances:320,atBats:280,hits:70,doubles:14,triples:2,homeRuns:18,runs:45,rbi:52,stolenBases:10,baseOnBalls:30,strikeOuts:75,hitByPitch:5,sacFlies:5,totalBases:142},
  {gamesPlayed:12,plateAppearances:48,atBats:42,hits:12,doubles:3,triples:0,homeRuns:2,runs:7,rbi:8,stolenBases:1,baseOnBalls:5,strikeOuts:11,hitByPitch:1,sacFlies:0,totalBases:21}
 ]);
 assert.equal(total.gamesPlayed,92);
 assert.equal(total.homeRuns,20);
 assert.equal(total.hits,82);
 assert.equal(total.avg,'.255');
 assert.equal(total.obp,'.329');
 assert.equal(total.slg,'.506');
 assert.equal(total.ops,'.835');
});

test('pitching totals sum baseball innings by outs rather than decimals',()=>{
 const total=aggregatePitchingStats([
  {inningsPitched:'10.2',earnedRuns:4,hits:9,baseOnBalls:3,strikeOuts:12,gamesPlayed:3,gamesStarted:2,wins:1,losses:0,homeRuns:1},
  {inningsPitched:'5.1',earnedRuns:2,hits:4,baseOnBalls:2,strikeOuts:7,gamesPlayed:2,gamesStarted:1,wins:0,losses:1,homeRuns:0}
 ]);
 assert.equal(total.inningsPitched,'16.0');
 assert.equal(total.era,'3.38');
 assert.equal(total.whip,'1.13');
 assert.equal(total.strikeOuts,19);
});

test('accented player names produce stable SEO slugs',()=>{
 assert.equal(playerSlug({name:'Joshua Báez'}),'joshua-baez');
});

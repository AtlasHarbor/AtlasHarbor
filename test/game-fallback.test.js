import test from 'node:test';
import assert from 'node:assert/strict';
import { createMlbClient } from '../src/mlb.js';

test('game report survives unavailable boxscore and live feed', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('/schedule?') && url.includes('gamePk=823431')) return new Response(JSON.stringify({dates:[{games:[{gamePk:823431,gameDate:'2026-08-04T23:05:00Z',officialDate:'2026-08-04',status:{detailedState:'Scheduled'},venue:{name:'Globe Life Field'},teams:{away:{team:{id:147,name:'New York Yankees'},probablePitcher:{fullName:'Away Starter'}},home:{team:{id:140,name:'Texas Rangers'},probablePitcher:{fullName:'Home Starter'}}},weather:{condition:'Clear',temp:'91',wind:'8 mph'}}]}]}),{status:200,headers:{'content-type':'application/json'}});
    return new Response(JSON.stringify({error:'not available'}),{status:404,headers:{'content-type':'application/json'}});
  };
  const game = await createMlbClient(fetchImpl).getGame('823431');
  assert.equal(game.id, 823431);
  assert.equal(game.name, 'New York Yankees at Texas Rangers');
  assert.equal(game.probablePitchers.home, 'Home Starter');
  assert.deepEqual(game.teams.home.battingOrder, []);
  assert.deepEqual(game.availability, {schedule:true,boxscore:false,liveFeed:false});
});

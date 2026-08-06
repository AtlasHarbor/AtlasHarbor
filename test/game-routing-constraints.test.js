import test from 'node:test';
import assert from 'node:assert/strict';
import {POINTS,routeConstraint,fallback} from '../src/game-routing.js';

test('ocean movements require ports',()=>{
 assert.equal(routeConstraint('ocean','la-port','savannah-port').ok,true);
 assert.equal(routeConstraint('ocean','la-port','dallas-dc').ok,false);
});

test('truck and rail cannot cross landmasses',()=>{
 POINTS['europe-test']={name:'Europe Test Port',lat:50,lng:1,kind:'port',landmass:'europe'};
 try{
  assert.equal(routeConstraint('truck','la-port','europe-test').ok,false);
  assert.equal(routeConstraint('rail','la-port','europe-test').ok,false);
  assert.equal(routeConstraint('air','lax','europe-test').ok,true);
  assert.equal(routeConstraint('ocean','la-port','europe-test').ok,true);
 }finally{delete POINTS['europe-test']}
});

test('land modes do not invent straight-line fallback geometry',()=>{
 assert.equal(fallback('truck','lax','dallas-dc'),null);
 assert.equal(fallback('rail','riverside-plant','atlanta-dc'),null);
});

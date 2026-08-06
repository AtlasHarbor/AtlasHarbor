import test from 'node:test';
import assert from 'node:assert/strict';
import {solveFoodDecision,foodSafetyBrief} from '../src/food-decision.js';

const place=(id,name,extra={})=>({id,name,primaryType:'restaurant',types:[],distanceKm:2,rating:4.5,reviewCount:200,priceNumber:2,currentOpeningHours:{openNow:true},businessStatus:'OPERATIONAL',reviews:[],...extra});

test('food solver prioritizes the group compromise over one-person optimization',()=>{
 const restaurants=[
  place('polarized','Steak Palace',{types:['steakhouse']}),
  place('compromise','Taco Garden',{types:['mexican_restaurant'],servesVegetarianFood:true})
 ];
 const result=solveFoodDecision(restaurants,{query:'dinner',participants:[{name:'A',likes:['steak']},{name:'B',likes:['taco'],avoids:['steak']}],maxDistanceKm:10});
 assert.equal(result.restaurants[0].id,'compromise');
 assert.equal(result.restaurants[0].fairnessScore,Math.min(...result.restaurants[0].participantScores.map(item=>item.score)));
});

test('hard cuisine conflicts remove a candidate',()=>{
 const result=solveFoodDecision([place('sushi','Sushi House',{types:['sushi_restaurant']}),place('pizza','Pizza House',{types:['pizza_restaurant']})],{participants:[{name:'A',avoids:['sushi']}],maxDistanceKm:10});
 assert.deepEqual(result.restaurants.map(item=>item.id),['pizza']);
});

test('spice tolerance and adventurousness affect participant fit',()=>{
 const spicy=place('spicy','Sichuan Hot Pot',{primaryType:'sichuan_restaurant',primaryTypeDisplay:'Sichuan restaurant',reviews:[{text:'Very spicy chili broth.'}]}),cautious=solveFoodDecision([spicy],{participants:[{name:'Cautious',spice:10,adventurousness:10,likes:['pizza']}],maxDistanceKm:10}).restaurants[0],adventurous=solveFoodDecision([spicy],{participants:[{name:'Explorer',spice:90,adventurousness:90}],maxDistanceKm:10}).restaurants[0];
 assert.ok(adventurous.participantScores[0].score>cautious.participantScores[0].score);
 assert.match(cautious.participantScores[0].reasons.join(' '),/heat|familiar/i);
});

test('raw oyster plan creates a year-round verification brief',()=>{
 const brief=foodSafetyBrief({query:'raw oysters',month:7});
 assert.equal(brief.level,'verify');
 assert.match(brief.points.join(' '),/any month/i);
 assert.match(brief.seasonalContext,/warmer-month/i);
 assert.ok(brief.sources.some(source=>source.url.includes('cdc.gov')));
});

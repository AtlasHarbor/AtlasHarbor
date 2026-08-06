import test from 'node:test';
import assert from 'node:assert/strict';
import {solveFoodDecision,foodSafetyBrief} from '../src/food-decision.js';

const place=(id,name,extra={})=>({id,name,primaryType:'restaurant',types:[],distanceKm:2,rating:4.5,reviewCount:200,priceNumber:2,currentOpeningHours:{openNow:true},businessStatus:'OPERATIONAL',reviews:[],...extra});

test('food solver prioritizes the group compromise over one-person optimization',()=>{
 const restaurants=[
  place('polarized','Steak Palace',{types:['steakhouse'],servesDinner:true,dineIn:true}),
  place('compromise','Taco Garden',{types:['mexican_restaurant'],servesVegetarianFood:true,servesDinner:true,dineIn:true})
 ];
 const result=solveFoodDecision(restaurants,{query:'dinner',mealPeriod:'dinner',serviceMode:'sit_down',occasion:'friends',participants:[{name:'A',likes:['steak']},{name:'B',likes:['taco'],avoids:['steak']}],maxDistanceKm:10});
 assert.equal(result.restaurants[0].id,'compromise');
 assert.equal(result.restaurants[0].fairnessScore,Math.min(...result.restaurants[0].participantScores.map(item=>item.score)));
});

test('hard cuisine conflicts remove a candidate',()=>{
 const result=solveFoodDecision([place('sushi','Sushi House',{types:['sushi_restaurant'],servesDinner:true}),place('pizza','Pizza House',{types:['pizza_restaurant'],servesDinner:true})],{mealPeriod:'dinner',participants:[{name:'A',avoids:['sushi']}],maxDistanceKm:10});
 assert.deepEqual(result.restaurants.map(item=>item.id),['pizza']);
});

test('spice tolerance and adventurousness affect participant fit',()=>{
 const spicy=place('spicy','Sichuan Hot Pot',{primaryType:'sichuan_restaurant',primaryTypeDisplay:'Sichuan restaurant',servesDinner:true,reviews:[{text:'Very spicy chili broth.'}]}),cautious=solveFoodDecision([spicy],{mealPeriod:'dinner',participants:[{name:'Cautious',spice:10,adventurousness:10,likes:['pizza']}],maxDistanceKm:10}).restaurants[0],adventurous=solveFoodDecision([spicy],{mealPeriod:'dinner',participants:[{name:'Explorer',spice:90,adventurousness:90}],maxDistanceKm:10}).restaurants[0];
 assert.ok(adventurous.participantScores[0].score>cautious.participantScores[0].score);
 assert.match(cautious.participantScores[0].reasons.join(' '),/heat|familiar/i);
});

test('breakfast removes a place that explicitly does not serve breakfast',()=>{
 const result=solveFoodDecision([
  place('dinner-only','Dinner Only',{servesBreakfast:false,dineIn:true}),
  place('breakfast','Morning Cafe',{servesBreakfast:true,dineIn:true,servesCoffee:true})
 ],{mealPeriod:'breakfast',serviceMode:'sit_down',occasion:'solo',participants:[{name:'You'}]});
 assert.deepEqual(result.restaurants.map(item=>item.id),['breakfast']);
 assert.equal(result.restaurants[0].mealScore,100);
});

test('delivery and takeaway are real service constraints',()=>{
 const candidates=[
  place('dine','Dining Room',{delivery:false,takeout:false,servesDinner:true,dineIn:true}),
  place('delivery','Delivery Kitchen',{delivery:true,takeout:true,servesDinner:true,dineIn:false})
 ];
 const delivery=solveFoodDecision(candidates,{mealPeriod:'dinner',serviceMode:'delivery',occasion:'solo',participants:[{name:'You'}]});
 assert.deepEqual(delivery.restaurants.map(item=>item.id),['delivery']);
 assert.equal(delivery.restaurants[0].serviceScore,100);
 const takeaway=solveFoodDecision(candidates,{mealPeriod:'dinner',serviceMode:'takeaway',occasion:'travel',participants:[{name:'You'}]});
 assert.deepEqual(takeaway.restaurants.map(item=>item.id),['delivery']);
});

test('solo plans use personal-fit language',()=>{
 const result=solveFoodDecision([place('solo','Counter Cafe',{servesLunch:true,takeout:true,types:['cafe']})],{mealPeriod:'lunch',serviceMode:'quick',occasion:'solo',participants:[{name:'You'}]});
 assert.equal(result.restaurants[0].recommendation,'Best personal fit');
 assert.match(result.method.objective,/this diner/i);
});

test('raw oyster plan creates a year-round verification brief',()=>{
 const brief=foodSafetyBrief({query:'raw oysters',month:7});
 assert.equal(brief.level,'verify');
 assert.match(brief.points.join(' '),/any month/i);
 assert.match(brief.seasonalContext,/warmer-month/i);
 assert.ok(brief.sources.some(source=>source.url.includes('cdc.gov')));
});

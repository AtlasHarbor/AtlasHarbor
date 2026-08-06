const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Number(value)||0));
const text=value=>String(value??'').trim();
const unique=items=>[...new Set(items.filter(Boolean))];
const DIET_LABELS={vegetarian:'vegetarian',vegan:'vegan',gluten_free:'gluten-free',halal:'halal',kosher:'kosher',shellfish_allergy:'shellfish allergy',nut_allergy:'nut allergy',dairy_free:'dairy-free'};
const MEAL_LABELS={breakfast:'breakfast',brunch:'brunch',lunch:'lunch',dinner:'dinner',late_night:'late-night food',coffee_snack:'coffee or a snack'};
const SERVICE_LABELS={any:'any service style',quick:'quick or counter service',sit_down:'sit-down dining',takeaway:'takeaway or to-go',delivery:'delivery'};
const OCCASION_LABELS={solo:'a solo meal',partner:'a meal with one other person',date:'a date',friends:'a meal with friends',family:'a family meal',business:'a business meal',celebration:'a celebration',group:'a group outing',travel:'a travel meal'};

export function normalizeParticipant(input={},index=0){
 return{
  id:text(input.id)||`person-${index+1}`,
  name:text(input.name)||`Person ${index+1}`,
  likes:unique((Array.isArray(input.likes)?input.likes:text(input.likes).split(',')).map(item=>text(item).toLowerCase())).slice(0,12),
  avoids:unique((Array.isArray(input.avoids)?input.avoids:text(input.avoids).split(',')).map(item=>text(item).toLowerCase())).slice(0,12),
  dietary:unique((Array.isArray(input.dietary)?input.dietary:[]).map(item=>text(item).toLowerCase())).slice(0,10),
  spice:clamp(input.spice??50),
  adventurousness:clamp(input.adventurousness??50),
  noise:text(input.noise||'any').toLowerCase(),
  maxPrice:input.maxPrice==null||input.maxPrice===''?null:clamp(input.maxPrice,0,4)
 };
}

function evidenceText(place){return [place.name,place.primaryType,place.primaryTypeDisplay,...(place.types||[]),...(place.reviews||[]).map(review=>review.text)].filter(Boolean).join(' ').toLowerCase()}
function matchTerms(haystack,terms){return unique((terms||[]).filter(term=>term&&haystack.includes(term)))}
function confidenceScore(place){const count=Math.max(0,Number(place.reviewCount)||0),rating=Number(place.rating)||0;const countScore=Math.min(100,Math.log10(count+1)*32),ratingScore=rating?clamp((rating-3)*50):45;return Math.round(countScore*.65+ratingScore*.35)}
function logisticsScore(place,request){const maxDistance=Math.max(1,Number(request.maxDistanceKm)||10),distance=Number(place.distanceKm),price=place.priceNumber==null?null:Number(place.priceNumber),open=place.currentOpeningHours?.openNow;if(Number.isFinite(distance)&&distance>maxDistance)return 0;if(request.openNow&&open===false)return 0;if(request.maxPrice!=null&&price!=null&&price>request.maxPrice)return 0;if(place.businessStatus&&place.businessStatus!=='OPERATIONAL')return 0;let score=100;if(Number.isFinite(distance))score-=Math.min(55,distance/maxDistance*45);else score-=18;if(request.openNow&&open!==true)score-=35;if(place.closingSoon)score-=28;return clamp(score)}

function participantFit(place,participant){
 const haystack=evidenceText(place),reasons=[],verification=[],matchedLikes=matchTerms(haystack,participant.likes),matchedAvoids=matchTerms(haystack,participant.avoids);let score=58,hardConflict=false;
 if(participant.likes.length){if(matchedLikes.length){score+=Math.min(28,12+matchedLikes.length*7);reasons.push(`matches ${matchedLikes.join(', ')}`)}else{score-=8;reasons.push('preferred cuisines are not evident in the available listing')}}
 if(matchedAvoids.length){score-=70;hardConflict=true;reasons.push(`conflicts with ${matchedAvoids.join(', ')}`)}
 const price=place.priceNumber==null?null:Number(place.priceNumber);if(participant.maxPrice!=null&&price!=null&&price>participant.maxPrice){score-=35;reasons.push('above this person’s price limit')}
 for(const need of participant.dietary){
  if(need==='vegetarian'){
   if(place.servesVegetarianFood===true){score+=10;reasons.push('vegetarian options are reported')}
   else if(place.servesVegetarianFood===false){score-=70;hardConflict=true;reasons.push('listing reports no vegetarian options')}
   else{score-=12;verification.push('confirm vegetarian options and preparation')}
  }else{
   const terms={vegan:['vegan'],gluten_free:['gluten free','gluten-free'],halal:['halal'],kosher:['kosher'],shellfish_allergy:['shellfish','oyster','shrimp','crab','lobster'],nut_allergy:['peanut','nut','almond','cashew'],dairy_free:['dairy free','dairy-free']}[need]||[need.replaceAll('_',' ')],matched=terms.some(term=>haystack.includes(term));
   if(need.endsWith('_allergy')){verification.push(`call the restaurant about ${DIET_LABELS[need]||need}, cross-contact, and kitchen procedures`);if(matched){score-=45;reasons.push(`${DIET_LABELS[need]||need} appears in the listing`)}else score-=10}
   else if(matched){score+=7;reasons.push(`${DIET_LABELS[need]||need} appears in the listing`)}
   else{score-=12;verification.push(`confirm ${DIET_LABELS[need]||need} options directly`)}
  }
 }
 const reviewText=(place.reviews||[]).map(review=>review.text||'').join(' ').toLowerCase();if(participant.noise==='quiet'){
  if(/quiet|peaceful|intimate|calm/.test(reviewText)){score+=8;reasons.push('review excerpts mention a quieter setting')}
  if(/loud|noisy|crowded|club/.test(reviewText)){score-=15;reasons.push('review excerpts suggest a noisy setting')}
 }
 if(participant.noise==='lively'&&/lively|music|busy|energetic/.test(reviewText)){score+=7;reasons.push('review excerpts suggest a lively atmosphere')}
 const spicyEvidence=/spicy|very hot|hot pot|sichuan|szechuan|chili|chilli|pepper heat/.test(haystack);
 if(spicyEvidence&&participant.spice<35){score-=14;reasons.push('the available evidence suggests more heat than this person prefers')}
 else if(spicyEvidence&&participant.spice>65){score+=7;reasons.push('the available evidence matches a higher spice tolerance')}
 if(participant.adventurousness<30&&participant.likes.length&&!matchedLikes.length){score-=10;reasons.push('a familiar preferred cuisine is especially important to this person')}
 const specificCuisine=text(place.primaryTypeDisplay||place.primaryType).toLowerCase();
 if(participant.adventurousness>70&&specificCuisine&&!/restaurant|food|cafe$/.test(specificCuisine)){score+=5;reasons.push('a more distinctive cuisine fits this person’s adventurousness')}
 return{name:participant.name,score:Math.round(clamp(score)),hardConflict,reasons:unique(reasons),verification:unique(verification)};
}

function mealFit(place,request){
 const meal=request.mealPeriod,haystack=evidenceText(place),reasons=[],verification=[];let score=72,hardConflict=false;
 const field={breakfast:'servesBreakfast',brunch:'servesBrunch',lunch:'servesLunch',dinner:'servesDinner'}[meal];
 if(field){
  if(place[field]===true){score=100;reasons.push(`${MEAL_LABELS[meal]} service is reported`)}
  else if(place[field]===false){score=0;hardConflict=true;reasons.push(`the listing reports no ${MEAL_LABELS[meal]} service`)}
  else if(haystack.includes(MEAL_LABELS[meal])){score=88;reasons.push(`${MEAL_LABELS[meal]} appears in the listing evidence`)}
  else{score=58;verification.push(`confirm that ${MEAL_LABELS[meal]} is served at the intended time`)}
 }else if(meal==='coffee_snack'){
  if(place.servesCoffee===true||place.servesDessert===true||/cafe|coffee|bakery|dessert|tea/.test(haystack)){score=95;reasons.push('coffee, bakery, dessert, or snack service is evident')}
  else{score=54;verification.push('confirm coffee or snack availability at the intended time')}
 }else if(meal==='late_night'){
  if(/late night|late-night|open late|24 hour|24-hour/.test(haystack)){score=94;reasons.push('late-night service appears in the listing evidence')}
  else if(place.currentOpeningHours?.openNow===false){score=0;hardConflict=true;reasons.push('the restaurant is currently closed')}
  else{score=48;verification.push('confirm the kitchen is serving the full menu late tonight')}
 }
 return{score:Math.round(clamp(score)),hardConflict,reasons,verification};
}

function serviceFit(place,request){
 const mode=request.serviceMode,haystack=evidenceText(place),reasons=[],verification=[];let score=72,hardConflict=false;
 if(mode==='any')return{score,reasons:['no service format was required'],verification,hardConflict};
 if(mode==='delivery'){
  if(place.delivery===true){score=100;reasons.push('delivery is reported')}
  else if(place.delivery===false){score=0;hardConflict=true;reasons.push('the listing reports no delivery')}
  else{score=45;verification.push('confirm delivery availability, radius, fees, and timing')}
 }
 if(mode==='takeaway'){
  if(place.takeout===true){score=100;reasons.push('takeaway or to-go service is reported')}
  else if(place.takeout===false){score=0;hardConflict=true;reasons.push('the listing reports no takeaway service')}
  else if(/takeout|takeaway|to-go|to go|meal_takeaway/.test(haystack)){score=88;reasons.push('takeaway service appears in the listing evidence')}
  else{score=48;verification.push('confirm takeaway ordering and pickup timing')}
 }
 if(mode==='sit_down'){
  if(place.dineIn===true){score=100;reasons.push('dine-in service is reported')}
  else if(place.dineIn===false){score=0;hardConflict=true;reasons.push('the listing reports no dine-in service')}
  else if(/fine dining|sit-down|sit down|table service|restaurant/.test(haystack)){score=82;reasons.push('the listing suggests a sit-down restaurant')}
  else{score=52;verification.push('confirm dine-in seating and table-service availability')}
 }
 if(mode==='quick'){
  if(/fast food|fast_food|counter service|quick service|meal_takeaway|cafe|food court|drive through|drive-through/.test(haystack)||place.takeout===true){score=95;reasons.push('quick, counter, cafe, or takeaway service is evident')}
  else{score=50;verification.push('confirm ordering and wait time before relying on this as a quick option')}
  if(Number(place.routeDurationMinutes)>20){score-=18;reasons.push('the travel time weakens the quick-meal objective')}
 }
 return{score:Math.round(clamp(score)),hardConflict,reasons:unique(reasons),verification:unique(verification)};
}

function occasionFit(place,request,participantCount){
 const occasion=request.occasion,haystack=evidenceText(place),reviewText=(place.reviews||[]).map(review=>review.text||'').join(' ').toLowerCase(),reasons=[],verification=[];let score=72;
 if(occasion==='solo'){
  score=82;reasons.push('the plan is optimized for one diner rather than group amenities');
  if(request.serviceMode==='quick'||request.serviceMode==='takeaway')score+=8;
 }
 if(occasion==='partner'){score=78;if(place.dineIn===true)score+=8;if(/quiet|intimate|cozy/.test(reviewText)){score+=8;reasons.push('review excerpts suggest a comfortable two-person setting')}}
 if(occasion==='date'){score=65;if(place.dineIn===true)score+=12;if(place.reservable===true)score+=12;if(/romantic|intimate|quiet|cozy/.test(reviewText)){score+=12;reasons.push('review excerpts suggest a date-friendly atmosphere')}if(request.serviceMode==='delivery'||request.serviceMode==='takeaway')score-=8}
 if(occasion==='friends'||occasion==='group'){score=64;if(place.goodForGroups===true){score+=22;reasons.push('good-for-groups is reported')}else verification.push('confirm seating for the party size');if(/lively|shareable|group|music/.test(haystack))score+=8}
 if(occasion==='family'){score=66;if(place.goodForGroups===true)score+=18;if(/family|kids|children|casual/.test(haystack)){score+=10;reasons.push('family or casual fit appears in the listing evidence')}else verification.push('confirm seating, children’s options, and wait time')}
 if(occasion==='business'){score=62;if(place.dineIn===true)score+=10;if(place.reservable===true)score+=12;if(/quiet|private|business|meeting/.test(reviewText)){score+=12;reasons.push('review excerpts suggest a meeting-friendly environment')}else verification.push('confirm noise level and reservation availability')}
 if(occasion==='celebration'){score=60;if(place.reservable===true)score+=14;if(place.goodForGroups===true||participantCount<=2)score+=10;if(/celebration|special occasion|birthday|anniversary|festive/.test(haystack))score+=10;else verification.push('confirm reservations, party accommodation, and any celebration policy')}
 if(occasion==='travel'){score=62;if(place.takeout===true||/fast|quick|counter|drive-through|to-go|takeaway/.test(haystack))score+=22;if(Number(place.routeDurationMinutes)>15)score-=18;reasons.push('travel meals prioritize execution speed and route burden')}
 return{score:Math.round(clamp(score)),reasons:unique(reasons),verification:unique(verification)};
}

function contextFit(place,request,participantCount){
 const meal=mealFit(place,request),service=serviceFit(place,request),occasion=occasionFit(place,request,participantCount),hardConflict=meal.hardConflict||service.hardConflict;
 return{hardConflict,mealScore:meal.score,serviceScore:service.score,occasionScore:occasion.score,score:Math.round(meal.score*.36+service.score*.40+occasion.score*.24),reasons:unique([...meal.reasons,...service.reasons,...occasion.reasons]),verification:unique([...meal.verification,...service.verification,...occasion.verification])};
}

export function foodSafetyBrief({query='',freshnessPriority='normal',rawShellfish=false,month=new Date().getMonth()+1}={}){
 const value=text(query).toLowerCase(),shellfish=rawShellfish||/raw oyster|oyster bar|raw shellfish|half shell/.test(value),seafood=shellfish||/seafood|sushi|sashimi|ceviche|fish/.test(value),warmMonth=month>=5&&month<=10;
 if(shellfish)return{
  level:'verify',title:'Raw-shellfish safety needs direct verification',score:42,
  points:[
   'Raw or undercooked oysters can cause illness in any month; warmer coastal-water months are associated with more Vibrio bacteria.',
   'A restaurant listing cannot verify harvest area, shellstock tag, refrigeration history, or cross-contact. Ask the restaurant directly.',
   'Cooking shellfish properly is the reliable way to kill harmful Vibrio bacteria.'
  ],
  seasonalContext:warmMonth?'This plan falls in a warmer-month window, so the verification penalty is higher.':'Risk is not zero outside warmer months.',
  sources:[
   {title:'CDC: Vibrio and Oysters',url:'https://www.cdc.gov/vibrio/prevention/vibrio-and-oysters.html'},
   {title:'CDC: Preventing Vibrio Infection',url:'https://www.cdc.gov/vibrio/prevention/index.html'}
  ]
 };
 if(seafood)return{level:'verify',title:'Freshness is restaurant-specific',score:58,points:['Atlas Harbor cannot infer delivery day, cold-chain handling, or source freshness from a map listing.','Prefer restaurants that identify sourcing and ask about today’s delivery, preparation, and storage when freshness is important.'],seasonalContext:null,sources:[]};
 if(freshnessPriority==='high')return{level:'ask',title:'Freshness requires a direct question',score:62,points:['Menu seasonality and delivery schedules are not reliably exposed by map providers.','Ask what is in season, what arrived today, and which dishes the kitchen recommends now.'],seasonalContext:null,sources:[]};
 return{level:'normal',title:'No special freshness risk identified',score:72,points:['Freshness claims are not assumed from ratings alone. Verify time-sensitive ingredients directly when they matter.'],seasonalContext:null,sources:[]};
}

function tradeoffSummary(place,participantScores,request,freshness,context){
 const lowest=[...participantScores].sort((a,b)=>a.score-b.score)[0],tradeoffs=[];
 if(participantScores.length>1&&lowest&&lowest.score<65)tradeoffs.push(`${lowest.name} has the weakest fit at ${lowest.score}/100.`);
 if(place.distanceKm!=null&&place.distanceKm>Math.max(3,(Number(request.maxDistanceKm)||10)*.65))tradeoffs.push('The diner or group is accepting a longer trip for a better overall fit.');
 if(place.closingSoon)tradeoffs.push('The restaurant may close soon, increasing execution risk.');
 if(context.serviceScore<65)tradeoffs.push(`The evidence for ${SERVICE_LABELS[request.serviceMode]} is weak.`);
 if(context.mealScore<65)tradeoffs.push(`The intended ${MEAL_LABELS[request.mealPeriod]} service needs confirmation.`);
 if(freshness.level==='verify')tradeoffs.push('Freshness or raw-shellfish safety must be verified directly.');
 const verification=unique([...participantScores.flatMap(item=>item.verification),...context.verification]);if(verification.length)tradeoffs.push(`${verification.length} service, dietary, allergy, or timing question${verification.length===1?'':'s'} remain unverified.`);
 if(!tradeoffs.length)tradeoffs.push('No major conflict was detected in the available restaurant data.');
 return tradeoffs;
}

export function solveFoodDecision(places=[],input={}){
 const participants=(Array.isArray(input.participants)&&input.participants.length?input.participants:[{name:'You'}]).slice(0,10).map(normalizeParticipant),request={query:text(input.query||'restaurant'),openNow:Boolean(input.openNow),maxDistanceKm:Math.max(1,Math.min(80,Number(input.maxDistanceKm)||10)),maxPrice:input.maxPrice==null||input.maxPrice===''?null:clamp(input.maxPrice,0,4),mealPeriod:Object.hasOwn(MEAL_LABELS,input.mealPeriod)?input.mealPeriod:'dinner',serviceMode:Object.hasOwn(SERVICE_LABELS,input.serviceMode)?input.serviceMode:'any',occasion:Object.hasOwn(OCCASION_LABELS,input.occasion)?input.occasion:(participants.length===1?'solo':'friends'),freshnessPriority:text(input.freshnessPriority||'normal'),rawShellfish:Boolean(input.rawShellfish)},freshness=foodSafetyBrief(request),ranked=[];
 for(const place of places){
  const logistics=logisticsScore(place,request);if(logistics<=0)continue;const participantScores=participants.map(person=>participantFit(place,person));if(participantScores.some(item=>item.hardConflict))continue;const context=contextFit(place,request,participants.length);if(context.hardConflict)continue;const fairness=Math.min(...participantScores.map(item=>item.score)),average=participantScores.reduce((sum,item)=>sum+item.score,0)/participantScores.length,confidence=confidenceScore(place),freshnessScore=freshness.score,verificationItems=unique([...participantScores.flatMap(item=>item.verification),...context.verification]),verificationCount=verificationItems.length;
  let score=fairness*.32+average*.22+logistics*.18+context.score*.15+confidence*.07+freshnessScore*.06-verificationCount*1.5;score=clamp(score);
  ranked.push({...place,groupScore:Math.round(score),fairnessScore:Math.round(fairness),averageTasteScore:Math.round(average),logisticsScore:Math.round(logistics),contextScore:context.score,serviceScore:context.serviceScore,mealScore:context.mealScore,occasionScore:context.occasionScore,contextReasons:context.reasons,confidenceScore:confidence,freshnessScore,participantScores,requiresVerification:verificationCount>0||freshness.level==='verify',verificationItems,freshnessBrief:freshness,tradeoffs:tradeoffSummary(place,participantScores,request,freshness,context)});
 }
 ranked.sort((a,b)=>b.groupScore-a.groupScore||b.fairnessScore-a.fairnessScore||a.distanceKm-b.distanceKm);
 const solo=participants.length===1;
 return{participants,request,freshness,restaurants:ranked.slice(0,20).map((place,index)=>({...place,rank:index+1,recommendation:index===0?(solo?'Best personal fit':'Best group compromise'):index<3?'Strong alternative':'Candidate'})),method:{objective:solo?`Maximize this diner’s fit while respecting ${MEAL_LABELS[request.mealPeriod]}, ${SERVICE_LABELS[request.serviceMode]}, travel, budget, hours, evidence, and freshness constraints.`:`Protect the least-satisfied diner, then improve average group fit while respecting ${MEAL_LABELS[request.mealPeriod]}, ${SERVICE_LABELS[request.serviceMode]}, travel, budget, hours, evidence, and freshness constraints.`,weights:{fairness:32,averageTaste:22,logistics:18,mealServiceOccasion:15,confidence:7,freshness:6},uncertainty:'Dietary suitability, allergy handling, service format, meal-period availability, menu availability, delivery day, and freshness are not assumed when provider data does not establish them.'}};
}

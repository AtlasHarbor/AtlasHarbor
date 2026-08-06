const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Number(value)||0));
const text=value=>String(value??'').trim();
const unique=items=>[...new Set(items.filter(Boolean))];
const DIET_LABELS={vegetarian:'vegetarian',vegan:'vegan',gluten_free:'gluten-free',halal:'halal',kosher:'kosher',shellfish_allergy:'shellfish allergy',nut_allergy:'nut allergy',dairy_free:'dairy-free'};

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
 return{name:participant.name,score:Math.round(clamp(score)),hardConflict,reasons:unique(reasons),verification:unique(verification)};
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

function tradeoffSummary(place,participantScores,request,freshness){
 const lowest=[...participantScores].sort((a,b)=>a.score-b.score)[0],tradeoffs=[];
 if(lowest&&lowest.score<65)tradeoffs.push(`${lowest.name} has the weakest fit at ${lowest.score}/100.`);
 if(place.distanceKm!=null&&place.distanceKm>Math.max(3,(Number(request.maxDistanceKm)||10)*.65))tradeoffs.push('The group is accepting a longer trip for a better overall compromise.');
 if(place.closingSoon)tradeoffs.push('The restaurant may close soon, increasing execution risk.');
 if(freshness.level==='verify')tradeoffs.push('Freshness or raw-shellfish safety must be verified directly.');
 const verification=unique(participantScores.flatMap(item=>item.verification));if(verification.length)tradeoffs.push(`${verification.length} dietary or allergy question${verification.length===1?'':'s'} remain unverified.`);
 if(!tradeoffs.length)tradeoffs.push('No major conflict was detected in the available restaurant data.');
 return tradeoffs;
}

export function solveFoodDecision(places=[],input={}){
 const participants=(Array.isArray(input.participants)&&input.participants.length?input.participants:[{name:'You'}]).slice(0,10).map(normalizeParticipant),request={query:text(input.query||'restaurant'),openNow:Boolean(input.openNow),maxDistanceKm:Math.max(1,Math.min(80,Number(input.maxDistanceKm)||10)),maxPrice:input.maxPrice==null||input.maxPrice===''?null:clamp(input.maxPrice,0,4),occasion:text(input.occasion||'meal'),freshnessPriority:text(input.freshnessPriority||'normal'),rawShellfish:Boolean(input.rawShellfish)},freshness=foodSafetyBrief(request),ranked=[];
 for(const place of places){
  const logistics=logisticsScore(place,request);if(logistics<=0)continue;const participantScores=participants.map(person=>participantFit(place,person));if(participantScores.some(item=>item.hardConflict))continue;const fairness=Math.min(...participantScores.map(item=>item.score)),average=participantScores.reduce((sum,item)=>sum+item.score,0)/participantScores.length,confidence=confidenceScore(place),freshnessScore=freshness.score,verificationCount=unique(participantScores.flatMap(item=>item.verification)).length;
  let score=fairness*.36+average*.24+logistics*.20+confidence*.10+freshnessScore*.10-verificationCount*2.5;score=clamp(score);
  ranked.push({...place,groupScore:Math.round(score),fairnessScore:Math.round(fairness),averageTasteScore:Math.round(average),logisticsScore:Math.round(logistics),confidenceScore:confidence,freshnessScore,participantScores,requiresVerification:verificationCount>0||freshness.level==='verify',verificationItems:unique(participantScores.flatMap(item=>item.verification)),freshnessBrief:freshness,tradeoffs:tradeoffSummary(place,participantScores,request,freshness)});
 }
 ranked.sort((a,b)=>b.groupScore-a.groupScore||b.fairnessScore-a.fairnessScore||a.distanceKm-b.distanceKm);
 return{participants,request,freshness,restaurants:ranked.slice(0,20).map((place,index)=>({...place,rank:index+1,recommendation:index===0?'Best group compromise':index<3?'Strong alternative':'Candidate'})),method:{objective:'Maximize the group’s minimum satisfaction, then average satisfaction, while respecting travel, budget, hours, evidence, and freshness constraints.',weights:{fairness:36,averageTaste:24,logistics:20,confidence:10,freshness:10},uncertainty:'Dietary suitability, allergy handling, menu availability, delivery day, and freshness are not assumed when provider data does not establish them.'}};
}

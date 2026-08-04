import express from 'express';

const ua='AtlasHarbor/1.0 (restaurant discovery; contact via repository)';
const clean=(value,max=180)=>String(value||'').trim().slice(0,max);
const number=(value,fallback=null)=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:fallback};
const googleBase='https://places.googleapis.com/v1';

async function json(url,options={}){
 const response=await fetch(url,{...options,headers:{'User-Agent':ua,Accept:'application/json',...(options.headers||{})},signal:AbortSignal.timeout(18000)});
 const text=await response.text();let data=null;try{data=text?JSON.parse(text):null}catch{}
 if(!response.ok)throw new Error(data?.error?.message||data?.message||`Source returned ${response.status}`);
 return data;
}

function distanceKm(a,b){
 if(!a||!b)return null;const toRad=x=>x*Math.PI/180,R=6371,dLat=toRad(b.latitude-a.latitude),dLon=toRad(b.longitude-a.longitude),lat1=toRad(a.latitude),lat2=toRad(b.latitude);
 const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(h));
}

function adjustedRating(rating,count,cityAverage=4.1,confidence=50){
 const r=number(rating,cityAverage),n=Math.max(0,number(count,0));return(n/(n+confidence))*r+(confidence/(n+confidence))*cityAverage;
}

function priceNumber(level){return({PRICE_LEVEL_FREE:0,PRICE_LEVEL_INEXPENSIVE:1,PRICE_LEVEL_MODERATE:2,PRICE_LEVEL_EXPENSIVE:3,PRICE_LEVEL_VERY_EXPENSIVE:4})[level]??null}
function priceLabel(level){return({PRICE_LEVEL_FREE:'Free',PRICE_LEVEL_INEXPENSIVE:'$',PRICE_LEVEL_MODERATE:'$$',PRICE_LEVEL_EXPENSIVE:'$$$',PRICE_LEVEL_VERY_EXPENSIVE:'$$$$'})[level]||null}
function intentMatch(place,query){const terms=clean(query).toLowerCase().split(/\s+/).filter(term=>term.length>2),hay=[place.name,place.primaryType,place.shortType,...(place.types||[])].join(' ').toLowerCase();if(!terms.length)return .65;return terms.reduce((sum,term)=>sum+(hay.includes(term)?1:0),0)/terms.length}
function closingSoon(place){const next=place.currentOpeningHours?.nextCloseTime;if(!next)return false;const minutes=(new Date(next).getTime()-Date.now())/60000;return minutes>0&&minutes<20}
function scorePlace(place,{query,openNow,maxDistanceKm,maxPrice,minRating}){
 const match=intentMatch(place,query),open=place.currentOpeningHours?.openNow,distance=place.distanceKm,adjusted=adjustedRating(place.rating,place.reviewCount),price=priceNumber(place.priceLevel);
 if(openNow&&open===false)return null;if(maxDistanceKm&&distance!=null&&distance>maxDistanceKm)return null;if(maxPrice!=null&&price!=null&&price>maxPrice)return null;if(minRating&&number(place.rating,0)<minRating)return null;
 const openScore=open===true?1:open===false?0:.45,distanceScore=distance==null?.5:Math.max(0,1-distance/Math.max(maxDistanceKm||10,1)),ratingScore=Math.max(0,Math.min(1,(adjusted-3)/2)),budgetScore=maxPrice==null||price==null?.65:price<=maxPrice?1:0;
 let fit=30*match+20*openScore+15*distanceScore+15*ratingScore+10*budgetScore+10*.65;if(closingSoon(place))fit-=18;if(number(place.reviewCount,0)<10)fit-=5;
 return Math.max(0,Math.round(fit));
}

function mapGooglePlace(place,center){
 const location=place.location?{latitude:place.location.latitude,longitude:place.location.longitude}:null;
 return{id:`google-${place.id}`,providerId:place.id,name:place.displayName?.text||'Unnamed restaurant',address:place.formattedAddress||place.shortFormattedAddress||null,location,lat:location?.latitude,lon:location?.longitude,distanceKm:distanceKm(center,location),rating:place.rating||null,reviewCount:place.userRatingCount||0,priceLevel:place.priceLevel||null,priceLabel:priceLabel(place.priceLevel),primaryType:place.primaryType||null,primaryTypeDisplay:place.primaryTypeDisplayName?.text||null,types:place.types||[],businessStatus:place.businessStatus||null,currentOpeningHours:place.currentOpeningHours||null,regularOpeningHours:place.regularOpeningHours||null,website:place.websiteUri||null,phone:place.nationalPhoneNumber||place.internationalPhoneNumber||null,mapsUrl:place.googleMapsUri||null,takeout:place.takeout,dineIn:place.dineIn,delivery:place.delivery,reservable:place.reservable,servesVegetarianFood:place.servesVegetarianFood,outdoorSeating:place.outdoorSeating,goodForGroups:place.goodForGroups,restroom:place.restroom,reviews:(place.reviews||[]).slice(0,5).map(review=>({author:review.authorAttribution?.displayName,rating:review.rating,text:review.text?.text||review.originalText?.text,published:review.relativePublishTimeDescription,uri:review.googleMapsUri})),source:'Google Places'};
}

async function googleAutocomplete(input,key,sessionToken){
 const body={input,includeQueryPredictions:false};if(sessionToken)body.sessionToken=sessionToken;
 const data=await json(`${googleBase}/places:autocomplete`,{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key},body:JSON.stringify(body)});
 return(data.suggestions||[]).map(item=>item.placePrediction).filter(Boolean).map(prediction=>({placeId:prediction.placeId,text:prediction.text?.text||'',primaryText:prediction.structuredFormat?.mainText?.text||'',secondaryText:prediction.structuredFormat?.secondaryText?.text||'',types:prediction.types||[]}));
}

async function googlePlaceLocation(placeId,key){
 return json(`${googleBase}/places/${encodeURIComponent(placeId)}`,{headers:{'X-Goog-Api-Key':key,'X-Goog-FieldMask':'id,displayName,formattedAddress,location,types'}});
}

async function googleSearch({query,center,locationText,openNow,maxResults,key}){
 const fieldMask=['places.id','places.displayName','places.formattedAddress','places.location','places.rating','places.userRatingCount','places.priceLevel','places.businessStatus','places.currentOpeningHours','places.regularOpeningHours','places.primaryType','places.primaryTypeDisplayName','places.types','places.googleMapsUri','places.websiteUri','places.nationalPhoneNumber','places.internationalPhoneNumber','places.takeout','places.dineIn','places.delivery','places.reservable','places.servesVegetarianFood','places.outdoorSeating','places.goodForGroups','places.restroom','places.reviews'].join(',');
 const body={textQuery:locationText?`${query} in ${locationText}`:query,maxResultCount:Math.min(20,Math.max(1,maxResults||20)),languageCode:'en'};
 if(center)body.locationBias={circle:{center,radius:10000}};if(openNow)body.openNow=true;
 const data=await json(`${googleBase}/places:searchText`,{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':fieldMask},body:JSON.stringify(body)});
 return data.places||[];
}

async function fallbackSearch({location,query,radius}){
 const places=await json(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=${encodeURIComponent(location)}`),place=places[0];if(!place)return{location:null,restaurants:[]};
 const lat=Number(place.lat),lon=Number(place.lon),overpass=`[out:json][timeout:20];(nwr[amenity=restaurant](around:${radius},${lat},${lon});nwr[amenity=cafe](around:${radius},${lat},${lon});nwr[amenity=fast_food](around:${radius},${lat},${lon}););out center tags 80;`;
 const osm=await json('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:`data=${encodeURIComponent(overpass)}`});
 const restaurants=(osm.elements||[]).map(x=>({id:`osm-${x.type}-${x.id}`,name:x.tags?.name||x.tags?.['name:en']||'Unnamed restaurant',cuisine:x.tags?.cuisine||null,address:[x.tags?.['addr:housenumber'],x.tags?.['addr:street'],x.tags?.['addr:city']].filter(Boolean).join(' ')||null,lat:x.lat||x.center?.lat,lon:x.lon||x.center?.lon,website:x.tags?.website||x.tags?.['contact:website']||null,phone:x.tags?.phone||x.tags?.['contact:phone']||null,openingHours:x.tags?.opening_hours||null,source:'OpenStreetMap'})).filter(x=>!query||`${x.name} ${x.cuisine||''}`.toLowerCase().includes(query.toLowerCase())||query.toLowerCase()==='restaurant').slice(0,60);
 return{location:{name:place.display_name,lat,lon,country:place.address?.country,countryCode:place.address?.country_code},restaurants};
}

export function createFoodRouter(){
 const router=express.Router();
 router.get('/autocomplete',async(req,res)=>{const input=clean(req.query.q),key=process.env.GOOGLE_PLACES_API_KEY;if(input.length<2)return res.json({suggestions:[]});if(!key)return res.json({suggestions:[],provider:'unconfigured'});try{return res.json({suggestions:await googleAutocomplete(input,key,clean(req.query.sessionToken,100)),provider:'google'})}catch(error){console.error('Places autocomplete failed:',error.message);return res.status(502).json({error:'Location suggestions are temporarily unavailable.'})}});
 router.get('/place/:id',async(req,res)=>{const key=process.env.GOOGLE_PLACES_API_KEY;if(!key)return res.status(503).json({error:'Google Places is not configured.'});try{const place=await googlePlaceLocation(req.params.id,key);return res.json({place:{id:place.id,name:place.displayName?.text,address:place.formattedAddress,location:place.location,types:place.types||[]}})}catch(error){return res.status(502).json({error:error.message})}});
 router.get('/search',async(req,res)=>{
  const key=process.env.GOOGLE_PLACES_API_KEY,locationText=clean(req.query.location),query=clean(req.query.q||'restaurant'),latitude=number(req.query.latitude),longitude=number(req.query.longitude),center=latitude!=null&&longitude!=null?{latitude,longitude}:null,openNow=String(req.query.openNow)==='true',maxDistanceKm=Math.min(50,Math.max(1,number(req.query.maxDistanceKm,10))),maxPrice=req.query.maxPrice===''||req.query.maxPrice==null?null:Math.min(4,Math.max(0,number(req.query.maxPrice,4))),minRating=Math.min(5,Math.max(0,number(req.query.minRating,0))),sort=clean(req.query.sort||'best',20);
  if(!center&&!locationText)return res.status(400).json({error:'Choose a city, neighborhood, or current location.'});
  if(!key){try{const fallback=await fallbackSearch({location:locationText||`${latitude},${longitude}`,query,radius:maxDistanceKm*1000});return res.json({...fallback,reviewProvider:'community-only',provider:'openstreetmap',attribution:['© OpenStreetMap contributors']})}catch(error){return res.status(502).json({error:'Restaurant discovery is temporarily unavailable.'})}}
  try{
   let resolvedCenter=center,resolvedLocation={name:locationText||'Current location',lat:latitude,lon:longitude};
   if(!resolvedCenter&&req.query.placeId){const place=await googlePlaceLocation(clean(req.query.placeId,220),key);resolvedCenter=place.location;resolvedLocation={name:place.displayName?.text||locationText,address:place.formattedAddress,lat:place.location?.latitude,lon:place.location?.longitude}}
   const variants=[query];if(/fast|quick|takeout|casual/i.test(query)){for(const variant of [`quick ${query.replace(/fast|quick/ig,'').trim()}`,`${query.replace(/fast|quick/ig,'').trim()} takeout`])if(variant.trim()&&!variants.includes(variant.trim()))variants.push(variant.trim())}
   const batches=await Promise.all(variants.slice(0,3).map(variant=>googleSearch({query:variant,center:resolvedCenter,locationText:resolvedCenter?null:locationText,openNow,maxResults:20,key}).catch(()=>[]))),unique=new Map();
   for(const place of batches.flat())unique.set(place.id,place);
   let restaurants=[...unique.values()].map(place=>mapGooglePlace(place,resolvedCenter)).map(place=>({...place,fitScore:scorePlace(place,{query,openNow,maxDistanceKm,maxPrice,minRating})})).filter(place=>place.fitScore!=null);
   if(sort==='distance')restaurants.sort((a,b)=>(a.distanceKm??999)-(b.distanceKm??999));else if(sort==='rating')restaurants.sort((a,b)=>adjustedRating(b.rating,b.reviewCount)-adjustedRating(a.rating,a.reviewCount));else restaurants.sort((a,b)=>b.fitScore-a.fitScore||adjustedRating(b.rating,b.reviewCount)-adjustedRating(a.rating,a.reviewCount));
   restaurants=restaurants.slice(0,20).map((place,index)=>({...place,rank:index+1,recommendation:index===0?'Best fit':index<3?'Strong match':'Candidate',closingSoon:closingSoon(place)}));
   return res.json({location:resolvedLocation,restaurants,provider:'google',reviewProvider:'google',filters:{openNow,maxDistanceKm,maxPrice,minRating,sort},attribution:['Google Places'],scoring:'Fit score weighs query match, open status, distance, confidence-adjusted rating, budget, and general group fit.'});
  }catch(error){console.error('Google Places search failed:',error.message);return res.status(502).json({error:`Google Places search failed: ${error.message}`})}
 });
 return router;
}

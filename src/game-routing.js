import express from 'express';

const POINTS={
 'la-port':{name:'Los Angeles Import Gateway',lat:33.74,lng:-118.27,kind:'port',landmass:'north-america'},
 lax:{name:'LAX Air Cargo Gateway',lat:33.94,lng:-118.4,kind:'airport',landmass:'north-america'},
 'anaheim-pack':{name:'Anaheim Packaging Studio',lat:33.84,lng:-117.91,kind:'facility',landmass:'north-america'},
 'riverside-plant':{name:'Riverside Contract Manufacturing',lat:33.98,lng:-117.37,kind:'facility',landmass:'north-america'},
 'seattle-print':{name:'Seattle Print & Media Plant',lat:47.59,lng:-122.32,kind:'facility',landmass:'north-america'},
 'savannah-port':{name:'Savannah Import Gateway',lat:32.08,lng:-81.09,kind:'port',landmass:'north-america'},
 'mem-air':{name:'Memphis Recovery Hub',lat:35.04,lng:-89.98,kind:'airport',landmass:'north-america'},
 'dallas-dc':{name:'Dallas Retail Distribution Center',lat:32.78,lng:-96.8,kind:'facility',landmass:'north-america'},
 'atlanta-dc':{name:'Atlanta E-commerce Fulfillment Center',lat:33.75,lng:-84.39,kind:'facility',landmass:'north-america'},
 'allentown-dc':{name:'Allentown Marketplace Fulfillment Center',lat:40.61,lng:-75.49,kind:'facility',landmass:'north-america'}
};

const ROAD_CORRIDORS={
 'riverside-plant:anaheim-pack':[[33.98,-117.37],[33.89,-117.56],[33.86,-117.72],[33.84,-117.91]],
 'la-port:anaheim-pack':[[33.74,-118.27],[33.79,-118.15],[33.82,-118.01],[33.84,-117.91]],
 'anaheim-pack:dallas-dc':[[33.84,-117.91],[33.45,-112.07],[32.22,-110.97],[31.76,-106.49],[31.99,-102.08],[32.45,-99.73],[32.78,-96.8]],
 'anaheim-pack:allentown-dc':[[33.84,-117.91],[34.87,-111.76],[35.08,-106.65],[39.74,-104.99],[41.26,-95.94],[41.88,-87.63],[41.5,-81.69],[40.44,-79.99],[40.61,-75.49]],
 'seattle-print:dallas-dc':[[47.59,-122.32],[46.2,-119.14],[43.62,-116.2],[40.76,-111.89],[39.74,-104.99],[35.22,-101.83],[32.78,-96.8]],
 'la-port:atlanta-dc':[[33.74,-118.27],[33.45,-112.07],[32.22,-110.97],[31.76,-106.49],[32.78,-96.8],[32.3,-90.18],[33.52,-86.8],[33.75,-84.39]],
 'la-port:allentown-dc':[[33.74,-118.27],[36.17,-115.14],[39.74,-104.99],[41.26,-95.94],[41.88,-87.63],[41.5,-81.69],[40.44,-79.99],[40.61,-75.49]],
 'savannah-port:dallas-dc':[[32.08,-81.09],[32.84,-83.63],[33.52,-86.8],[32.3,-90.18],[32.53,-93.75],[32.78,-96.8]],
 'riverside-plant:atlanta-dc':[[33.98,-117.37],[33.45,-112.07],[32.22,-110.97],[31.76,-106.49],[32.78,-96.8],[32.3,-90.18],[33.52,-86.8],[33.75,-84.39]],
 'riverside-plant:allentown-dc':[[33.98,-117.37],[36.17,-115.14],[39.74,-104.99],[41.26,-95.94],[41.88,-87.63],[41.5,-81.69],[40.44,-79.99],[40.61,-75.49]],
 'seattle-print:atlanta-dc':[[47.59,-122.32],[43.62,-116.2],[40.76,-111.89],[39.74,-104.99],[39.1,-94.58],[38.63,-90.2],[36.16,-86.78],[33.75,-84.39]],
 'mem-air:dallas-dc':[[35.04,-89.98],[34.75,-92.29],[33.45,-94.04],[32.78,-96.8]],
 'mem-air:atlanta-dc':[[35.04,-89.98],[34.73,-86.59],[33.75,-84.39]],
 'mem-air:allentown-dc':[[35.04,-89.98],[36.16,-86.78],[39.1,-84.51],[39.96,-82.99],[40.44,-79.99],[40.61,-75.49]],
 'savannah-port:atlanta-dc':[[32.08,-81.09],[32.84,-83.63],[33.75,-84.39]],
 'savannah-port:allentown-dc':[[32.08,-81.09],[34.0,-81.03],[35.23,-80.84],[37.54,-77.44],[39.29,-76.61],[40.61,-75.49]]
};

const RAIL_CORRIDORS={
 'anaheim-pack:allentown-dc':[[33.84,-117.91],[34.05,-118.24],[35.2,-101.83],[39.1,-94.58],[41.88,-87.63],[41.41,-81.85],[40.61,-75.49]],
 'anaheim-pack:dallas-dc':[[33.84,-117.91],[34.05,-118.24],[35.08,-106.65],[35.47,-97.52],[32.78,-96.8]],
 'seattle-print:dallas-dc':[[47.59,-122.32],[45.52,-122.68],[43.62,-116.2],[41.14,-104.82],[39.1,-94.58],[32.78,-96.8]],
 'la-port:atlanta-dc':[[33.74,-118.27],[34.05,-118.24],[35.2,-101.83],[32.78,-96.8],[32.3,-90.18],[33.75,-84.39]],
 'la-port:allentown-dc':[[33.74,-118.27],[34.05,-118.24],[39.74,-104.99],[41.26,-95.94],[41.88,-87.63],[41.41,-81.85],[40.61,-75.49]],
 'savannah-port:dallas-dc':[[32.08,-81.09],[33.75,-84.39],[33.52,-86.8],[32.3,-90.18],[32.78,-96.8]],
 'mem-air:dallas-dc':[[35.04,-89.98],[34.75,-92.29],[32.78,-96.8]],
 'mem-air:allentown-dc':[[35.04,-89.98],[38.63,-90.2],[41.5,-81.69],[40.61,-75.49]]
};

const OCEAN_CORRIDORS={
 'la-port:savannah-port':[[33.74,-118.27],[30.0,-119.5],[23.0,-116.5],[15.0,-108.5],[9.0,-94.0],[8.8,-82.0],[12.0,-78.0],[20.0,-75.0],[27.0,-78.8],[31.0,-79.8],[32.08,-81.09]]
};

const cache=new Map(),key=(mode,from,to)=>`${mode}:${from}:${to}`,rad=value=>value*Math.PI/180;
function haversine(a,b){const dLat=rad(b[0]-a[0]),dLng=rad(b[1]-a[1]),value=Math.sin(dLat/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dLng/2)**2;return 6371000*2*Math.atan2(Math.sqrt(value),Math.sqrt(1-value))}
function distance(coordinates){let total=0;for(let index=1;index<coordinates.length;index++)total+=haversine(coordinates[index-1],coordinates[index]);return total}
function reverseLookup(collection,from,to){const direct=collection[`${from}:${to}`];if(direct)return direct.map(point=>[...point]);const reverse=collection[`${to}:${from}`];return reverse?[...reverse].reverse().map(point=>[...point]):null}
function arc(from,to,points=32){const a=POINTS[from],b=POINTS[to];if(!a||!b)return[];const dx=b.lng-a.lng,dy=b.lat-a.lat,length=Math.hypot(dx,dy)||1,bend=Math.min(8,length*.12),coordinates=[];for(let index=0;index<=points;index++){const t=index/points,lift=Math.sin(Math.PI*t)*bend;coordinates.push([a.lat+dy*t+(dx/length)*lift,a.lng+dx*t-(dy/length)*lift])}return coordinates}

export function routeConstraint(mode,from,to){
 const a=POINTS[from],b=POINTS[to];if(!a||!b)return{ok:false,error:'Unknown route location.'};if(!['truck','rail','air','ocean'].includes(mode))return{ok:false,error:'Unknown route mode.'};
 const crossesOcean=a.landmass!==b.landmass;
 if(crossesOcean&&['truck','rail'].includes(mode))return{ok:false,error:`${mode} cannot connect different landmasses. Use an ocean vessel between ports or an air movement.`};
 if(mode==='ocean'&&(a.kind!=='port'||b.kind!=='port'))return{ok:false,error:'Ocean movements must begin and end at ports.'};
 return{ok:true,crossesOcean};
}
function fallback(mode,from,to){const constraint=routeConstraint(mode,from,to);if(!constraint.ok)return null;let coordinates=null;if(mode==='truck')coordinates=reverseLookup(ROAD_CORRIDORS,from,to);else if(mode==='rail')coordinates=reverseLookup(RAIL_CORRIDORS,from,to);else if(mode==='ocean')coordinates=reverseLookup(OCEAN_CORRIDORS,from,to);else if(mode==='air')coordinates=arc(from,to);if(!coordinates?.length)return null;return{mode,from,to,coordinates,distanceMeters:distance(coordinates),durationSeconds:null,source:mode==='truck'?'atlas-road-fallback':mode==='rail'?'atlas-rail-corridor':mode==='ocean'?'atlas-ocean-corridor':'atlas-air-arc',crossesOcean:constraint.crossesOcean}}
async function osrmRoute(fetchImpl,from,to){const constraint=routeConstraint('truck',from,to);if(!constraint.ok)throw Object.assign(new Error(constraint.error),{status:400});const a=POINTS[from],b=POINTS[to],url=`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson&steps=false`,response=await fetchImpl(url,{headers:{Accept:'application/json','User-Agent':'AtlasHarbor/1.0'},signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error(`OSRM returned ${response.status}`);const data=await response.json(),route=data.routes?.[0],raw=route?.geometry?.coordinates;if(!route||!Array.isArray(raw)||raw.length<2)throw new Error('OSRM returned no route geometry.');return{mode:'truck',from,to,coordinates:raw.map(([lng,lat])=>[lat,lng]),distanceMeters:route.distance,durationSeconds:route.duration,source:'osrm-openstreetmap',crossesOcean:false}}
async function routeFor(fetchImpl,mode,from,to){const constraint=routeConstraint(mode,from,to);if(!constraint.ok)throw Object.assign(new Error(constraint.error),{status:400});const cacheKey=key(mode,from,to),saved=cache.get(cacheKey);if(saved&&Date.now()-saved.savedAt<24*3600000)return saved.value;let value;if(mode==='truck'){try{value=await osrmRoute(fetchImpl,from,to)}catch(error){if(error.status===400)throw error;value=fallback(mode,from,to)}}else value=fallback(mode,from,to);if(!value)throw Object.assign(new Error(`No verified ${mode} corridor is configured between ${POINTS[from].name} and ${POINTS[to].name}. Atlas Harbor will not draw a straight-line substitute.`),{status:422});cache.set(cacheKey,{savedAt:Date.now(),value});return value}
function nearestNeighbor(stops){if(stops.length<3)return stops;const remaining=stops.slice(1,-1),ordered=[stops[0]];while(remaining.length){const current=POINTS[ordered.at(-1)],best=remaining.map(id=>({id,d:haversine([current.lat,current.lng],[POINTS[id].lat,POINTS[id].lng])})).sort((a,b)=>a.d-b.d)[0];ordered.push(best.id);remaining.splice(remaining.indexOf(best.id),1)}ordered.push(stops.at(-1));return ordered}
async function optimizeTrip(fetchImpl,stops){for(let index=1;index<stops.length;index++){const constraint=routeConstraint('truck',stops[index-1],stops[index]);if(!constraint.ok)throw Object.assign(new Error(constraint.error),{status:400})}const coordinates=stops.map(id=>`${POINTS[id].lng},${POINTS[id].lat}`).join(';'),url=`https://router.project-osrm.org/trip/v1/driving/${coordinates}?source=first&destination=last&roundtrip=false&overview=full&geometries=geojson`,response=await fetchImpl(url,{headers:{Accept:'application/json','User-Agent':'AtlasHarbor/1.0'},signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error(`OSRM trip returned ${response.status}`);const data=await response.json(),trip=data.trips?.[0];if(!trip)throw new Error('OSRM returned no optimized trip.');const ordered=data.waypoints.map((waypoint,index)=>({id:stops[index],index:waypoint.waypoint_index})).sort((a,b)=>a.index-b.index).map(item=>item.id);return{orderedStops:ordered,distanceMeters:trip.distance,durationSeconds:trip.duration,coordinates:trip.geometry.coordinates.map(([lng,lat])=>[lat,lng]),source:'osrm-trip'}}

export function createGameRoutingRouter({fetchImpl=globalThis.fetch}={}){
 const router=express.Router();
 router.get('/api/game/routes/:mode/:from/:to',async(req,res)=>{const mode=String(req.params.mode),from=String(req.params.from),to=String(req.params.to),constraint=routeConstraint(mode,from,to);if(!constraint.ok)return res.status(400).json({error:constraint.error});try{const route=await routeFor(fetchImpl,mode,from,to);res.set('Cache-Control','public,max-age=86400,stale-while-revalidate=604800');return res.json({route,constraint})}catch(error){return res.status(error.status||502).json({error:error.message})}});
 router.post('/api/game/optimize',async(req,res)=>{const mode=String(req.body?.mode||'truck'),stops=Array.isArray(req.body?.stops)?req.body.stops.map(String):[];if(stops.length<2||stops.length>12||stops.some(id=>!POINTS[id]))return res.status(400).json({error:'Supply between 2 and 12 known stop IDs.'});for(let index=1;index<stops.length;index++){const constraint=routeConstraint(mode,stops[index-1],stops[index]);if(!constraint.ok)return res.status(400).json({error:constraint.error})}try{if(mode==='truck'&&stops.length>=3){try{return res.json({optimization:await optimizeTrip(fetchImpl,stops)})}catch(error){if(error.status===400)throw error}}const orderedStops=nearestNeighbor(stops),legs=[];for(let index=1;index<orderedStops.length;index++)legs.push(await routeFor(fetchImpl,mode,orderedStops[index-1],orderedStops[index]));return res.json({optimization:{orderedStops,distanceMeters:legs.reduce((total,leg)=>total+(leg?.distanceMeters||0),0),source:'nearest-neighbor-fallback'}})}catch(error){return res.status(error.status||502).json({error:error.message})}});
 return router;
}

export{POINTS,fallback,distance,nearestNeighbor};

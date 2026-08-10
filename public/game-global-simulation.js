const $=selector=>document.querySelector(selector);
const GAME_KEY='atlas-game-state';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":'&#39;'}[char]));

const FACILITIES={
 'shenzhen-factory':{name:'Shenzhen Electronics Campus',country:'China',type:'factory',lat:22.73,lng:113.93,detail:'Electronics assembly and launch-unit manufacturing'},
 'yantian-port':{name:'Yantian International Container Terminal',country:'China',type:'port',lat:22.59,lng:114.27,detail:'Export container gateway'},
 'la-port':{name:'Los Angeles / Long Beach Gateway',country:'United States',type:'port',lat:33.74,lng:-118.27,detail:'Pacific import gateway'},
 'inland-empire-dc':{name:'Inland Empire Distribution Campus',country:'United States',type:'dc',lat:34.02,lng:-117.36,detail:'Retail and e-commerce distribution'},
 'busan-plant':{name:'Busan Mobility Components Plant',country:'South Korea',type:'factory',lat:35.22,lng:128.93,detail:'EV service-parts manufacturing'},
 'busan-port':{name:'Port of Busan',country:'South Korea',type:'port',lat:35.10,lng:129.04,detail:'Northeast Asia ocean gateway'},
 'rotterdam-port':{name:'Port of Rotterdam',country:'Netherlands',type:'port',lat:51.95,lng:4.14,detail:'European deep-sea gateway'},
 'venlo-dc':{name:'Venlo European Distribution Campus',country:'Netherlands',type:'dc',lat:51.37,lng:6.17,detail:'Benelux and continental distribution'},
 'mumbai-pack':{name:'Mumbai Healthcare Packaging Plant',country:'India',type:'factory',lat:19.13,lng:72.92,detail:'Healthcare packaging and kitting'},
 'nhava-port':{name:'Nhava Sheva / JNPA',country:'India',type:'port',lat:18.95,lng:72.95,detail:'Western India container gateway'},
 'jebel-port':{name:'Jebel Ali Port',country:'United Arab Emirates',type:'port',lat:25.01,lng:55.06,detail:'Gulf transshipment and import gateway'},
 'dubai-dc':{name:'Dubai Regional Fulfillment Center',country:'United Arab Emirates',type:'dc',lat:25.11,lng:55.18,detail:'GCC retail replenishment'},
 'nairobi-mill':{name:'Nairobi Coffee Processing Cooperative',country:'Kenya',type:'factory',lat:-1.31,lng:36.88,detail:'Coffee grading, roasting prep, and export consolidation'},
 'mombasa-port':{name:'Port of Mombasa',country:'Kenya',type:'port',lat:-4.04,lng:39.67,detail:'East Africa ocean gateway'},
 'felix-port':{name:'Port of Felixstowe',country:'United Kingdom',type:'port',lat:51.96,lng:1.35,detail:'United Kingdom container gateway'},
 'birmingham-dc':{name:'Midlands Distribution Center',country:'United Kingdom',type:'dc',lat:52.49,lng:-1.89,detail:'UK national distribution'},
 'yokohama-plant':{name:'Yokohama Precision Components Plant',country:'Japan',type:'factory',lat:35.49,lng:139.55,detail:'Industrial and grid components'},
 'yokohama-port':{name:'Port of Yokohama',country:'Japan',type:'port',lat:35.45,lng:139.64,detail:'Japan export gateway'},
 'sydney-port':{name:'Port Botany',country:'Australia',type:'port',lat:-33.97,lng:151.22,detail:'Sydney container gateway'},
 'western-sydney-dc':{name:'Western Sydney Project DC',country:'Australia',type:'dc',lat:-33.82,lng:150.84,detail:'Industrial project distribution'},
 'jakarta-factory':{name:'Jakarta Furniture Manufacturing Cluster',country:'Indonesia',type:'factory',lat:-6.25,lng:106.83,detail:'Furniture and home-goods manufacturing'},
 'tanjung-port':{name:'Tanjung Priok',country:'Indonesia',type:'port',lat:-6.10,lng:106.89,detail:'Indonesia container gateway'},
 'cartagena-plant':{name:'Cartagena Packaging Materials Plant',country:'Colombia',type:'factory',lat:10.33,lng:-75.51,detail:'Bottling and packaging materials'},
 'cartagena-port':{name:'Port of Cartagena',country:'Colombia',type:'port',lat:10.40,lng:-75.53,detail:'Caribbean transshipment gateway'},
 'savannah-port':{name:'Port of Savannah',country:'United States',type:'port',lat:32.08,lng:-81.09,detail:'U.S. Southeast import gateway'},
 'atlanta-dc':{name:'Atlanta Production Continuity DC',country:'United States',type:'dc',lat:33.75,lng:-84.39,detail:'Southeast manufacturing support'},
 'shanghai-factory':{name:'Shanghai Medical Device Factory',country:'China',type:'factory',lat:31.19,lng:121.12,detail:'High-value medical-device manufacturing'},
 'pudong-air':{name:'Shanghai Pudong Air Cargo',country:'China',type:'airport',lat:31.14,lng:121.80,detail:'International air-cargo gateway'},
 'sydney-air':{name:'Sydney Air Cargo Terminal',country:'Australia',type:'airport',lat:-33.95,lng:151.18,detail:'Priority air-cargo gateway'}
};
const F=id=>FACILITIES[id];
const point=(lat,lng)=>[lat,lng];
const road=(from,to,via=[])=>({mode:'truck',from,to,path:[point(F(from).lat,F(from).lng),...via,point(F(to).lat,F(to).lng)]});
const sea=(from,to,path)=>({mode:'ocean',from,to,path:[point(F(from).lat,F(from).lng),...path,point(F(to).lat,F(to).lng)]});
const air=(from,to)=>({mode:'air',from,to,path:greatCircle(point(F(from).lat,F(from).lng),point(F(to).lat,F(to).lng),36)});

function greatCircle(a,b,steps=32){
 const rad=x=>x*Math.PI/180,deg=x=>x*180/Math.PI;
 const [lat1,lon1]=a.map(rad),[lat2,lon2]=b.map(rad);
 const d=2*Math.asin(Math.sqrt(Math.sin((lat2-lat1)/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin((lon2-lon1)/2)**2));
 if(!d)return[a,b];
 const out=[];
 for(let i=0;i<=steps;i++){
  const t=i/steps,A=Math.sin((1-t)*d)/Math.sin(d),B=Math.sin(t*d)/Math.sin(d);
  const x=A*Math.cos(lat1)*Math.cos(lon1)+B*Math.cos(lat2)*Math.cos(lon2),y=A*Math.cos(lat1)*Math.sin(lon1)+B*Math.cos(lat2)*Math.sin(lon2),z=A*Math.sin(lat1)+B*Math.sin(lat2);
  out.push([deg(Math.atan2(z,Math.sqrt(x*x+y*y))),deg(Math.atan2(y,x))]);
 }
 return out;
}

const ROUTINE=[
 {id:'SC-101',customer:'Vertex Home Systems',cargo:'Consumer electronics',purpose:'Launch replenishment',carrier:'Pacific Crown Shipping',cycle:205,phase:18,legs:[
  road('shenzhen-factory','yantian-port',[point(22.67,114.05),point(22.62,114.18)]),
  sea('yantian-port','la-port',[point(20.5,117),point(18,125),point(24,142),point(31,160),point(36,178),point(39,-165),point(38,-145),point(35,-128)]),
  road('la-port','inland-empire-dc',[point(33.84,-118.05),point(33.93,-117.75),point(34.00,-117.53)])]},
 {id:'SC-202',customer:'Northline Mobility',cargo:'EV service parts',purpose:'European production continuity',carrier:'MaasLink Maritime',cycle:260,phase:102,legs:[
  road('busan-plant','busan-port',[point(35.17,128.97)]),
  sea('busan-port','rotterdam-port',[point(30,126),point(22,121),point(8,108),point(2,103),point(5,95),point(6,80),point(12,58),point(12.5,45),point(15,42),point(29.5,32.5),point(34,28),point(36,15),point(43,-2),point(49,-5),point(51,1)]),
  road('rotterdam-port','venlo-dc',[point(51.93,4.48),point(51.73,5.30),point(51.48,5.92)])]},
 {id:'SC-303',customer:'Crescent Retail Group',cargo:'Healthcare packaging',purpose:'GCC store-opening inventory',carrier:'GulfBridge Logistics',cycle:150,phase:62,legs:[
  road('mumbai-pack','nhava-port',[point(19.08,72.90),point(19.00,72.92)]),
  sea('nhava-port','jebel-port',[point(18,70),point(20,66),point(23,61),point(24.5,57.5)]),
  road('jebel-port','dubai-dc',[point(25.04,55.09),point(25.08,55.14)])]},
 {id:'SC-404',customer:'Field & Roastery Co.',cargo:'Specialty coffee',purpose:'Seasonal UK inventory',carrier:'East Africa Cargo Cooperative',cycle:235,phase:146,legs:[
  road('nairobi-mill','mombasa-port',[point(-1.75,37.20),point(-2.50,38.00),point(-3.30,39.05)]),
  sea('mombasa-port','felix-port',[point(-1,43),point(8,50),point(12.5,45),point(15,42),point(29.5,32.5),point(35,25),point(37,12),point(43,-2),point(49,-5),point(51.5,1)]),
  road('felix-port','birmingham-dc',[point(52.08,0.70),point(52.20,-0.25),point(52.38,-1.10)])]},
 {id:'SC-505',customer:'Southern Grid Works',cargo:'Industrial components',purpose:'Australian project milestone',carrier:'Southern Cross Freight',cycle:190,phase:84,legs:[
  road('yokohama-plant','yokohama-port',[point(35.47,139.59)]),
  sea('yokohama-port','sydney-port',[point(31,145),point(23,151),point(10,155),point(-5,155),point(-20,153),point(-30,152)]),
  road('sydney-port','western-sydney-dc',[point(-33.92,151.08),point(-33.88,150.98)])]},
 {id:'SC-606',customer:'Harbor House Brands',cargo:'Furniture and décor',purpose:'Gulf peak-season stock',carrier:'GulfBridge Logistics',cycle:225,phase:29,legs:[
  road('jakarta-factory','tanjung-port',[point(-6.20,106.84),point(-6.15,106.87)]),
  sea('tanjung-port','jebel-port',[point(-4,104),point(1,102),point(5,96),point(7,88),point(8,80),point(12,68),point(18,60),point(23,57)]),
  road('jebel-port','dubai-dc',[point(25.04,55.09),point(25.08,55.14)])]},
 {id:'SC-707',customer:'Coastal Beverage Labs',cargo:'Bottling materials',purpose:'Plant continuity',carrier:'Andean Coast Forwarding',cycle:170,phase:121,legs:[
  road('cartagena-plant','cartagena-port',[point(10.36,-75.52)]),
  sea('cartagena-port','savannah-port',[point(13,-76),point(17,-78),point(22,-79),point(26,-79.5),point(30,-80)]),
  road('savannah-port','atlanta-dc',[point(32.35,-81.45),point(32.80,-82.30),point(33.35,-83.20)])]},
 {id:'SC-808',customer:'Kiteworks Devices',cargo:'Critical medical devices',purpose:'Priority launch recovery',carrier:'Southern Cross Freight',cycle:130,phase:47,legs:[
  road('shanghai-factory','pudong-air',[point(31.19,121.35),point(31.17,121.58)]),
  air('pudong-air','sydney-air'),
  road('sydney-air','western-sydney-dc',[point(-33.92,151.05),point(-33.88,150.94)])]}
];

const modeIcon={truck:'🚚',ocean:'🚢',air:'✈️'};
const modeLabel={truck:'Truck / drayage',ocean:'Ocean vessel',air:'Air cargo'};
const facilityIcon={factory:'🏭',port:'⚓',airport:'✈️',dc:'🏬'};
window.__atlasRoutineGlobalMoveCount=ROUTINE.length;
function readGame(){try{return window.__atlasGameState||JSON.parse(localStorage.getItem(GAME_KEY)||'{}')}catch{return{}}}
let map=null,networkLayer=null,facilityLayer=null,vehicleLayer=null,markers=new Map(),selected=null,timer=null,visualClock=performance.now()/1000,lastTick=performance.now()/1000;

function pathDistance(path){let d=0;for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i];let dLng=b[1]-a[1];if(dLng>180)dLng-=360;if(dLng<-180)dLng+=360;const dx=dLng*Math.cos((a[0]+b[0])*Math.PI/360),dy=b[0]-a[0];d+=Math.hypot(dx,dy)}return d}
function pointAlong(path,t){if(!path?.length)return[0,0];if(path.length===1)return path[0];const lengths=[],total=pathDistance(path);let walked=0;for(let i=1;i<path.length;i++){const seg=pathDistance([path[i-1],path[i]]);lengths.push(seg)}let target=total*Math.max(0,Math.min(1,t));for(let i=1;i<path.length;i++){const seg=lengths[i-1];if(walked+seg>=target){const r=seg?(target-walked)/seg:0;let lonA=path[i-1][1],lonB=path[i][1],diff=lonB-lonA;if(diff>180)lonB-=360;if(diff<-180)lonB+=360;let lon=lonA+(lonB-lonA)*r;while(lon>180)lon-=360;while(lon<-180)lon+=360;return[path[i-1][0]+(path[i][0]-path[i-1][0])*r,lon]}walked+=seg}return path.at(-1)}
function legWeights(shipment){const raw=shipment.legs.map(leg=>leg.mode==='ocean'?4.8:leg.mode==='air'?3.1:1.15),sum=raw.reduce((a,b)=>a+b,0);return raw.map(x=>x/sum)}
function snapshot(shipment,now=visualClock){const progress=((now+shipment.phase)%shipment.cycle)/shipment.cycle,weights=legWeights(shipment);let cumulative=0;for(let i=0;i<weights.length;i++){const end=cumulative+weights[i];if(progress<=end||i===weights.length-1){const leg=shipment.legs[i],local=(progress-cumulative)/weights[i];return{leg,index:i,local:Math.max(0,Math.min(1,local)),overall:progress,position:pointAlong(leg.path,local)}}cumulative=end}return null}
function vehicleIcon(mode){return window.L.divIcon({className:'global-vehicle-shell',html:`<span class="global-vehicle global-vehicle-${mode}">${modeIcon[mode]}</span>`,iconSize:[36,36],iconAnchor:[18,18]})}
function facilityMarker(item){return window.L.marker([item.lat,item.lng],{icon:window.L.divIcon({className:'global-facility-shell',html:`<span class="global-facility global-facility-${item.type}">${facilityIcon[item.type]}</span>`,iconSize:[30,30],iconAnchor:[15,15]})}).bindTooltip(`<b>${esc(item.name)}</b><br>${esc(item.country)} · ${esc(item.detail)}`)}
function splitDateline(path){const groups=[[path[0]]];for(let i=1;i<path.length;i++){const prev=path[i-1],next=path[i];if(Math.abs(next[1]-prev[1])>180)groups.push([next]);else groups.at(-1).push(next)}return groups.filter(g=>g.length>1)}
function drawLeg(leg,shipment){for(const segment of splitDateline(leg.path))window.L.polyline(segment,{className:`global-live-route global-live-route-${leg.mode}`,weight:leg.mode==='ocean'?3:leg.mode==='air'?2:3,opacity:.55,dashArray:leg.mode==='air'?'8 8':null}).addTo(networkLayer).bindTooltip(`${shipment.id} · ${modeLabel[leg.mode]} · ${shipment.cargo}`)}
function renderStatic(){
 networkLayer?.remove();facilityLayer?.remove();vehicleLayer?.remove();
 networkLayer=window.L.layerGroup().addTo(map);facilityLayer=window.L.layerGroup().addTo(map);vehicleLayer=window.L.layerGroup().addTo(map);markers.clear();
 for(const item of Object.values(FACILITIES))facilityMarker(item).addTo(facilityLayer);
 for(const shipment of ROUTINE){for(const leg of shipment.legs)drawLeg(leg,shipment);const snap=snapshot(shipment);const marker=window.L.marker(snap.position,{icon:vehicleIcon(snap.leg.mode),zIndexOffset:500}).addTo(vehicleLayer);marker.on('click',()=>openShipment(shipment));marker.bindTooltip(`${shipment.id} · ${shipment.cargo}`);markers.set(shipment.id,{marker,mode:snap.leg.mode})}
 updatePositions();
}
function updatePositions(){const real=performance.now()/1000,delta=Math.min(2,Math.max(0,real-lastTick));lastTick=real;if(!readGame().paused)visualClock+=delta;const now=visualClock;for(const shipment of ROUTINE){const snap=snapshot(shipment,now),entry=markers.get(shipment.id);if(!entry)continue;entry.marker.setLatLng(snap.position);if(entry.mode!==snap.leg.mode){entry.mode=snap.leg.mode;entry.marker.setIcon(vehicleIcon(snap.leg.mode))}if(selected===shipment.id)renderPanel(shipment,snap)}}
function ensurePanel(){let panel=$('#global-live-shipment');if(panel)return panel;panel=document.createElement('aside');panel.id='global-live-shipment';panel.className='global-live-shipment';panel.hidden=true;panel.innerHTML='<button type="button" class="global-live-close" aria-label="Close">×</button><div data-global-live-copy></div><div class="global-live-actions"><button type="button" data-global-control>Open control tower</button><button type="button" data-global-focus>Focus route</button></div>';$('.map-stage')?.append(panel);panel.querySelector('.global-live-close').onclick=()=>{selected=null;panel.hidden=true};panel.querySelector('[data-global-control]').onclick=()=>$('#show-all')?.click();return panel}
function renderPanel(shipment,snap=snapshot(shipment)){const panel=ensurePanel();if(!panel)return;selected=shipment.id;const from=F(snap.leg.from),to=F(snap.leg.to),remaining=Math.max(1,Math.round((1-snap.overall)*shipment.cycle/12));panel.hidden=false;panel.querySelector('[data-global-live-copy]').innerHTML=`<p class="eyebrow">LIVE GLOBAL MOVE</p><h3>${esc(shipment.id)} · ${esc(shipment.cargo)}</h3><p><b>${esc(modeIcon[snap.leg.mode])} ${esc(modeLabel[snap.leg.mode])}</b> · ${esc(from.name)} → ${esc(to.name)}</p><p>${esc(shipment.customer)} · ${esc(shipment.purpose)}</p><div class="global-live-meta"><span>${Math.round(snap.overall*100)}% network cycle</span><span>${Math.round(snap.local*100)}% current leg</span><span>~${remaining} game h to handoff</span></div><p class="global-live-carrier">Managed through ${esc(shipment.carrier)} and the Global Trade Desk.</p>`;panel.querySelector('[data-global-focus]').onclick=()=>focusShipment(shipment)}
function openShipment(shipment){renderPanel(shipment);focusShipment(shipment)}
function focusShipment(shipment){const points=shipment.legs.flatMap(leg=>leg.path).filter(p=>Math.abs(p[1])<175);if(points.length>1)map.fitBounds(window.L.latLngBounds(points),{padding:[55,55],maxZoom:4})}
function installLegend(){if($('#global-live-legend'))return;const host=$('.map-stage');if(!host)return;const legend=document.createElement('div');legend.id='global-live-legend';legend.className='global-live-legend';legend.innerHTML='<b>Global live network</b><span>🏭 manufacturing</span><span>⚓ ports</span><span>🏬 distribution</span><span>🚚 truck</span><span>🚢 vessel</span><span>✈️ air</span>';host.append(legend)}
function start(target){if(!target||map===target)return;map=target;renderStatic();installLegend();clearInterval(timer);timer=setInterval(updatePositions,850);window.dispatchEvent(new CustomEvent('atlas-global-routine-ready',{detail:{count:ROUTINE.length}}));window.addEventListener('pagehide',()=>clearInterval(timer),{once:true})}
window.addEventListener('atlas-main-game-map-ready',event=>start(event.detail?.map));
if(window.__atlasMainGameMap)start(window.__atlasMainGameMap);
window.addEventListener('atlas-game-reset',()=>{selected=null;const panel=$('#global-live-shipment');if(panel)panel.hidden=true});

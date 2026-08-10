(()=>{
  const GAME_KEY='atlas-game-state';
  const REAL_MS_PER_GAME_HOUR=15*60*1000;
  const MAX_CATCHUP_HOURS=720;
  const SPEEDS=[1,2,4];
  const nativeSetInterval=window.setInterval.bind(window);
  const nativeClearInterval=window.clearInterval.bind(window);
  const suppressed={base:false,command:false};

  function fnSource(fn){try{return Function.prototype.toString.call(fn)}catch{return''}}
  window.setInterval=function(fn,delay,...args){
    const source=fnSource(fn);
    if(!suppressed.base&&Number(delay)===REAL_MS_PER_GAME_HOUR&&/advance\(true\)/.test(source)){
      suppressed.base=true;
      return-91001;
    }
    if(!suppressed.command&&Number(delay)===15000&&(fn?.name==='clockTick'||/clockTick/.test(source))){
      suppressed.command=true;
      queueMicrotask(()=>{window.setInterval=nativeSetInterval;window.clearInterval=nativeClearInterval});
      return-91002;
    }
    return nativeSetInterval(fn,delay,...args);
  };
  window.clearInterval=function(id){if(id===-91001||id===-91002)return;return nativeClearInterval(id)};
  window.addEventListener('load',()=>setTimeout(()=>{window.setInterval=nativeSetInterval;window.clearInterval=nativeClearInterval},1200),{once:true});

  const PLACES={
    'la-port':{lat:33.74,lng:-118.27},lax:{lat:33.94,lng:-118.4},'anaheim-pack':{lat:33.84,lng:-117.91},'riverside-plant':{lat:33.98,lng:-117.37},'seattle-print':{lat:47.59,lng:-122.32},'savannah-port':{lat:32.08,lng:-81.09},'mem-air':{lat:35.04,lng:-89.98},'dallas-dc':{lat:32.78,lng:-96.8},'atlanta-dc':{lat:33.75,lng:-84.39},'allentown-dc':{lat:40.61,lng:-75.49}
  };
  const MODE_KPH={truck:230,rail:180,air:760,ocean:110};
  const MODE_COST={truck:18000,rail:12000,air:52000,ocean:30000};
  const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  let tickTimer=null,uiTimer=null,applying=false,lastPublishedHour=null;

  function clone(value){return structuredClone(value)}
  function readState(){try{return clone(window.__atlasGameState||JSON.parse(localStorage.getItem(GAME_KEY)||'{}'))}catch{return{}}}
  function writeState(state){try{localStorage.setItem(GAME_KEY,JSON.stringify(state))}catch{}window.__atlasGameState=clone(state)}
  function normalizeClock(state){
    state.clock=state.clock&&typeof state.clock==='object'?state.clock:{};
    const clock=state.clock;
    clock.speed=SPEEDS.includes(Number(clock.speed))?Number(clock.speed):1;
    clock.lastRealAt=Number(clock.lastRealAt||state.updatedAt||Date.now());
    clock.extraCarryMs=Math.max(0,Number(clock.extraCarryMs||0));
    clock.authority='network-v2';
    return clock;
  }
  function rad(v){return v*Math.PI/180}
  function distanceKm(a,b){
    if(!a||!b)return 0;
    const dLat=rad(b.lat-a.lat),dLng=rad(b.lng-a.lng),x=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2;
    return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
  }
  function movementHours(movement){
    const ids=movement.route||[],from=PLACES[ids[movement.segment]],to=PLACES[ids[movement.segment+1]],km=distanceKm(from,to),kph=MODE_KPH[movement.mode]||200;
    return Math.max(1,km/kph);
  }
  function orderById(state,id){return(state.orders||[]).find(order=>order.id===id)}
  function riskHigh(state,order){const left=Number(order.dueAt||0)-Number(state.totalHours||0);return(state.exceptions||[]).some(ex=>ex.orderId===order.id)||left<=8}
  function settleArrival(state,movement){
    const order=orderById(state,movement.orderId);if(!order)return false;
    if(movement.segment<(movement.route?.length||0)-2){movement.segment++;movement.progress=0;state.routine=Number(state.routine||0)+1;return false}
    order.status='delivered';state.deliveries=Number(state.deliveries||0)+1;state.cash=Number(state.cash||0)+Math.round(Number(order.value||0)*.22);
    const onTime=Number(state.totalHours||0)<=Number(order.dueAt||0);state.trust=Math.max(0,Math.min(100,Number(state.trust||82)+(onTime?3:-4)));state.onTime=Math.max(70,Math.min(100,Number(state.onTime||94)+(onTime?.6:-1.4)));state.routine=Number(state.routine||0)+1;
    state.events=Array.isArray(state.events)?state.events:[];state.events.unshift({time:'Network clock',text:`${order.id} delivered ${onTime?'on time':'late'} while network time advanced.`});return true;
  }
  function autoDispatch(state){
    if(!state.delegation?.dispatch)return;
    const order=(state.orders||[]).find(item=>item.status==='ready'&&!(state.shipments||[]).some(m=>m.orderId===item.id)&&!riskHigh(state,item));if(!order)return;
    const left=Number(order.dueAt||0)-Number(state.totalHours||0),mode=left<18?'air':left<30?'truck':'rail',route=[order.origin,order.via,order.dest].filter(Boolean);
    state.shipments.push({id:`MV-AUTO-${Date.now().toString(36)}-${order.id}`,orderId:order.id,route,segment:0,progress:0,mode,paused:false,exception:false,driver:'Routine dispatch desk'});order.status='moving';state.cash=Math.max(0,Number(state.cash||0)-(MODE_COST[mode]||0));state.routine=Number(state.routine||0)+1;
  }
  function simulateOneHour(state){
    state.totalHours=Number(state.totalHours||8)+1;
    if(state.delegation?.production)(state.orders||[]).filter(order=>order.status==='production'&&Number(order.inventory||0)<Number(order.qty||0)).forEach(order=>{order.inventory=Math.min(order.qty,Number(order.inventory||0)+2200+Number(state.upgradeLevels?.dispatchAI||0)*700);if(order.inventory>=order.qty){order.status='ready';state.routine=Number(state.routine||0)+1}});
    const done=[];(state.shipments||[]).forEach(movement=>{if(movement.paused||movement.exception)return;movement.progress=Number(movement.progress||0)+1/movementHours(movement);while(movement.progress>=1){movement.progress-=1;if(settleArrival(state,movement)){done.push(movement.id);break}}});state.shipments=(state.shipments||[]).filter(m=>!done.includes(m.id));autoDispatch(state);
  }
  function simulateHours(state,hours){for(let i=0;i<hours;i++)simulateOneHour(state)}
  function continuousHours(state=readState(),now=Date.now()){
    const clock=normalizeClock(state),pending=state.paused?0:Math.max(0,now-clock.lastRealAt)*clock.speed;
    return Number(state.totalHours||8)+(clock.extraCarryMs+pending)/REAL_MS_PER_GAME_HOUR;
  }
  function formatHours(value){
    const safe=Math.max(0,Number(value||0)),whole=Math.floor(safe),day=Math.floor(whole/24),hour=whole%24,minute=Math.floor((safe-whole)*60)%60;
    return`${DAYS[((day%7)+7)%7]} ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  }
  function publish(state,hoursAdvanced,message=''){
    const clock=normalizeClock(state),carry=clock.extraCarryMs,last=clock.lastRealAt,speed=clock.speed;
    state.updatedAt=Date.now();writeState(state);applying=true;
    window.dispatchEvent(new CustomEvent('atlas-game-loaded',{detail:clone(state)}));
    window.dispatchEvent(new CustomEvent('atlas-game-changed',{detail:state}));
    applying=false;
    state.clock=state.clock&&typeof state.clock==='object'?state.clock:{};state.clock.speed=speed;state.clock.lastRealAt=last;state.clock.extraCarryMs=carry;state.clock.authority='network-v2';state.updatedAt=Date.now();writeState(state);
    if(message)window.dispatchEvent(new CustomEvent('atlas-game-save-status',{detail:{message}}));
    window.dispatchEvent(new CustomEvent('atlas-network-time-advanced',{detail:{hours:hoursAdvanced,networkHours:continuousHours(state),speed}}));
  }
  function accrue(state,now=Date.now(),shouldPublish=true){
    if(!state?.orders)return 0;const clock=normalizeClock(state);
    if(state.paused){clock.lastRealAt=now;writeState(state);return 0}
    const delta=Math.max(0,now-clock.lastRealAt);clock.lastRealAt=now;clock.extraCarryMs+=delta*clock.speed;
    const rawHours=Math.floor(clock.extraCarryMs/REAL_MS_PER_GAME_HOUR),hours=Math.min(MAX_CATCHUP_HOURS,rawHours);
    if(hours){clock.extraCarryMs=rawHours>MAX_CATCHUP_HOURS?clock.extraCarryMs%REAL_MS_PER_GAME_HOUR:clock.extraCarryMs-hours*REAL_MS_PER_GAME_HOUR;simulateHours(state,hours);if(shouldPublish)publish(state,hours,`Network advanced ${hours} game hour${hours===1?'':'s'} · ${clock.speed}×`);else writeState(state)}else writeState(state);
    return hours;
  }
  function renderClock(){
    const state=readState();if(!state?.orders)return;const clock=normalizeClock(state),nowHours=continuousHours(state),day=document.querySelector('#day');if(day)day.textContent=formatHours(nowHours);
    let live=document.querySelector('#game-clock-live');if(!live){const host=document.querySelector('.clock');if(host){live=document.createElement('div');live.id='game-clock-live';live.innerHTML='<i></i><span></span>';host.append(live)}}
    if(live){const fraction=((nowHours-Math.floor(nowHours))%1+1)%1;live.querySelector('i').style.width=`${Math.round(fraction*100)}%`;live.querySelector('span').textContent=state.paused?'Paused':`${clock.speed}× · next hour in ${Math.max(0,Math.ceil((1-fraction)*15/clock.speed))} real min`;}
    document.querySelectorAll('[data-game-speed]').forEach(button=>button.classList.toggle('active',Number(button.dataset.gameSpeed)===clock.speed));
  }
  function setSpeed(speed){
    if(!SPEEDS.includes(speed))return;const state=readState();accrue(state,Date.now(),false);const clock=normalizeClock(state);clock.speed=speed;clock.lastRealAt=Date.now();state.updatedAt=Date.now();writeState(state);window.dispatchEvent(new CustomEvent('atlas-game-changed',{detail:state}));renderClock();
  }
  function installSpeedOverrides(){document.querySelectorAll('[data-game-speed]').forEach(button=>{button.onclick=()=>setSpeed(Number(button.dataset.gameSpeed))})}
  function tick(){const state=readState();if(!state?.orders)return;const hours=accrue(state,Date.now(),true);if(hours)lastPublishedHour=Number(state.totalHours||0);renderClock()}
  function onExternalState(event){if(applying)return;const state=event.detail;if(!state?.orders)return;normalizeClock(state);writeState(state);renderClock()}
  function start(){
    const state=readState();if(state?.orders){accrue(state,Date.now(),true);renderClock()}
    installSpeedOverrides();setTimeout(installSpeedOverrides,300);
    window.addEventListener('atlas-game-loaded',onExternalState);window.addEventListener('atlas-game-changed',onExternalState);
    window.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){const s=readState();accrue(s,Date.now(),true);renderClock()}else{const s=readState();if(s?.orders){accrue(s,Date.now(),false);writeState(s)}}});
    tickTimer=nativeSetInterval(tick,1000);uiTimer=nativeSetInterval(renderClock,500);
    window.addEventListener('pagehide',()=>{nativeClearInterval(tickTimer);nativeClearInterval(uiTimer);const s=readState();if(s?.orders){accrue(s,Date.now(),false);writeState(s)}},{once:true});
    window.dispatchEvent(new CustomEvent('atlas-time-authority-ready'));
  }

  window.atlasGameTime={
    realMsPerGameHour:REAL_MS_PER_GAME_HOUR,
    nowHours:()=>continuousHours(),
    format:formatHours,
    speed:()=>normalizeClock(readState()).speed,
    paused:()=>Boolean(readState().paused),
    accrue:()=>{const s=readState();return accrue(s,Date.now(),true)}
  };
  document.addEventListener('DOMContentLoaded',start,{once:true});
})();

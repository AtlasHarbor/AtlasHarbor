(()=>{
 const TARGET_MS=10000;
 const nativeRAF=window.requestAnimationFrame.bind(window);
 let active=false,ratio=1,actualAnchor=0,virtualAnchor=0,clockFrame=0,clockAnchor=0,replayMeta=null;
 window.__ATLAS_GAME_REPLAY_TARGET_MS__=TARGET_MS;
 const blocked=()=>document.documentElement.classList.contains('atlas-first-run-tour')||Boolean(document.querySelector('#intro:not([hidden])'));
 const ease=p=>p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
 const formatHour=value=>{
  if(window.atlasGameTime?.format)return window.atlasGameTime.format(value);
  const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],safe=Math.max(0,Number(value)||0),whole=Math.floor(safe),day=Math.floor(whole/24),hour=whole%24,minute=Math.floor((safe-whole)*60)%60;
  return`${days[day%7]} ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
 };
 function paintClock(detail){
  const label=document.querySelector('.clock > small:first-child'),day=document.querySelector('#day'),rule=document.querySelector('#game-clock-rule'),live=document.querySelector('#game-clock-live'),buttons=document.querySelectorAll('[data-game-speed]');
  if(detail.active){
   const percent=Math.round(detail.progress*100),from=formatHour(detail.startHour),to=formatHour(detail.targetHour),current=formatHour(detail.currentHour);
   if(label)label.textContent='CATCH-UP NETWORK TIME';
   if(day)day.textContent=current;
   if(rule)rule.textContent=`Catching up ${from} → ${to}`;
   if(live){const bar=live.querySelector('i'),copy=live.querySelector('span');if(bar)bar.style.width=`${percent}%`;if(copy)copy.textContent=`CATCHING UP · ${current} · ${percent}%`;}
   buttons.forEach(button=>{button.disabled=true;button.setAttribute('aria-disabled','true')});
   document.documentElement.classList.add('atlas-network-catching-up');
  }else{
   const state=(()=>{try{return structuredClone(window.__atlasGameState||JSON.parse(localStorage.getItem('atlas-game-state')||'{}'))}catch{return{}}})();
   const speed=window.atlasGameTime?.speed?.()||Number(state.clock?.speed)||1,paused=Boolean(state.paused),now=window.atlasGameTime?.nowHours?.()??Number(state.totalHours||detail.targetHour||8);
   if(label)label.textContent='NETWORK TIME';
   if(day)day.textContent=formatHour(now);
   if(rule)rule.textContent=`15 real min = 1 game hour · ${paused?'paused':speed+'×'}`;
   if(live){const fraction=((now-Math.floor(now))%1+1)%1,bar=live.querySelector('i'),copy=live.querySelector('span');if(bar)bar.style.width=`${Math.round(fraction*100)}%`;if(copy)copy.textContent=paused?'Paused':`${speed}× · next hour in ${Math.max(0,Math.ceil((1-fraction)*15/speed))} real min`;}
   buttons.forEach(button=>{button.disabled=false;button.removeAttribute('aria-disabled')});
   document.documentElement.classList.remove('atlas-network-catching-up');
  }
 }
 function emitClock(progress){
  if(!replayMeta)return;
  const p=Math.max(0,Math.min(1,progress)),currentHour=replayMeta.startHour+(replayMeta.targetHour-replayMeta.startHour)*ease(p),detail={active:p<1,startHour:replayMeta.startHour,targetHour:replayMeta.targetHour,currentHour,progress:p,duration:replayMeta.duration};
  paintClock(detail);
  window.dispatchEvent(new CustomEvent('atlas-game-replay-clock',{detail}));
 }
 function clockStep(timestamp){
  if(!active||!replayMeta)return;
  if(blocked()){clockAnchor=0;clockFrame=nativeRAF(clockStep);return}
  if(!clockAnchor)clockAnchor=timestamp;
  const progress=Math.min(1,(timestamp-clockAnchor)/Math.max(1,replayMeta.duration));
  emitClock(progress);
  if(progress<1)clockFrame=nativeRAF(clockStep);
 }
 window.requestAnimationFrame=function(callback){
  if(!active||callback?.name!=='replayStep')return nativeRAF(callback);
  return nativeRAF(timestamp=>{
   if(blocked()){
    setTimeout(()=>window.requestAnimationFrame(callback),80);
    return;
   }
   if(!actualAnchor){actualAnchor=timestamp;virtualAnchor=timestamp}
   const accelerated=virtualAnchor+(timestamp-actualAnchor)*ratio;
   callback(accelerated);
  });
 };
 window.addEventListener('atlas-global-replay-start',event=>{
  const original=Math.max(0,Number(event.detail?.duration)||0),duration=original>TARGET_MS?TARGET_MS:Math.max(1,original);
  actualAnchor=0;virtualAnchor=0;clockAnchor=0;
  ratio=original>TARGET_MS?original/TARGET_MS:1;
  active=true;
  event.detail.duration=duration;
  replayMeta={startHour:Number(event.detail?.startHour)||0,targetHour:Number(event.detail?.targetHour)||0,duration};
  if(clockFrame)cancelAnimationFrame(clockFrame);
  emitClock(0);
  clockFrame=nativeRAF(clockStep);
 },true);
 window.addEventListener('atlas-global-replay-complete',()=>{
  if(replayMeta)emitClock(1);
  active=false;ratio=1;actualAnchor=0;virtualAnchor=0;clockAnchor=0;replayMeta=null;
  if(clockFrame)cancelAnimationFrame(clockFrame);clockFrame=0;
 },true);
 window.addEventListener('pagehide',()=>{active=false;replayMeta=null;if(clockFrame)cancelAnimationFrame(clockFrame);clockFrame=0;document.documentElement.classList.remove('atlas-network-catching-up')},{once:true});
})();

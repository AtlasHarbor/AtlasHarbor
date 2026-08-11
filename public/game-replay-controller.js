(()=>{
 const TARGET_MS=10000;
 const nativeRAF=window.requestAnimationFrame.bind(window);
 let active=false,ratio=1,actualAnchor=0,virtualAnchor=0,clockFrame=0,clockAnchor=0,replayMeta=null;
 window.__ATLAS_GAME_REPLAY_TARGET_MS__=TARGET_MS;
 const blocked=()=>document.documentElement.classList.contains('atlas-first-run-tour')||Boolean(document.querySelector('#intro:not([hidden])'));
 const ease=p=>p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
 function emitClock(progress){
  if(!replayMeta)return;
  const p=Math.max(0,Math.min(1,progress)),currentHour=replayMeta.startHour+(replayMeta.targetHour-replayMeta.startHour)*ease(p);
  window.dispatchEvent(new CustomEvent('atlas-game-replay-clock',{detail:{active:p<1,startHour:replayMeta.startHour,targetHour:replayMeta.targetHour,currentHour,progress:p,duration:replayMeta.duration}}));
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
 window.addEventListener('pagehide',()=>{active=false;replayMeta=null;if(clockFrame)cancelAnimationFrame(clockFrame);clockFrame=0},{once:true});
})();

(()=>{
 const TARGET_MS=10000;
 const nativeRAF=window.requestAnimationFrame.bind(window);
 let active=false,ratio=1,actualAnchor=0,virtualAnchor=0;
 window.__ATLAS_GAME_REPLAY_TARGET_MS__=TARGET_MS;
 window.requestAnimationFrame=function(callback){
  if(!active||callback?.name!=='replayStep')return nativeRAF(callback);
  return nativeRAF(timestamp=>{
   if(!actualAnchor){actualAnchor=timestamp;virtualAnchor=timestamp}
   const accelerated=virtualAnchor+(timestamp-actualAnchor)*ratio;
   callback(accelerated);
  });
 };
 window.addEventListener('atlas-global-replay-start',event=>{
  const original=Math.max(0,Number(event.detail?.duration)||0);
  actualAnchor=0;virtualAnchor=0;
  if(original>TARGET_MS){ratio=original/TARGET_MS;active=true;event.detail.duration=TARGET_MS}
  else{ratio=1;active=false}
 },true);
 window.addEventListener('atlas-global-replay-complete',()=>{active=false;ratio=1;actualAnchor=0;virtualAnchor=0},true);
})();

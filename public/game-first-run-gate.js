(()=>{
 const GAME_KEY='atlas-game-state';
 const TOUR_VERSION=3;
 const root=document.documentElement;
 const intro=()=>document.querySelector('#intro');
 const read=()=>{try{return JSON.parse(localStorage.getItem(GAME_KEY)||'{}')}catch{return{}}};
 const write=state=>{try{localStorage.setItem(GAME_KEY,JSON.stringify(state));window.__atlasGameState=structuredClone(state)}catch{}};
 const unseen=state=>Boolean(state?.orders)&&Number(state?.onboarding?.dashboardTourVersion||0)<TOUR_VERSION;
 function holdIncident(){
  const state=read();
  if(!unseen(state))return false;
  root.classList.add('atlas-first-run-tour');
  const node=intro();if(node)node.hidden=true;
  return true;
 }
 function releaseIncident(state=read()){
  if(Number(state?.onboarding?.dashboardTourVersion||0)<TOUR_VERSION||state?.onboardingComplete)return;
  root.classList.remove('atlas-first-run-tour');
  const node=intro();
  if(node){node.hidden=false;node.scrollTop=0;node.querySelector('.intro-card')?.scrollTo?.({top:0,behavior:'auto'});}
 }
 function suppressLegacyTour(event){
  const button=event.target.closest?.('#take-command');
  if(!button)return;
  const state=read();
  if(!state?.orders)return;
  state.tutorialDone=true;
  state.onboardingComplete=true;
  state.onboarding={...(state.onboarding||{}),dashboardTourVersion:TOUR_VERSION,dashboardTourSeenAt:state.onboarding?.dashboardTourSeenAt||Date.now(),incidentBriefSeenAt:Date.now()};
  state.updatedAt=Date.now();
  write(state);
 }
 function loadModule(src,key){
  if(document.querySelector(`script[data-${key}]`))return;
  const script=document.createElement('script');script.type='module';script.src=src;script.dataset[key]='true';document.body.append(script);
 }
 function loadRuntimePolish(){loadModule('/game-runtime-polish.js','gameRuntimePolish')}
 function loadCommandExperience(){loadModule('/game-command-loop-v2.js','gameCommandLoopV2');loadModule('/game-entity-interactions-v2.js','gameEntityInteractionsV2');loadModule('/game-career-loop-v2.js','gameCareerLoopV2')}
 document.addEventListener('click',suppressLegacyTour,true);
 holdIncident();
 window.addEventListener('atlas-game-changed',event=>{
  const state=event.detail||read();
  if(unseen(state)){root.classList.add('atlas-first-run-tour');const node=intro();if(node)node.hidden=true;return;}
  releaseIncident(state);
 });
 window.addEventListener('atlas-game-loaded',event=>{
  const state=event.detail||read();
  if(unseen(state)){root.classList.add('atlas-first-run-tour');const node=intro();if(node)node.hidden=true;return;}
  releaseIncident(state);
 });
 loadRuntimePolish();
 loadCommandExperience();
})();
(()=>{
 const GAME_KEY='atlas-game-state';
 const TOUR_VERSION=3;
 const root=document.documentElement;
 const intro=()=>document.querySelector('#intro');
 const read=()=>{try{return JSON.parse(localStorage.getItem(GAME_KEY)||'{}')}catch{return{}}};
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
})();

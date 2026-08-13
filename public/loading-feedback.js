import'./brand-normalizer.js';
const propPath=location.pathname.replace(/\/$/,'');
const propManualMode=propPath==='/prop'&&new URLSearchParams(location.search).get('manual')==='1';
if(propPath==='/prop/new'){
 location.replace('/prop?manual=1');
}else if(propManualMode){
 let attempts=0;
 const isolateManual=()=>{
  attempts++;
  const block=document.querySelector('#manual-space-block'),root=document.querySelector('#prop-root');
  if(block&&root){
   const back=document.createElement('p');back.className='gtm-back';back.innerHTML='<a href="/prop">← All propositions</a>';
   root.replaceChildren(back,block);
   document.title='Create Space Block · Propositions · Atlas Harbor';
   history.replaceState(history.state,'','/prop/new');
   block.scrollIntoView({block:'start'});
   return;
  }
  if(attempts<60)setTimeout(isolateManual,100);
 };
 setTimeout(isolateManual,0);
}else if(propPath==='/prop'){
 [180,420,850,1500,2400].forEach(delay=>setTimeout(()=>document.querySelector('#manual-space-block')?.remove(),delay));
}
const STYLE_ID='atlas-loading-feedback-style',OVERLAY_ID='atlas-loading-feedback';
if(!document.getElementById(STYLE_ID)){const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`#${OVERLAY_ID}{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;background:#102d2778;backdrop-filter:blur(2px);opacity:0;pointer-events:none;transition:opacity .12s ease}#${OVERLAY_ID}.visible{opacity:1;pointer-events:auto}.atlas-loading-card{display:grid;justify-items:center;gap:12px;min-width:210px;padding:24px 28px;border-radius:18px;background:#fffdf7;color:#173b32;box-shadow:0 22px 70px #102d2755;font:700 13px system-ui}.atlas-loading-spinner{width:34px;height:34px;border:4px solid #d7ddd5;border-top-color:#ef6b3a;border-radius:50%;animation:atlas-spin .75s linear infinite}.atlas-loading-card span{max-width:300px;text-align:center}.atlas-loading-card small{color:#667970;font-weight:600;letter-spacing:.06em;text-transform:uppercase}@keyframes atlas-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.atlas-loading-spinner{animation-duration:1.8s}}`;document.head.append(style)}
let overlay=document.getElementById(OVERLAY_ID);if(!overlay){overlay=document.createElement('div');overlay.id=OVERLAY_ID;overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');overlay.innerHTML='<div class="atlas-loading-card"><div class="atlas-loading-spinner" aria-hidden="true"></div><span>Loading…</span><small>Atlas Harbor ops</small></div>';document.body.append(overlay)}
const OPS=['Cross-docking…','Re-slotting the warehouse…','Finding the missing pallet…','Calling the carrier rep…','Checking the BOL…','Hunting for capacity…','Sweating the cutoff time…','Chasing the drayage truck…','Reworking the load plan…','Clearing the dock door…','Counting pallets twice…','Making the ETA less fictional…','Finding a truck with actual hours…','Negotiating with the freight gods…','Trying not to expedite it…','Protecting the customer promise…','Turning chaos into a lane plan…','Checking whether “on time” is still possible…','Convincing the container to cooperate…','Refreshing the control tower…'];
const GAME=['Dispatching somebody competent…','Moving freight, not excuses…','Re-routing around bad decisions…','Calling Maya before the customer does…','Protecting the launch window…','Finding margin in the mess…','Escalating only the fun problems…','Making the network behave…','Letting routine freight run itself…','Checking who broke the truck this time…',...OPS];
const BASEBALL=['Pulling the matchup card…','Checking the probable starter…','Warming up the data bullpen…','Finding the lineup card…','Reading the scouting report…'];
const LEGAL=['Pulling the docket…','Finding the controlling filing…','Checking what the court actually said…','Sorting facts from argument…','Reading the footnotes nobody else did…'];
const BUSINESS=['Building the decision case…','Checking the evidence…','Pressure-testing the pitch…','Finding the decision-maker…','Separating signal from slideware…'];
const pick=list=>list[Math.floor(Math.random()*list.length)];
function poolFor(path=location.pathname){if(/^\/game(?:\/|$)/.test(path))return GAME;if(/^\/logistics(?:\/|$)/.test(path))return OPS;if(/^\/baseball(?:\/|$)/.test(path))return BASEBALL;if(/^\/legal(?:\/|$)/.test(path))return LEGAL;if(/^\/(?:prop|leads)(?:\/|$)/.test(path))return BUSINESS;return OPS}
function navigationCopy(link){try{return pick(poolFor(new URL(link.href,location.href).pathname))}catch{return pick(poolFor())}}
let navigationActive=false,requestCount=0,showTimer=null,rotationTimer=null;const message=()=>overlay.querySelector('span');
function stopRotation(){if(rotationTimer){clearInterval(rotationTimer);rotationTimer=null}}
function show(text='Loading…',{delay=0,rotate=null}={}){clearTimeout(showTimer);stopRotation();const reveal=()=>{message().textContent=text;overlay.classList.add('visible');overlay.setAttribute('aria-busy','true');if(Array.isArray(rotate)&&rotate.length>1)rotationTimer=setInterval(()=>{message().textContent=pick(rotate)},1450)};if(delay>0&&!overlay.classList.contains('visible'))showTimer=setTimeout(reveal,delay);else reveal()}
function hide(){if(navigationActive||requestCount>0)return;clearTimeout(showTimer);stopRotation();overlay.classList.remove('visible');overlay.removeAttribute('aria-busy')}
function beginRequest(text=null){requestCount++;const pool=poolFor(),copy=text||pick(pool);show(copy,{delay:220,rotate:pool});let ended=false;return()=>{if(ended)return;ended=true;requestCount=Math.max(0,requestCount-1);hide()}}
window.atlasLoading={show:(text='Loading…')=>show(text),hide:()=>{navigationActive=false;requestCount=0;hide()},begin:beginRequest,random:()=>pick(poolFor())};
const originalFetch=window.fetch.bind(window);window.__atlasNativeFetch=window.__atlasNativeFetch||originalFetch;window.fetch=async function(input,init){let url;try{url=new URL(typeof input==='string'||input instanceof URL?input:input.url,location.href)}catch{return originalFetch(input,init)}const sameOrigin=url.origin===location.origin,skip=/\/api\/(?:status|config|baseball\/search)(?:\?|$)/.test(url.pathname+url.search),method=String(init?.method||(typeof input==='object'&&input?.method)||'GET').toUpperCase();const shouldTrack=sameOrigin&&!skip&&(method!=='GET'||/\/api\/(?:legal|baseball\/(?:games|teams|players)\/|workspaces|published-feed|prop|leads|logistics|game|public-research)/.test(url.pathname));const end=shouldTrack?beginRequest(method==='GET'?null:'Saving the paperwork…'):null;try{return await originalFetch(input,init)}finally{end?.()}};
function internalNavigation(link){if(!link||link.target==='_blank'||link.hasAttribute('download'))return false;const href=link.getAttribute('href')||'';if(!href||href.startsWith('#')||href.startsWith('javascript:')||href.startsWith('mailto:')||href.startsWith('tel:'))return false;let target;try{target=new URL(link.href,location.href)}catch{return false}return target.origin===location.origin&&target.href!==location.href}
document.addEventListener('click',event=>{if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const link=event.target.closest?.('a[href]');if(!internalNavigation(link))return;navigationActive=true;const pool=poolFor(new URL(link.href,location.href).pathname);show(navigationCopy(link),{rotate:pool})},true);
document.addEventListener('click',event=>{const game=event.target.closest?.('[data-game-id],[data-type="game"][data-id]');if(!game)return;navigationActive=true;show(pick(BASEBALL),{rotate:BASEBALL})},true);
window.addEventListener('pageshow',()=>{navigationActive=false;requestCount=0;hide()});
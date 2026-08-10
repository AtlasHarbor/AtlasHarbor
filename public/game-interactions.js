const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const MOBILE='(max-width: 780px)';
let statusTimer=null,revealTimer=null;

function ensureStatus(){
 let node=$('#game-interaction-status');
 if(node)return node;
 node=document.createElement('div');
 node.id='game-interaction-status';
 node.className='game-interaction-status';
 node.setAttribute('role','status');
 node.setAttribute('aria-live','polite');
 node.setAttribute('aria-atomic','true');
 node.hidden=true;
 document.body.append(node);
 return node;
}
function acknowledge(text){
 const node=ensureStatus();
 clearTimeout(statusTimer);
 node.textContent=text;
 node.hidden=false;
 requestAnimationFrame(()=>node.classList.add('show'));
 statusTimer=setTimeout(()=>{node.classList.remove('show');setTimeout(()=>{node.hidden=true},180)},1500);
}
function pulse(element){
 if(!element)return;
 element.classList.remove('game-action-ack');
 void element.offsetWidth;
 element.classList.add('game-action-ack');
 setTimeout(()=>element.classList.remove('game-action-ack'),420);
}
function clearSelectedOrders(){
 $$('.order-card.selected').forEach(item=>{item.classList.remove('selected');item.removeAttribute('aria-current')});
}
function markSelectedOrder(card){
 clearSelectedOrders();
 card.classList.add('selected');
 card.setAttribute('aria-current','true');
}
function visible(element){return Boolean(element&&!element.hidden&&element.getClientRects().length)}
function revealContractDetails(card){
 clearTimeout(revealTimer);
 markSelectedOrder(card);
 const order=card.dataset.order||'contract';
 acknowledge(`Opening ${order} details and actions…`);
 let tries=0;
 const reveal=()=>{
  const action=$('#map-action-card'),decision=$('#decision-card');
  const target=visible(decision)?decision:visible(action)?action:null;
  if(!target&&tries++<8){revealTimer=setTimeout(reveal,35);return}
  if(!target){acknowledge('Contract selected. Use the map detail panel to continue.');return}
  target.classList.remove('interaction-reveal');
  void target.offsetWidth;
  target.classList.add('interaction-reveal');
  target.setAttribute('tabindex','-1');
  if(matchMedia(MOBILE).matches){
   target.dataset.mobileSheet='true';
   setTimeout(()=>target.focus({preventScroll:true}),80);
  }else{
   $('#map-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
   setTimeout(()=>target.focus({preventScroll:true}),340);
  }
 };
 requestAnimationFrame(()=>setTimeout(reveal,0));
}
function feedbackFor(button){
 if(button.id==='generate-issue')return'Opening an optional disruption drill…';
 if(button.id==='advance')return'Advancing to the next decision…';
 if(button.id==='pause')return'Updating simulation state…';
 if(button.id==='open-team'||button.matches('[data-open-control]'))return'Opening company controls…';
 if(button.id==='fit-map')return'Fitting the global network…';
 if(button.id==='show-all')return'Opening the global control tower…';
 if(button.matches('[data-alert]'))return'Opening the exception decision…';
 if(button.matches('[data-action]'))return`Reviewing ${button.textContent.trim().toLowerCase()}…`;
 if(button.matches('[data-confirm-review],#confirm-action'))return'Applying the confirmed decision…';
 if(button.matches('[data-procure],[data-contract],[data-request-hire],[data-hire-driver]'))return'Opening cost and commitment review…';
 return'';
}
function decorateStaticControls(){
 const disruption=$('#generate-issue');
 if(disruption){
  disruption.textContent='Run scenario drill';
  disruption.title='Optional: inject a simulated disruption to practice exception management.';
  disruption.setAttribute('aria-label','Run optional disruption drill');
 }
 $$('.order-card').forEach(card=>{
  card.setAttribute('role','button');
  card.tabIndex=0;
  if(!card.getAttribute('aria-label'))card.setAttribute('aria-label',`Open ${card.dataset.order||'contract'} details and actions`);
 });
 $$('.fleet-card').forEach(card=>{
  card.setAttribute('role','button');
  card.tabIndex=0;
 });
}

document.addEventListener('pointerdown',event=>{
 const target=event.target.closest('button,.order-card,.fleet-card');
 if(target&&!target.matches(':disabled'))target.classList.add('game-pressed');
},{capture:true,passive:true});
for(const name of['pointerup','pointercancel'])document.addEventListener(name,event=>event.target.closest?.('button,.order-card,.fleet-card')?.classList.remove('game-pressed'),{capture:true,passive:true});

document.addEventListener('click',event=>{
 const orderCard=event.target.closest('.order-card[data-order]');
 if(orderCard){pulse(orderCard);revealContractDetails(orderCard);return}
 const fleet=event.target.closest('.fleet-card[data-move]');
 if(fleet){clearSelectedOrders();pulse(fleet);acknowledge('Opening movement details…');return}
 const button=event.target.closest('button');
 if(!button||button.disabled)return;
 pulse(button);
 if(button.matches('.map-action-close')){
  clearSelectedOrders();
  acknowledge('Contract details closed.');
  return;
 }
 const text=feedbackFor(button);
 if(text)acknowledge(text);
},{capture:false});

document.addEventListener('keydown',event=>{
 if(event.key!=='Enter'&&event.key!==' ')return;
 const card=event.target.closest('.order-card[data-order],.fleet-card[data-move]');
 if(!card)return;
 event.preventDefault();
 card.click();
});

window.addEventListener('atlas-game-changed',()=>setTimeout(decorateStaticControls,0));
window.addEventListener('atlas-game-loaded',()=>setTimeout(decorateStaticControls,0));
window.addEventListener('DOMContentLoaded',()=>{decorateStaticControls();setTimeout(decorateStaticControls,120)});

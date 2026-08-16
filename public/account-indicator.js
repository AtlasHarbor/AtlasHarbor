import'./problem-nav.js';
import'./workspace-enhancements.js';
import'./publishing-links.js';
import'./baseball-profile-enhancements.js';
import{user,configurationStatus}from'./supabase-client.js';

const style=document.createElement('style');
style.textContent=`.atlas-account-indicator{position:fixed;right:16px;bottom:16px;z-index:1000;display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:999px;background:#fffdf7;border:1px solid #d8d2c4;box-shadow:0 8px 25px #173b3230;color:#173b32;text-decoration:none;font:700 11px system-ui}.atlas-account-dot{width:9px;height:9px;border-radius:50%;background:#c95a4c}.atlas-account-indicator.ok .atlas-account-dot{background:#64a35d}.atlas-account-indicator.warn .atlas-account-dot{background:#e3a33d}.atlas-player-workspace-jump{position:fixed;left:16px;bottom:16px;z-index:1000;display:grid;place-items:center;width:52px;height:52px;padding:0;border:1px solid #173b32;border-radius:50%;background:#173b32;color:#fff;box-shadow:0 10px 28px #173b3240;cursor:pointer}.atlas-player-workspace-jump:hover{background:#245347;transform:translateY(-2px)}.atlas-player-workspace-jump:focus-visible{outline:3px solid #ef8a57;outline-offset:3px}.atlas-player-workspace-jump-arrow{font:800 28px/1 system-ui;transform:translateY(-1px)}.atlas-player-workspace-jump-label{position:absolute;left:62px;padding:7px 10px;border-radius:999px;background:#173b32;color:#fff;white-space:nowrap;font:700 11px system-ui;opacity:0;pointer-events:none;transform:translateX(-4px);transition:.16s}.atlas-player-workspace-jump:hover .atlas-player-workspace-jump-label,.atlas-player-workspace-jump:focus-visible .atlas-player-workspace-jump-label{opacity:1;transform:none}@media(max-width:620px){.atlas-player-workspace-jump{left:12px;bottom:12px;width:48px;height:48px}.atlas-player-workspace-jump-label{display:none}}`;
document.head.append(style);

const guidance='Write what you think will happen, why, and what evidence would change your view.';
function fixGuidance(root=document){
 root.querySelectorAll?.('textarea').forEach(el=>{
  if(el.value.trim()===guidance){el.value='';el.placeholder=guidance}
  else if(!el.placeholder&&/what you think will happen/i.test(el.getAttribute('aria-label')||''))el.placeholder=guidance;
 });
}
fixGuidance();
window.addEventListener('atlas-workspace-loaded',event=>{
 const host=event.detail?.host;
 queueMicrotask(()=>fixGuidance(host||document));
});

const link=document.createElement('a');
link.className='atlas-account-indicator';
link.href='/account';
link.innerHTML='<span class="atlas-account-dot"></span><span>Checking account…</span>';
document.body.append(link);

let baseballWorkspacePromise=null;
const baseballWorkspaceController=new AbortController();
window.addEventListener('pagehide',()=>baseballWorkspaceController.abort(),{once:true});

async function baseballJson(url){const response=await fetch(url,{headers:{Accept:'application/json'},signal:baseballWorkspaceController.signal});if(!response.ok)throw new Error(`Baseball data request failed (${response.status}).`);return response.json()}
function installPlayerWorkspaceJump(host){
 if(!host||document.querySelector('.atlas-player-workspace-jump'))return;
 const button=document.createElement('button');
 button.type='button';button.className='atlas-player-workspace-jump';button.setAttribute('aria-controls','baseball-workspace');button.setAttribute('aria-label','Jump to player analysis');button.title='Jump to player analysis';
 button.innerHTML='<span class="atlas-player-workspace-jump-arrow" aria-hidden="true">↓</span><span class="atlas-player-workspace-jump-label" aria-hidden="true">Write player analysis</span>';
 button.addEventListener('click',()=>{
  const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  host.scrollIntoView({behavior:reduced?'auto':'smooth',block:'start'});
  setTimeout(()=>host.querySelector('#ws-editor,#ws-retry-db,a[href="/account"]')?.focus({preventScroll:true}),reduced?0:500);
 });
 document.body.append(button);
}
async function mountBaseballWorkspace(){
 if(baseballWorkspacePromise)return baseballWorkspacePromise;
 baseballWorkspacePromise=(async()=>{
  const game=location.pathname.match(/^\/baseball\/games\/(\d+)/),player=location.pathname.match(/^\/baseball\/players\/(\d+)/),team=location.pathname.match(/^\/baseball\/teams\/(\d+)/);
  if(!game&&!player&&!team)return;
  await import('./baseball-stat-help.js').catch(()=>null);
  if(!document.querySelector('link[data-baseball-workspace-css]')){const css=document.createElement('link');css.rel='stylesheet';css.href='/workspace.css';css.dataset.baseballWorkspaceCss='true';document.head.append(css)}
  let host=document.querySelector('#baseball-workspace');if(!host){host=document.createElement('div');host.id='baseball-workspace';document.querySelector('article')?.append(host)}
  if(player)installPlayerWorkspaceJump(host);
  if(!host||host.dataset.mounting==='true'||host.dataset.mounted==='true')return;
  host.dataset.mounting='true';
  try{
   const {mountWorkspace}=await import('./workspace.js');
   if(game){
    const data=await baseballJson(`/api/baseball/games/${game[1]}`);
    if(baseballWorkspaceController.signal.aborted)return;
    await mountWorkspace(host,{type:'baseball_game',id:game[1],title:data.game?.name||document.querySelector('h1')?.textContent||'Baseball game',context:data.game});
   }else if(player){
    let data;
    try{data=await baseballJson(`/api/baseball/prospect-players/${player[1]}`)}catch(error){if(error.name==='AbortError')throw error;data=await baseballJson(`/api/baseball/players/${player[1]}`)}
    if(baseballWorkspaceController.signal.aborted)return;
    await mountWorkspace(host,{type:'baseball_player',id:player[1],title:data.player?.name||document.querySelector('h1')?.textContent||'Baseball player',context:data.player});
   }else{
    const data=await baseballJson(`/api/baseball/teams/${team[1]}`);
    if(baseballWorkspaceController.signal.aborted)return;
    await mountWorkspace(host,{type:'baseball_team',id:team[1],title:data.team?.name||document.querySelector('h1')?.textContent||'Baseball team',context:data.team});
   }
   host.dataset.mounted='true';
   fixGuidance(host);
  }catch(e){if(e.name!=='AbortError')host.innerHTML=`<section class="workspace"><p>Publishing workspace unavailable: ${e.message}</p></section>`}finally{delete host.dataset.mounting}
 })();
 return baseballWorkspacePromise;
}

if(location.pathname.startsWith('/baseball/'))mountBaseballWorkspace();
if(location.pathname.startsWith('/dropshipping'))import('./dropshipping-category-patch.js');

const status=await configurationStatus(),current=user();
if(!status.ok){link.classList.add('warn');link.querySelector('span:last-child').textContent='Setup needed';link.title=status.error||'Open Account for setup help'}
else if(current){link.classList.add('ok');link.querySelector('span:last-child').textContent='Logged in';link.title='Open account settings'}
else{link.classList.add('ok');link.querySelector('span:last-child').textContent='Sign in';link.title='Open account'}

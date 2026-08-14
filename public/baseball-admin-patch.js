import{accessToken,refreshSession}from'./supabase-client.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let pollTimer=0,controller=null;
const password=()=>sessionStorage.getItem('atlas-admin-password')||'';
async function adminFetch(url,options={}){
 let token=accessToken();
 const run=()=>fetch(url,{...options,headers:{Accept:'application/json','x-admin-password':password(),...(options.headers||{}),Authorization:`Bearer ${token||''}`}});
 let response=await run();
 if(response.status===401&&token){try{await refreshSession();token=accessToken();response=await run()}catch{}}
 return response;
}
async function json(response){const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||`Request failed (${response.status}).`);return data}
function normalizeJob(job){if(!job)return null;return{id:job.id,scope:job.scope,status:job.status,total:Number(job.totalPlayers??job.total_players??0),completed:Number(job.completedPlayers??job.completed_players??0),failed:Number(job.failedPlayers??job.failed_players??0),currentName:job.currentPlayerName??job.current_player_name??'',currentId:job.currentPlayerId??job.current_player_id??null,errors:job.errors||[],startedAt:job.startedAt??job.started_at??null,completedAt:job.completedAt??job.completed_at??null}}
function install(){
 const grid=document.querySelector('#dashboard .admin-grid');if(!grid||document.querySelector('#baseball-player-db-admin'))return false;
 const section=document.createElement('section');section.className='request-card';section.id='baseball-player-db-admin';
 section.innerHTML=`<div class="card-heading"><div><h2>Baseball player database</h2><p>Persist the same normalized MLB/Minor League player records used on Atlas Harbor profiles. Bulk refreshes run incrementally in the background and save after every player.</p></div><button type="button" class="secondary" data-bb-status>Refresh status</button></div><div data-bb-db-status>Loading database status…</div><div class="actions" data-bb-runs><button type="button" data-bb-run="mlb">Refresh MLB</button><button type="button" data-bb-run="aaa">Refresh Triple-A</button><button type="button" data-bb-run="aa">Refresh Double-A</button><button type="button" data-bb-run="higha">Refresh High-A</button><button type="button" data-bb-run="lowa">Refresh Low-A</button><button type="button" data-bb-run="all">Refresh all levels</button></div><div data-bb-job><p>No refresh job loaded.</p></div><div class="actions"><button type="button" class="secondary" data-bb-export>Export stored player JSON</button><button type="button" class="secondary" data-bb-cancel hidden>Cancel active refresh</button></div><hr><h3>Recent-form fantasy preview</h3><p>This first model ranks the most recent eight games with recency weighting and a smaller season baseline. It is transparent and intentionally not tied to one fantasy platform's scoring rules.</p><div class="two"><label>Level<select data-bb-fantasy-sport><option value="1">MLB</option><option value="11">Triple-A</option><option value="12">Double-A</option><option value="13">High-A</option><option value="14">Low-A</option></select></label><label>Optional team ID<input data-bb-fantasy-team inputmode="numeric" placeholder="e.g. 119"></label></div><div class="actions"><button type="button" data-bb-fantasy>Build ideal lineup</button></div><pre class="run-result" data-bb-fantasy-result hidden></pre>`;
 grid.append(section);
 section.querySelector('[data-bb-status]').onclick=loadStatus;
 section.querySelectorAll('[data-bb-run]').forEach(button=>button.onclick=()=>startRefresh(button.dataset.bbRun));
 section.querySelector('[data-bb-export]').onclick=exportAll;
 section.querySelector('[data-bb-cancel]').onclick=cancelActive;
 section.querySelector('[data-bb-fantasy]').onclick=previewFantasy;
 return true;
}
function databaseCopy(database={}){
 if(!database.configured)return'<p class="admin-error">Supabase server persistence is not configured.</p>';
 if(!database.ready)return`<p class="admin-error"><b>Database schema required.</b> Apply <code>supabase/baseball-player-database.sql</code> once, then refresh this status. ${esc(database.error||'')}</p>`;
 const by=database.bySport||{};
 return`<p><b>${Number(database.total||0).toLocaleString()} stored players</b> · MLB ${Number(by[1]||0).toLocaleString()} · AAA ${Number(by[11]||0).toLocaleString()} · AA ${Number(by[12]||0).toLocaleString()} · High-A ${Number(by[13]||0).toLocaleString()} · Low-A ${Number(by[14]||0).toLocaleString()}</p>`;
}
function renderJob(raw){
 const host=document.querySelector('[data-bb-job]'),cancel=document.querySelector('[data-bb-cancel]'),job=normalizeJob(raw);if(!host)return;
 if(!job){host.innerHTML='<p>No Baseball refresh is currently running.</p>';cancel.hidden=true;return}
 const done=job.completed+job.failed,percent=job.total?Math.round(done/job.total*100):0,running=['queued','discovering','running'].includes(job.status);
 host.innerHTML=`<article class="research-history-item"><div><span class="status ${job.status==='completed'?'approved':''}">${esc(job.status)}</span><b>${esc(job.scope)} refresh</b><small>${job.startedAt?new Date(job.startedAt).toLocaleString():'Queued'}</small></div><p><b>${done.toLocaleString()} / ${job.total.toLocaleString()}</b> processed · ${job.completed.toLocaleString()} saved · ${job.failed.toLocaleString()} failed · ${percent}%</p><progress max="100" value="${percent}" style="width:100%"></progress>${job.currentName?`<p>Current: <b>${esc(job.currentName)}</b>${job.currentId?` · ${esc(job.currentId)}`:''}</p>`:''}${job.errors?.length?`<details><summary>${job.errors.length} recent error${job.errors.length===1?'':'s'}</summary><pre>${esc(JSON.stringify(job.errors.slice(-10),null,2))}</pre></details>`:''}</article>`;
 cancel.hidden=!running;cancel.dataset.jobId=running?job.id:'';
 if(running)schedulePoll();
}
async function loadStatus(){
 clearTimeout(pollTimer);
 const db=document.querySelector('[data-bb-db-status]');if(!db)return;
 try{const data=await json(await adminFetch('/api/admin/baseball/status',{cache:'no-store'}));db.innerHTML=databaseCopy(data.database);renderJob(data.activeJob||data.recentJobs?.[0]||null)}catch(error){db.innerHTML=`<p class="admin-error">${esc(error.message)}</p>`}
}
function schedulePoll(){clearTimeout(pollTimer);pollTimer=setTimeout(loadStatus,2500)}
async function startRefresh(scope){
 const buttons=[...document.querySelectorAll('[data-bb-run]')];buttons.forEach(button=>button.disabled=true);
 const host=document.querySelector('[data-bb-job]');host.innerHTML='<p>Starting incremental refresh…</p>';
 try{const data=await json(await adminFetch('/api/admin/baseball/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scope})}));renderJob(data.job);schedulePoll()}catch(error){host.innerHTML=`<p class="admin-error">${esc(error.message)}</p>`}finally{buttons.forEach(button=>button.disabled=false)}
}
async function cancelActive(){const button=document.querySelector('[data-bb-cancel]'),id=button?.dataset.jobId;if(!id)return;button.disabled=true;try{const data=await json(await adminFetch(`/api/admin/baseball/jobs/${encodeURIComponent(id)}/cancel`,{method:'POST'}));renderJob(data.job)}catch(error){alert(error.message)}finally{button.disabled=false}}
async function exportAll(){
 const button=document.querySelector('[data-bb-export]');button.disabled=true;button.textContent='Preparing JSON…';
 try{const response=await adminFetch('/api/admin/baseball/export',{cache:'no-store'});if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||`Export failed (${response.status}).`)}const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a'),disposition=response.headers.get('content-disposition')||'';link.href=url;link.download=disposition.match(/filename="([^"]+)"/)?.[1]||'atlas-baseball-player-database.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);button.textContent='Exported'}catch(error){button.textContent='Export failed';alert(error.message)}finally{setTimeout(()=>{button.textContent='Export stored player JSON';button.disabled=false},1200)}}
async function previewFantasy(){
 const sport=document.querySelector('[data-bb-fantasy-sport]').value,team=document.querySelector('[data-bb-fantasy-team]').value.trim(),out=document.querySelector('[data-bb-fantasy-result]'),button=document.querySelector('[data-bb-fantasy]');button.disabled=true;out.hidden=false;out.textContent='Building recent-form lineup…';
 try{const qs=new URLSearchParams({sportId:sport,games:'8'});if(team)qs.set('teamId',team);const data=await json(await adminFetch(`/api/admin/baseball/fantasy/lineup?${qs}`,{cache:'no-store'}));out.textContent=JSON.stringify(data,null,2)}catch(error){out.textContent=error.message}finally{button.disabled=false}
}
let attempts=0;const boot=()=>{attempts++;if(install()){const dashboard=document.querySelector('#dashboard');const wait=()=>{if(!dashboard.hidden&&password())loadStatus();else setTimeout(wait,500)};wait();return}if(attempts<60)setTimeout(boot,100)};boot();
window.addEventListener('pagehide',()=>{clearTimeout(pollTimer);controller?.abort?.()},{once:true});

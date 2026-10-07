import {accessToken,signIn,signOut} from './supabase-client.js';

const q=s=>document.querySelector(s);
let data=null;

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function api(url,options={}){
 const headers={...(options.headers||{})},token=accessToken();
 if(token)headers.Authorization=`Bearer ${token}`;
 const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options,headers});
 const body=await response.json().catch(()=>({}));
 if(!response.ok){const error=new Error(body.error||`Request failed (${response.status}).`);error.status=response.status;throw error}
 return body;
}
function showAuth(message=''){
 q('[data-dashboard]').hidden=true;
 q('[data-auth-card]').hidden=false;
 q('[data-auth-status]').textContent=message;
}
function filtered(){
 const app=q('[data-app-filter]').value,term=q('[data-search]').value.trim().toLowerCase();
 return (data?.signups||[]).filter(row=>(!app||row.app_slug===app)&&(!term||[row.name,row.email,row.app_name,row.ip,row.region].some(v=>String(v||'').toLowerCase().includes(term))));
}
function appCard(app){
 return `<button type="button" data-app-card="${esc(app.slug)}"><strong>${Number(app.count||0).toLocaleString()}</strong><span>${esc(app.name)}</span><small>${esc(app.status||'')}</small></button>`;
}
function render(){
 q('[data-auth-card]').hidden=true;
 q('[data-dashboard]').hidden=false;
 q('[data-count]').textContent=`${data.signups.length.toLocaleString()} signup${data.signups.length===1?'':'s'}`;
 q('[data-apps]').innerHTML=data.apps.map(appCard).join('');
 const select=q('[data-app-filter]'),current=select.value;
 select.innerHTML='<option value="">All apps</option>'+data.apps.map(app=>`<option value="${esc(app.slug)}">${esc(app.name)} (${app.count||0})</option>`).join('');
 select.value=current;
 q('[data-apps]').querySelectorAll('[data-app-card]').forEach(button=>button.onclick=()=>{
   select.value=button.dataset.appCard||'';
   renderRows();
   q('.filters').scrollIntoView({behavior:'smooth',block:'center'});
 });
 renderRows();
}
function renderRows(){
 const rows=filtered();
 q('[data-rows]').innerHTML=rows.length?rows.map(row=>`<tr><td>${esc(row.app_name||row.app_slug)}</td><td>${esc(row.name||'')}</td><td><a href="mailto:${esc(row.email)}">${esc(row.email)}</a></td><td class="mono">${esc(row.ip||'—')}</td><td>${esc(row.region||'—')}</td><td>${row.createdAt?new Date(row.createdAt).toLocaleString():'—'}</td><td class="source">${row.source?`<a href="${esc(row.source)}" target="_blank" rel="noopener">Open</a>`:''}</td></tr>`).join(''):'<tr><td colspan="7">No matching signups.</td></tr>';
}
function csv(){
 const rows=filtered(),cell=v=>`"${String(v??'').replace(/"/g,'""')}"`;
 const body=[['App','Name','Email','IP','Region','Signed up','Source'],...rows.map(r=>[r.app_name||r.app_slug,r.name,r.email,r.ip,r.region,r.createdAt,r.source])].map(row=>row.map(cell).join(',')).join('\n');
 const blob=new Blob([body],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');
 a.href=URL.createObjectURL(blob);a.download=`twp-app-signups-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);
}
async function load(){
 data=await api('/api/admin/signups');
 render();
 q('[data-dashboard-status]').textContent=`Updated ${data.updatedAt?new Date(data.updatedAt).toLocaleString():'now'}.`;
 return data;
}

q('[data-signin-form]').addEventListener('submit',async event=>{
 event.preventDefault();
 const form=event.currentTarget,fd=new FormData(form),status=q('[data-auth-status]');
 status.textContent='Signing in…';
 try{
   await signIn(String(fd.get('email')||'').trim(),String(fd.get('password')||''));
   form.reset();
   await load();
 }catch(error){
   status.textContent=error.status===403?'This signed-in account does not have access to app signups. Sign out and use the authorized account.':error.message;
 }
});
q('[data-refresh]').onclick=()=>load().catch(error=>q('[data-dashboard-status]').textContent=error.message);
q('[data-export]').onclick=csv;
q('[data-app-filter]').onchange=renderRows;
q('[data-search]').oninput=renderRows;
q('[data-signout]').onclick=()=>signOut();

load().catch(error=>{
 const message=error.status===403
  ?'This signed-in account does not have access to app signups. Sign out and use the authorized account.'
  :'Sign in with the authorized Atlas Harbor account.';
 showAuth(message);
});

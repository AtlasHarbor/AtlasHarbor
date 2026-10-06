import {accessToken,user} from './supabase-client.js';
const q=s=>document.querySelector(s);let password=sessionStorage.getItem('atlas-admin-password')||'',data=null;
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function load(){
 const token=accessToken();if(!token)throw new Error('Sign in to Atlas Harbor first, then return to /signups.');
 const response=await fetch('/api/admin/signups',{headers:{Authorization:`Bearer ${token}`,'X-Admin-Password':password},cache:'no-store'});
 const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||'Could not load signups.');data=body;render();return body;
}
function filtered(){
 const app=q('[data-app-filter]').value,term=q('[data-search]').value.trim().toLowerCase();
 return (data?.signups||[]).filter(row=>(!app||row.app_slug===app)&&(!term||[row.name,row.email,row.app_name].some(v=>String(v||'').toLowerCase().includes(term))));
}
function render(){
 q('[data-unlock]').hidden=true;q('[data-dashboard]').hidden=false;
 q('[data-count]').textContent=`${data.signups.length.toLocaleString()} signup${data.signups.length===1?'':'s'}`;
 q('[data-apps]').innerHTML=data.apps.map(app=>`<article><strong>${Number(app.count||0).toLocaleString()}</strong><span>${esc(app.name)}</span><small>${esc(app.status||'')}</small></article>`).join('');
 const select=q('[data-app-filter]'),current=select.value;select.innerHTML='<option value="">All apps</option>'+data.apps.map(app=>`<option value="${esc(app.slug)}">${esc(app.name)} (${app.count||0})</option>`).join('');select.value=current;
 renderRows();
}
function renderRows(){
 const rows=filtered();q('[data-rows]').innerHTML=rows.length?rows.map(row=>`<tr><td>${esc(row.app_name||row.app_slug)}</td><td>${esc(row.name||'')}</td><td><a href="mailto:${esc(row.email)}">${esc(row.email)}</a></td><td>${row.createdAt?new Date(row.createdAt).toLocaleString():''}</td><td class="source">${row.source?`<a href="${esc(row.source)}" target="_blank" rel="noopener">Open</a>`:''}</td></tr>`).join(''):'<tr><td colspan="5">No matching signups.</td></tr>';
}
function csv(){
 const rows=filtered(),cells=v=>`"${String(v??'').replace(/"/g,'""')}"`,body=[['App','Name','Email','Signed up','Source'],...rows.map(r=>[r.app_name||r.app_slug,r.name,r.email,r.createdAt,r.source])].map(row=>row.map(cells).join(',')).join('\n'),blob=new Blob([body],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`twp-app-signups-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);
}
q('[data-unlock-form]').addEventListener('submit',async e=>{e.preventDefault();password=new FormData(e.currentTarget).get('password');q('[data-status]').textContent='Checking admin access...';try{await load();sessionStorage.setItem('atlas-admin-password',password)}catch(error){q('[data-status]').textContent=error.message}});
q('[data-refresh]').onclick=()=>load().catch(error=>q('[data-dashboard-status]').textContent=error.message);q('[data-export]').onclick=csv;q('[data-app-filter]').onchange=renderRows;q('[data-search]').oninput=renderRows;
if(!user())q('[data-auth-note]').innerHTML='You are not signed in. <a href="/account">Sign in to Atlas Harbor</a>, then return here.';
if(password&&user())load().catch(()=>{password='';sessionStorage.removeItem('atlas-admin-password')});

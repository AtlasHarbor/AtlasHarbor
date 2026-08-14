import{user,accessToken,refreshSession}from'./supabase-client.js';

const card=document.querySelector('#baseball-export-card'),level=document.querySelector('#baseball-export-level'),button=document.querySelector('#download-baseball-export'),status=document.querySelector('#baseball-export-status');
if(card){
 const sync=()=>{card.hidden=!user()};
 sync();
 window.addEventListener('atlas-auth-changed',sync);
 button?.addEventListener('click',async()=>{
  if(!user()){status.textContent='Sign in first.';return}
  button.disabled=true;const old=button.textContent;button.textContent='Preparing JSON…';status.textContent='Reading stored player snapshots and matching them with your saved player analysis…';
  let token=accessToken();
  const run=()=>fetch(`/api/baseball/account-export${level?.value?`?sportId=${encodeURIComponent(level.value)}`:''}`,{headers:{Accept:'application/json',Authorization:`Bearer ${token||''}`},cache:'no-store'});
  try{
   let response=await run();if(response.status===401){await refreshSession();token=accessToken();response=await run()}
   const text=await response.text();let data={};try{data=text?JSON.parse(text):{}}catch{}
   if(!response.ok)throw new Error(data.error||`Export failed (${response.status}).`);
   const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a'),label=level?.selectedOptions?.[0]?.textContent||'Baseball';
   link.href=url;link.download=`atlas-baseball-${label.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'players'}-${new Date().toISOString().slice(0,10)}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
   status.textContent=`Downloaded ${data.count||0} player records. ${data.analysisCount||0} include your saved player analysis/publication record.`;
  }catch(error){status.textContent=error.message}finally{button.disabled=false;button.textContent=old}
 });
}

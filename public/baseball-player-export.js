import'./workspace-first-note-recovery.js';
import{accessToken,user}from'./supabase-client.js';

const match=location.pathname.match(/^\/baseball\/players\/(\d+)/);
if(match){
 const id=match[1];
 const style=document.createElement('style');
 style.textContent='.baseball-export-player{white-space:nowrap;padding:9px 12px;border:1px solid #d8d2c4;border-radius:10px;background:#fffdf7;color:#173b32;font:800 11px system-ui;cursor:pointer}.baseball-export-player:hover,.baseball-export-player:focus-visible{border-color:#ef6b3a;outline:none;box-shadow:0 0 0 3px #ef6b3a20}@media(max-width:720px){.baseball-export-player{font-size:10px;padding:8px 10px}}';
 document.head.append(style);
 const sessionAnalysis=()=>{
  const current=user();if(!current)return null;
  const metadata=current.user_metadata||{},spaces=metadata.atlas_problem_spaces||{},workspace=spaces.publishing_workspace||{},virtual=metadata.atlas_virtual_tables||{};
  const rows=[...(Array.isArray(workspace.notes)?workspace.notes:[]),...(Array.isArray(virtual.workspace_notes)?virtual.workspace_notes:[])];
  return rows.filter(row=>String(row?.user_id||current.id)===String(current.id)&&row?.resource_type==='baseball_player'&&String(row?.resource_id||'')===String(id)).sort((a,b)=>Date.parse(b.updated_at||b.published_at||0)-Date.parse(a.updated_at||a.published_at||0))[0]||null;
 };
 const loadAnalysis=async()=>{
  let analysis=sessionAnalysis();const token=accessToken();if(!token)return analysis;
  try{
   const response=await fetch(`/api/workspaces/baseball_player/${encodeURIComponent(id)}`,{headers:{Accept:'application/json',Authorization:`Bearer ${token}`},cache:'no-store'}),data=await response.json().catch(()=>({}));
   if(response.ok&&data.workspace)analysis=data.workspace;
  }catch{}
  return analysis;
 };
 let attempts=0;
 const install=()=>{
  attempts++;
  const nav=document.querySelector('.report-nav');
  if(!nav){if(attempts<50)setTimeout(install,100);return}
  if(nav.querySelector('.baseball-export-player'))return;
  const button=document.createElement('button');
  button.type='button';button.className='baseball-export-player';button.textContent='Export player JSON';button.title='Download the full normalized player record plus your saved Atlas Harbor analysis for this player.';
  button.onclick=async()=>{
   button.disabled=true;const old=button.textContent;button.textContent='Refreshing…';
   try{
    const [playerResponse,analysis]=await Promise.all([
     fetch(`/api/baseball/prospect-players/${encodeURIComponent(id)}`,{headers:{Accept:'application/json'},cache:'no-store'}),
     loadAnalysis()
    ]);
    const data=await playerResponse.json().catch(()=>({}));if(!playerResponse.ok||!data.player)throw new Error(data.error||`Request failed (${playerResponse.status}).`);
    const payload={exportedAt:new Date().toISOString(),source:'Atlas Harbor normalized Baseball player record',player:data.player,analysis:analysis?{...analysis,_store:undefined}:null};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    const slug=String(data.player.name||id).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    link.href=url;link.download=`atlas-baseball-${slug||id}-${id}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    button.textContent=analysis?'Exported + analysis':'Exported';setTimeout(()=>{button.textContent=old;button.disabled=false},1200);
   }catch(error){button.textContent='Export failed';button.title=error.message;setTimeout(()=>{button.textContent=old;button.disabled=false},1800)}
  };
  const search=nav.querySelector('.baseball-profile-search-launch');if(search)nav.insertBefore(button,search);else nav.append(button);
 };
 install();
}

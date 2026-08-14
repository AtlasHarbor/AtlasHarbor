const match=location.pathname.match(/^\/baseball\/players\/(\d+)/);
if(match){
 const id=match[1];
 const style=document.createElement('style');
 style.textContent='.baseball-export-player{white-space:nowrap;padding:9px 12px;border:1px solid #d8d2c4;border-radius:10px;background:#fffdf7;color:#173b32;font:800 11px system-ui;cursor:pointer}.baseball-export-player:hover,.baseball-export-player:focus-visible{border-color:#ef6b3a;outline:none;box-shadow:0 0 0 3px #ef6b3a20}@media(max-width:720px){.baseball-export-player{font-size:10px;padding:8px 10px}}';
 document.head.append(style);
 let attempts=0;
 const install=()=>{
  attempts++;
  const nav=document.querySelector('.report-nav');
  if(!nav){if(attempts<50)setTimeout(install,100);return}
  if(nav.querySelector('.baseball-export-player'))return;
  const button=document.createElement('button');
  button.type='button';button.className='baseball-export-player';button.textContent='Export player JSON';button.title='Download the full normalized Atlas Harbor player record, including level splits and recent games.';
  button.onclick=async()=>{
   button.disabled=true;const old=button.textContent;button.textContent='Refreshing…';
   try{
    const response=await fetch(`/api/baseball/prospect-players/${encodeURIComponent(id)}`,{headers:{Accept:'application/json'},cache:'no-store'});
    const data=await response.json().catch(()=>({}));if(!response.ok||!data.player)throw new Error(data.error||`Request failed (${response.status}).`);
    const payload={exportedAt:new Date().toISOString(),source:'Atlas Harbor normalized Baseball player record',player:data.player};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    const slug=String(data.player.name||id).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    link.href=url;link.download=`atlas-baseball-${slug||id}-${id}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    button.textContent='Exported';setTimeout(()=>{button.textContent=old;button.disabled=false},1200);
   }catch(error){button.textContent='Export failed';button.title=error.message;setTimeout(()=>{button.textContent=old;button.disabled=false},1800)}
  };
  const search=nav.querySelector('.baseball-profile-search-launch');if(search)nav.insertBefore(button,search);else nav.append(button);
 };
 install();
}

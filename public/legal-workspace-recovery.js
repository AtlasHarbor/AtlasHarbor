import{user,updateUserMetadata}from'./supabase-client.js';

const current=user();
const slug=decodeURIComponent(location.pathname.replace(/^\/legal\/?/,'').split('/')[0]||'');
const resourceType='legal_case';
const time=value=>{const parsed=Date.parse(value||'');return Number.isFinite(parsed)?parsed:0};

if(current&&slug){
 const key=`atlas-workspace:${current.id}:${resourceType}:${slug}`;
 let local=null;try{local=JSON.parse(localStorage.getItem(key)||'null')}catch{}
 if(local){
  const metadata=current.user_metadata||{},spaces={...(metadata.atlas_problem_spaces||{})},workspace={...(spaces.publishing_workspace||{})},notes=Array.isArray(workspace.notes)?[...workspace.notes]:[],index=notes.findIndex(item=>String(item.user_id||current.id)===String(current.id)&&String(item.resource_type||'')===resourceType&&String(item.resource_id||'')===slug),account=index>=0?notes[index]:null;
  if(!account||time(local.updated_at)>time(account.updated_at||account.published_at)){
   const recovered={...account,...local,id:local.id||account?.id||crypto.randomUUID(),user_id:current.id,resource_type:resourceType,resource_id:slug,updated_at:local.updated_at||new Date().toISOString(),_store:'recovered-device-copy'};
   if(index>=0)notes[index]=recovered;else notes.push(recovered);
   workspace.notes=notes.sort((a,b)=>time(a.updated_at)-time(b.updated_at)).slice(-250);spaces.publishing_workspace=workspace;
   try{await updateUserMetadata({atlas_problem_spaces:spaces});localStorage.setItem(key,JSON.stringify(recovered))}catch(error){console.warn('Legal workspace device recovery:',error.message)}
  }
 }
}

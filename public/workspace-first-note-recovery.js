import{user,accessToken}from'./supabase-client.js';

const currentPath=location.pathname;
if(/^\/baseball\/players\/\d+/.test(currentPath)){
 const prior=(globalThis.__atlasNativeFetch||globalThis.fetch).bind(globalThis);
 const hasExistingRecord=(resourceType,resourceId)=>{
  const current=user();
  if(!current)return false;
  const metadata=current.user_metadata||{},spaces=metadata.atlas_problem_spaces||{},workspace=spaces.publishing_workspace||{},virtual=metadata.atlas_virtual_tables||{};
  const rows=[...(Array.isArray(workspace.notes)?workspace.notes:[]),...(Array.isArray(virtual.workspace_notes)?virtual.workspace_notes:[])];
  return rows.some(row=>String(row?.user_id||current.id)===String(current.id)&&String(row?.resource_type||'')===String(resourceType)&&String(row?.resource_id||'')===String(resourceId));
 };
 const matchWorkspaceGet=(input,init={})=>{
  try{
   const request=input instanceof Request?input:null,url=new URL(request?.url||String(input||''),location.href),method=String(init.method||request?.method||'GET').toUpperCase();
   if(method!=='GET'||url.origin!==location.origin)return null;
   const match=url.pathname.match(/^\/api\/workspaces\/([^/]+)\/([^/]+)$/);
   if(!match)return null;
   return{resourceType:decodeURIComponent(match[1]),resourceId:decodeURIComponent(match[2])};
  }catch{return null}
 };
 const emptyResponse=()=>new Response(JSON.stringify({workspace:null,storage:'authenticated-session-empty'}),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 globalThis.__atlasNativeFetch=async(input,init={})=>{
  const target=matchWorkspaceGet(input,init);
  if(!target||!user()||!accessToken()||hasExistingRecord(target.resourceType,target.resourceId))return prior(input,init);
  try{
   const response=await prior(input,init);
   if(response.status>=500&&response.status<=504)return emptyResponse();
   return response;
  }catch{
   return emptyResponse();
  }
 };
}

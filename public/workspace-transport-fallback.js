let installed=false;

function responseHeaders(raw=''){
 const headers=new Headers();
 for(const line of String(raw).trim().split(/\r?\n/)){
  const index=line.indexOf(':');
  if(index<=0)continue;
  headers.append(line.slice(0,index).trim(),line.slice(index+1).trim());
 }
 return headers;
}

function xhrRequest(input,init={}){
 return new Promise((resolve,reject)=>{
  const url=typeof input==='string'?input:input?.url||String(input||'');
  const xhr=new XMLHttpRequest();
  xhr.open(init.method||'GET',url,true);
  const headers=new Headers(init.headers||{});
  headers.forEach((value,key)=>xhr.setRequestHeader(key,value));
  xhr.onload=()=>resolve(new Response(xhr.responseText||'',{status:xhr.status,statusText:xhr.statusText,headers:responseHeaders(xhr.getAllResponseHeaders())}));
  xhr.onerror=()=>reject(new TypeError('Database transport network request failed.'));
  xhr.ontimeout=()=>reject(new TypeError('Database transport network request timed out.'));
  xhr.onabort=()=>reject(new DOMException('Database transport request aborted.','AbortError'));
  if(init.signal){
   if(init.signal.aborted){xhr.abort();return}
   init.signal.addEventListener('abort',()=>xhr.abort(),{once:true});
  }
  xhr.send(init.body??null);
 });
}

function configuredSupabaseOrigin(){
 try{
  const direct=globalThis.__ATLAS_CONFIG__?.supabaseUrl;
  if(direct)return new URL(direct,location.href).origin;
  const stored=JSON.parse(localStorage.getItem('atlas-harbor-public-config')||'null');
  if(stored?.supabaseUrl)return new URL(stored.supabaseUrl,location.href).origin;
 }catch{}
 return'';
}

function eligibleForXhrFallback(input){
 const raw=typeof input==='string'?input:input?.url||'';
 const url=new URL(raw||location.href,location.href);
 if(url.origin===location.origin&&url.pathname.startsWith('/api/workspaces/'))return true;
 const supabaseOrigin=configuredSupabaseOrigin();
 return Boolean(supabaseOrigin&&url.origin===supabaseOrigin&&url.pathname==='/auth/v1/user');
}

function firstBaseballWorkspaceCanOpenEmpty(input,init={}){
 try{
  const request=input instanceof Request?input:null,method=String(init.method||request?.method||'GET').toUpperCase();
  if(method!=='GET')return false;
  const url=new URL(request?.url||String(input||''),location.href),match=url.origin===location.origin&&url.pathname.match(/^\/api\/workspaces\/baseball_player\/([^/]+)$/);
  if(!match)return false;
  const session=JSON.parse(localStorage.getItem('atlas-harbor-session')||'null'),current=session?.user;if(!session?.access_token||!current?.id)return false;
  const resourceId=decodeURIComponent(match[1]),metadata=current.user_metadata||{},spaces=metadata.atlas_problem_spaces||{},canonical=spaces.publishing_workspace?.notes,virtual=metadata.atlas_virtual_tables?.workspace_notes,rows=[...(Array.isArray(canonical)?canonical:[]),...(Array.isArray(virtual)?virtual:[])];
  return !rows.some(row=>(!row.user_id||String(row.user_id)===String(current.id))&&row.resource_type==='baseball_player'&&String(row.resource_id||'')===String(resourceId));
 }catch{return false}
}

function emptyFirstWorkspaceResponse(){return new Response(JSON.stringify({workspace:null,storage:'authenticated-session-empty'}),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Atlas-Workspace-Recovery':'first-baseball-analysis'}})}

export function installWorkspaceTransportFallback(){
 if(installed)return;
 installed=true;
 const prior=(globalThis.__atlasNativeFetch||globalThis.fetch).bind(globalThis);
 globalThis.__atlasNativeFetch=async(input,init={})=>{
  if(!eligibleForXhrFallback(input))return prior(input,init);
  try{return await prior(input,init)}catch(fetchError){
   try{return await xhrRequest(input,init)}catch(xhrError){
    if(firstBaseballWorkspaceCanOpenEmpty(input,init))return emptyFirstWorkspaceResponse();
    const error=new TypeError(`Database service unavailable through fetch and XHR: ${xhrError.message}`);
    error.cause=fetchError;
    throw error;
   }
  }
 };
}

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

function sessionSnapshot(){
 try{return JSON.parse(localStorage.getItem('atlas-harbor-session')||'null')}catch{return null}
}

function newest(rows=[]){
 return [...rows].sort((a,b)=>Date.parse(b?.updated_at||b?.published_at||b?.created_at||0)-Date.parse(a?.updated_at||a?.published_at||a?.created_at||0))[0]||null;
}

function sessionWorkspace(url){
 const session=sessionSnapshot(),current=session?.user;
 if(!session?.access_token||!current?.id)return null;
 const match=url.pathname.match(/^\/api\/workspaces\/([^/]+)\/([^/]+)$/);
 if(!match)return null;
 const resourceType=decodeURIComponent(match[1]),resourceId=decodeURIComponent(match[2]),rows=[];
 const canonical=current.user_metadata?.atlas_problem_spaces?.publishing_workspace?.notes||[];
 const virtual=current.user_metadata?.atlas_virtual_tables?.workspace_notes||[];
 for(const item of [...canonical,...virtual]){
  if(String(item?.user_id||current.id)!==String(current.id))continue;
  if(String(item?.resource_type||'')!==resourceType||String(item?.resource_id||'')!==resourceId)continue;
  rows.push({...item,_store:item?._store||'authenticated-session-metadata'});
 }
 return{workspace:newest(rows),storage:rows.length?'authenticated-session-metadata':'authenticated-session-empty',readRecovery:true};
}

function sessionAccount(){
 const session=sessionSnapshot();
 return session?.access_token&&session?.user?session.user:null;
}

function syntheticReadFallback(input,init={}){
 const raw=typeof input==='string'?input:input?.url||'';
 const url=new URL(raw||location.href,location.href),method=String(init.method||'GET').toUpperCase();
 if(method!=='GET')return null;
 if(url.origin===location.origin&&url.pathname.startsWith('/api/workspaces/')&&url.pathname!=='/api/workspaces/status'){
  const data=sessionWorkspace(url);
  if(data)return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Atlas-Workspace-Recovery':'session'}});
 }
 const supabaseOrigin=configuredSupabaseOrigin();
 if(supabaseOrigin&&url.origin===supabaseOrigin&&url.pathname==='/auth/v1/user'){
  const account=sessionAccount();
  if(account)return new Response(JSON.stringify(account),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Atlas-Workspace-Recovery':'session'}});
 }
 return null;
}

function eligibleForXhrFallback(input){
 const raw=typeof input==='string'?input:input?.url||'';
 const url=new URL(raw||location.href,location.href);
 if(url.origin===location.origin&&url.pathname.startsWith('/api/workspaces/'))return true;
 const supabaseOrigin=configuredSupabaseOrigin();
 return Boolean(supabaseOrigin&&url.origin===supabaseOrigin&&url.pathname==='/auth/v1/user');
}

export function installWorkspaceTransportFallback(){
 if(installed)return;
 installed=true;
 const prior=(globalThis.__atlasNativeFetch||globalThis.fetch).bind(globalThis);
 globalThis.__atlasNativeFetch=async(input,init={})=>{
  if(!eligibleForXhrFallback(input))return prior(input,init);
  try{return await prior(input,init)}catch(fetchError){
   try{return await xhrRequest(input,init)}catch(xhrError){
    const recovered=syntheticReadFallback(input,init);
    if(recovered)return recovered;
    const error=new TypeError(`Database service unavailable through fetch and XHR: ${xhrError.message}`);
    error.cause=fetchError;
    throw error;
   }
  }
 };
}

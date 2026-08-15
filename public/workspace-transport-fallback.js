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

function requestHeaders(input,init={}){
 const request=input instanceof Request?input:null,headers=new Headers(request?.headers||{});
 new Headers(init.headers||{}).forEach((value,key)=>headers.set(key,value));
 return headers;
}

function xhrRequest(input,init={}){
 return new Promise((resolve,reject)=>{
  const url=typeof input==='string'?input:input?.url||String(input||'');
  const xhr=new XMLHttpRequest();
  xhr.open(init.method||(input instanceof Request?input.method:'GET'),url,true);
  const headers=requestHeaders(input,init);
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

function eligibleForXhrFallback(input){
 const raw=typeof input==='string'?input:input?.url||'';
 const url=new URL(raw||location.href,location.href);
 return url.origin===location.origin&&url.pathname.startsWith('/api/workspaces/');
}

function firstBaseballWorkspaceCanOpenEmpty(input,init={}){
 try{
  const request=input instanceof Request?input:null,method=String(init.method||request?.method||'GET').toUpperCase();
  if(method!=='GET')return false;
  const url=new URL(request?.url||String(input||''),location.href),match=url.origin===location.origin&&url.pathname.match(/^\/api\/workspaces\/baseball_player\/([^/]+)$/);
  if(!match)return false;
  const session=JSON.parse(localStorage.getItem('atlas-harbor-session')||'null'),current=session?.user;if(!session?.access_token||!current?.id)return false;
  const resourceId=decodeURIComponent(match[1]),metadata=current.user_metadata||{},spaces=metadata.atlas_problem_spaces||{},canonical=spaces.publishing_workspace?.notes,virtual=metadata.atlas_virtual_tables?.workspace_notes,segmented=Object.entries(metadata).filter(([key,value])=>key.startsWith('atlas_workspace_record_v2_')&&value&&typeof value==='object').map(([,value])=>value),rows=[...(Array.isArray(canonical)?canonical:[]),...segmented,...(Array.isArray(virtual)?virtual:[])];
  return !rows.some(row=>(!row.user_id||String(row.user_id)===String(current.id))&&row.resource_type==='baseball_player'&&String(row.resource_id||'')===String(resourceId));
 }catch{return false}
}

function emptyFirstWorkspaceResponse(){return new Response(JSON.stringify({workspace:null,storage:'authenticated-session-empty'}),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Atlas-Workspace-Recovery':'first-baseball-analysis'}})}

async function missingTokenResponse(response){
 if(response?.status!==401)return false;
 try{return(await response.clone().json())?.code==='AUTH_TOKEN_MISSING'}catch{return false}
}

function rememberWorkspaceInSession(workspace){
 try{
  if(!workspace?.id)return;
  const key='atlas-harbor-session',session=JSON.parse(localStorage.getItem(key)||'null'),current=session?.user;if(!current?.id)return;
  const metadata={...(current.user_metadata||{})},spaces={...(metadata.atlas_problem_spaces||{})},publishing={...(spaces.publishing_workspace||{})},rows=Array.isArray(publishing.notes)?publishing.notes:[];
  const filtered=rows.filter(row=>!(String(row?.id||'')===String(workspace.id)||(String(row?.resource_type||'')===String(workspace.resource_type||'')&&String(row?.resource_id||'')===String(workspace.resource_id||''))));
  publishing.notes=[...filtered,workspace].sort((a,b)=>Date.parse(a?.updated_at||0)-Date.parse(b?.updated_at||0)).slice(-250);
  spaces.publishing_workspace=publishing;metadata.atlas_problem_spaces=spaces;current.user_metadata=metadata;session.user=current;localStorage.setItem(key,JSON.stringify(session));
 }catch{}
}

function formWorkspaceRequest(input,init={}){
 return new Promise((resolve,reject)=>{
  let request,url,method,headers,payload,token;
  try{
   request=input instanceof Request?input:null;
   url=new URL(request?.url||String(input||''),location.href);
   method=String(init.method||request?.method||'GET').toUpperCase();
   if(url.origin!==location.origin||method!=='PUT'||!url.pathname.startsWith('/api/workspaces/'))throw new Error('Form fallback is not eligible for this request.');
   headers=requestHeaders(input,init);
   token=String(headers.get('Authorization')||headers.get('X-Atlas-Session')||'').replace(/^Bearer\s+/i,'');
   payload=typeof init.body==='string'?init.body:null;
   if(!token||payload==null)throw new Error('Form fallback requires the signed-in workspace payload.');
  }catch(error){reject(error);return}
  const suffix=url.pathname.slice('/api/workspaces/'.length),requestId=`wsf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,frame=document.createElement('iframe'),form=document.createElement('form');
  frame.name=`atlas-workspace-form-${requestId}`;frame.hidden=true;form.hidden=true;form.method='POST';form.action=`/api/workspaces-form/${suffix}?request_id=${encodeURIComponent(requestId)}`;form.target=frame.name;
  for(const[name,value]of[['request_id',requestId],['access_token',token],['payload',payload]]){const field=document.createElement('input');field.type='hidden';field.name=name;field.value=value;form.append(field)}
  let timer,finished=false;
  const cleanup=()=>{clearTimeout(timer);window.removeEventListener('message',onMessage);form.remove();frame.remove()};
  const onMessage=event=>{
   if(event.origin!==location.origin||event.data?.type!=='atlas-workspace-form-result'||event.data?.requestId!==requestId)return;
   const data=event.data;finished=true;cleanup();
   if(data.ok&&data.workspace)rememberWorkspaceInSession(data.workspace);
   resolve(new Response(JSON.stringify(data.ok?{workspace:data.workspace,storage:data.storage||'account-metadata',migratedFrom:data.migratedFrom||null}:{error:data.error||'Workspace form save failed.'}),{status:data.ok?200:(Number(data.status)||500),headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Atlas-Workspace-Recovery':'form-navigation'}}));
  };
  frame.onload=()=>setTimeout(()=>{if(finished)return;try{const message=String(frame.contentDocument?.body?.innerText||'').trim();if(!message)return;finished=true;cleanup();reject(new TypeError(`Database form-navigation fallback failed: ${message.slice(0,240)}`))}catch{}},0);
  window.addEventListener('message',onMessage);
  timer=setTimeout(()=>{finished=true;cleanup();reject(new TypeError('Database form-navigation fallback timed out.'))},20000);
  document.body.append(frame,form);form.submit();
 });
}

export function installWorkspaceTransportFallback(){
 if(installed)return;
 installed=true;
 const prior=(globalThis.__atlasNativeFetch||globalThis.fetch).bind(globalThis);
 globalThis.__atlasNativeFetch=async(input,init={})=>{
  if(!eligibleForXhrFallback(input))return prior(input,init);
  let fetchError,xhrError;
  try{const response=await prior(input,init);if(!await missingTokenResponse(response))return response;fetchError=new TypeError('Fetch reached the workspace API without the account token.')}catch(error){fetchError=error}
  try{const response=await xhrRequest(input,init);if(!await missingTokenResponse(response))return response;xhrError=new TypeError('XHR reached the workspace API without the account token.')}catch(error){xhrError=error}
  try{return await formWorkspaceRequest(input,init)}catch(formError){
   if(firstBaseballWorkspaceCanOpenEmpty(input,init))return emptyFirstWorkspaceResponse();
   const error=new TypeError(`Database service unavailable through fetch, XHR, and form navigation: ${formError.message}`);
   error.cause=fetchError;error.xhrCause=xhrError;
   throw error;
  }
 };
}

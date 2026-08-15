import{supabaseSecretKey,supabaseServiceHeaders}from'./supabase-server-key.js';
import{createSupabaseUserTokenVerifier}from'./supabase-user-token.js';

const JSON_HEADERS={'Content-Type':'application/json'};

async function readJson(response){
 const text=typeof response?.text==='function'?await response.text():'';
 let data={};
 try{data=text?JSON.parse(text):{}}catch{}
 if(!response?.ok){const error=new Error(data?.error_description||data?.message||data?.error||text||`Request failed (${response?.status||'unknown'}).`);error.status=response?.status||500;throw error}
 return data;
}

export function createProblemSpaceStorage({env=process.env,fetchImpl=globalThis.fetch}={}){
 const base=env.SUPABASE_URL,key=env.SUPABASE_PUBLISHABLE_KEY,secret=supabaseSecretKey(env);
 const authApiKeys=[secret,key].map(value=>String(value||'').trim()).filter((value,index,values)=>value&&values.indexOf(value)===index);
 const writeQueues=new Map();let cachedHostId=null;
 const configured=Boolean(base&&key&&secret);
 const authHeaders=(token,apiKey)=>({apikey:apiKey,Authorization:`Bearer ${token}`,...JSON_HEADERS});
 const serviceHeaders=()=>supabaseServiceHeaders(secret);
 const bearer=req=>String(req?.get?.('authorization')||'').replace(/^Bearer\s+/i,'');
 const signInError=token=>Object.assign(new Error(token?'Your account session expired or is invalid. Sign in again.':'Sign in required.'),{status:401});
 const serial=(key,operation)=>{const prior=writeQueues.get(key)||Promise.resolve(),next=prior.then(operation,operation),settled=next.catch(()=>{});writeQueues.set(key,settled);settled.finally(()=>{if(writeQueues.get(key)===settled)writeQueues.delete(key)});return next};
 async function timedFetch(url,options={}){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);try{return await fetchImpl(url,{...options,signal:controller.signal})}catch(error){if(error?.name==='AbortError')throw Object.assign(new Error('Database request timed out.'),{status:504});throw error}finally{clearTimeout(timer)}}
 const tokenVerifier=createSupabaseUserTokenVerifier({base,jwksUrl:env.SUPABASE_JWKS_URL,loadJwks:async url=>readJson(await timedFetch(url,{headers:{Accept:'application/json'}}))});
 async function ownUserResponse(token,options={}){if(!base||!token||!authApiKeys.length)return null;let rejected=null;for(const apiKey of authApiKeys){const response=await timedFetch(`${base}/auth/v1/user`,{...options,headers:{...authHeaders(token,apiKey),...(options.headers||{})}});if(response.ok)return response;if(![401,403].includes(response.status))return readJson(response);rejected=response}return rejected}
 async function remoteUserForToken(token){const response=await ownUserResponse(token);if(!response||!response.ok)return null;return response.json()}
 async function serviceAccountById(id){if(!id||!secret)return null;const response=await timedFetch(`${base}/auth/v1/admin/users/${id}`,{headers:serviceHeaders()});if(response.status===404)return null;return readJson(response)}
 async function userForToken(token){if(!base||!token)return null;const verification=await tokenVerifier.verify(token);if(verification.status==='invalid')return null;if(verification.status==='verified'){const id=verification.claims.sub;let serviceError=null;try{const account=await serviceAccountById(id);if(account)return String(account.id)===id?account:null}catch(error){serviceError=error}try{const account=(await listAccounts()).find(item=>String(item?.id)===id);if(account)return account}catch(error){serviceError=serviceError||error}const remote=await remoteUserForToken(token);if(remote)return String(remote.id)===id?remote:null;if(serviceError)throw serviceError;return null}return remoteUserForToken(token)}
 async function requestUser(req,{required=true}={}){const token=bearer(req),current=await userForToken(token);if(!current&&required)throw signInError(token);return{token,current}}
 async function listAccounts(){if(!configured)throw Object.assign(new Error('Supabase server persistence is not configured.'),{status:503});const data=await readJson(await timedFetch(`${base}/auth/v1/admin/users?per_page=1000`,{headers:serviceHeaders()}));return data.users||[]}
 async function accountById(id){if(!id)return null;try{return await serviceAccountById(id)}catch{return null}}
 async function hostAccount({fallbackCurrent=null}={}){if(cachedHostId){const cached=await accountById(cachedHostId);if(cached)return cached;cachedHostId=null}const users=await listAccounts();let account=users.find(item=>item?.user_metadata?.atlas_admin?.masterUserId===item.id)||users.find(item=>item?.user_metadata?.atlas_admin)||users.find(item=>item?.user_metadata?.atlas_problem_spaces);if(!account&&fallbackCurrent)account=users.find(item=>item.id===fallbackCurrent.id)||fallbackCurrent;if(account)cachedHostId=account.id;return account||null}
 async function updateAccount(accountId,metadata){return readJson(await timedFetch(`${base}/auth/v1/admin/users/${accountId}`,{method:'PUT',headers:serviceHeaders(),body:JSON.stringify({user_metadata:metadata})}))}
 async function updateOwn(token,metadata,accountId){if(accountId&&secret)try{return await readJson(await timedFetch(`${base}/auth/v1/admin/users/${accountId}`,{method:'PUT',headers:serviceHeaders(),body:JSON.stringify({user_metadata:metadata})}))}catch(error){if(![401,403,404].includes(error.status))throw error}const response=await ownUserResponse(token,{method:'PUT',body:JSON.stringify({data:metadata})});if(!response)throw Object.assign(new Error('Supabase user authentication is not configured.'),{status:503});return readJson(response)}
 async function readHost({fallbackCurrent=null}={}){if(!configured)return null;return hostAccount({fallbackCurrent})}
 async function updateHost(updater,{fallbackCurrent=null}={}){if(!configured)throw Object.assign(new Error('Supabase server persistence is not configured.'),{status:503});return serial('host',async()=>{let account=await hostAccount({fallbackCurrent});if(!account&&fallbackCurrent)account=fallbackCurrent;if(!account)throw Object.assign(new Error('Create or sign in to an Atlas Harbor account before initializing shared Problem Space storage.'),{status:409});const metadata=await updater(structuredClone(account.user_metadata||{}),account);const saved=await updateAccount(account.id,metadata);return saved.user||saved})}
 async function readGlobal(space,{fallbackCurrent=null,defaults={}}={}){if(!configured)return structuredClone(defaults);const account=await hostAccount({fallbackCurrent});return{...structuredClone(defaults),...(account?.user_metadata?.atlas_problem_spaces?.[space]||{})}}
 async function writeGlobal(space,updater,{fallbackCurrent=null}={}){let value;const account=await updateHost(async metadata=>{const spaces={...(metadata.atlas_problem_spaces||{})},current=spaces[space]||{};value=await updater(structuredClone(current));spaces[space]=value;return{...metadata,atlas_problem_spaces:spaces}},{fallbackCurrent});return{value,account}}
 async function readUser(req,space,{defaults={}}={}){const{current}=await requestUser(req);return{user:current,value:{...structuredClone(defaults),...(current.user_metadata?.atlas_problem_spaces?.[space]||{})}}}
 async function patchUser(req,updater){const token=bearer(req);if(!token)throw signInError(token);return serial(`user:${token}`,async()=>{const fresh=await userForToken(token);if(!fresh)throw signInError(token);const patch=await updater(structuredClone(fresh.user_metadata||{}),fresh);if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Object.assign(new Error('Account metadata patch is invalid.'),{status:500});const saved=await updateOwn(token,patch,fresh.id);return{patch,user:saved.user||saved}})}
 async function writeUser(req,space,updater){const token=bearer(req);if(!token)throw signInError(token);return serial(`user:${token}`,async()=>{const fresh=await userForToken(token);if(!fresh)throw signInError(token);const spaces={...(fresh.user_metadata?.atlas_problem_spaces||{})},value=await updater(structuredClone(spaces[space]||{}),fresh);spaces[space]=value;const metadata={...(fresh.user_metadata||{}),atlas_problem_spaces:spaces};const saved=await updateOwn(token,metadata,fresh.id);return{value,user:saved.user||saved}})}
 return{configured,userSessionVerification:'jwks-admin-with-auth-fallback',bearer,userForToken,requestUser,listAccounts,hostAccount,readHost,updateHost,readGlobal,writeGlobal,readUser,patchUser,writeUser,readJson};
}

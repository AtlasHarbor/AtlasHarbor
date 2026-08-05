const JSON_HEADERS={'Content-Type':'application/json'};

async function readJson(response){
 const text=typeof response?.text==='function'?await response.text():'';
 let data={};
 try{data=text?JSON.parse(text):{}}catch{}
 if(!response?.ok){const error=new Error(data?.error_description||data?.message||data?.error||text||`Request failed (${response?.status||'unknown'}).`);error.status=response?.status||500;throw error}
 return data;
}

export function createProblemSpaceStorage({env=process.env,fetchImpl=globalThis.fetch}={}){
 const base=env.SUPABASE_URL,key=env.SUPABASE_PUBLISHABLE_KEY,secret=env.SUPABASE_SECRET_KEY;
 let writeQueue=Promise.resolve(),cachedHostId=null;
 const configured=Boolean(base&&key&&secret);
 const authHeaders=token=>({apikey:key,Authorization:`Bearer ${token}`,...JSON_HEADERS});
 const serviceHeaders=()=>({apikey:secret,Authorization:`Bearer ${secret}`,...JSON_HEADERS});
 const bearer=req=>String(req?.get?.('authorization')||'').replace(/^Bearer\s+/i,'');
 const serial=operation=>{const next=writeQueue.then(operation,operation);writeQueue=next.catch(()=>{});return next};
 async function userForToken(token){if(!base||!key||!token)return null;const response=await fetchImpl(`${base}/auth/v1/user`,{headers:authHeaders(token)});return response.ok?response.json():null}
 async function requestUser(req,{required=true}={}){const token=bearer(req),current=await userForToken(token);if(!current&&required)throw Object.assign(new Error('Sign in required.'),{status:401});return{token,current}}
 async function listAccounts(){if(!configured)throw Object.assign(new Error('Supabase server persistence is not configured.'),{status:503});const data=await readJson(await fetchImpl(`${base}/auth/v1/admin/users?per_page=1000`,{headers:serviceHeaders()}));return data.users||[]}
 async function accountById(id){if(!id)return null;try{return await readJson(await fetchImpl(`${base}/auth/v1/admin/users/${id}`,{headers:serviceHeaders()}))}catch{return null}}
 async function hostAccount({fallbackCurrent=null}={}){if(cachedHostId){const cached=await accountById(cachedHostId);if(cached)return cached;cachedHostId=null}const users=await listAccounts();let account=users.find(item=>item?.user_metadata?.atlas_admin?.masterUserId===item.id)||users.find(item=>item?.user_metadata?.atlas_admin)||users.find(item=>item?.user_metadata?.atlas_problem_spaces);if(!account&&fallbackCurrent)account=users.find(item=>item.id===fallbackCurrent.id)||fallbackCurrent;if(account)cachedHostId=account.id;return account||null}
 async function updateAccount(accountId,metadata){return readJson(await fetchImpl(`${base}/auth/v1/admin/users/${accountId}`,{method:'PUT',headers:serviceHeaders(),body:JSON.stringify({user_metadata:metadata})}))}
 async function updateOwn(token,metadata){return readJson(await fetchImpl(`${base}/auth/v1/user`,{method:'PUT',headers:authHeaders(token),body:JSON.stringify({data:metadata})}))}
 async function readHost({fallbackCurrent=null}={}){if(!configured)return null;return hostAccount({fallbackCurrent})}
 async function updateHost(updater,{fallbackCurrent=null}={}){if(!configured)throw Object.assign(new Error('Supabase server persistence is not configured.'),{status:503});return serial(async()=>{let account=await hostAccount({fallbackCurrent});if(!account&&fallbackCurrent)account=fallbackCurrent;if(!account)throw Object.assign(new Error('Create or sign in to an Atlas Harbor account before initializing shared Problem Space storage.'),{status:409});const metadata=await updater(structuredClone(account.user_metadata||{}),account);const saved=await updateAccount(account.id,metadata);return saved.user||saved})}
 async function readGlobal(space,{fallbackCurrent=null,defaults={}}={}){if(!configured)return structuredClone(defaults);const account=await hostAccount({fallbackCurrent});return{...structuredClone(defaults),...(account?.user_metadata?.atlas_problem_spaces?.[space]||{})}}
 async function writeGlobal(space,updater,{fallbackCurrent=null}={}){let value;const account=await updateHost(async metadata=>{const spaces={...(metadata.atlas_problem_spaces||{})},current=spaces[space]||{};value=await updater(structuredClone(current));spaces[space]=value;return{...metadata,atlas_problem_spaces:spaces}},{fallbackCurrent});return{value,account}}
 async function readUser(req,space,{defaults={}}={}){const{current}=await requestUser(req);return{user:current,value:{...structuredClone(defaults),...(current.user_metadata?.atlas_problem_spaces?.[space]||{})}}}
 async function writeUser(req,space,updater){const{token,current}=await requestUser(req);return serial(async()=>{const fresh=await userForToken(token)||current,spaces={...(fresh.user_metadata?.atlas_problem_spaces||{})},value=await updater(structuredClone(spaces[space]||{}));spaces[space]=value;const metadata={...(fresh.user_metadata||{}),atlas_problem_spaces:spaces};const saved=await updateOwn(token,metadata);return{value,user:saved.user||saved}})}
 return{configured,bearer,userForToken,requestUser,listAccounts,hostAccount,readHost,updateHost,readGlobal,writeGlobal,readUser,writeUser,readJson};
}

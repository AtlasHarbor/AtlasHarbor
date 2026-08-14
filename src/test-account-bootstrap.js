import{supabaseSecretKey,supabaseServiceHeaders}from'./supabase-server-key.js';

const enabled=value=>/^(1|true|yes)$/i.test(String(value||''));
async function json(response){const text=await response.text();let data={};try{data=text?JSON.parse(text):{}}catch{}if(!response.ok)throw new Error(data.message||data.error_description||data.error||text||`Request failed (${response.status}).`);return data}

export async function ensureE2ETestAccount({env=process.env,fetchImpl=globalThis.fetch}={}){
 if(!enabled(env.ATLAS_E2E_TEST_BOOTSTRAP))return{enabled:false,reason:'disabled'};
 const base=String(env.SUPABASE_URL||'').replace(/\/$/,''),secret=supabaseSecretKey(env),email=String(env.ATLAS_E2E_TEST_EMAIL||'').trim().toLowerCase(),password=String(env.ATLAS_E2E_TEST_PASSWORD||'');
 if(!base||!secret||!email||!password)throw new Error('ATLAS_E2E_TEST_BOOTSTRAP requires SUPABASE_URL, a server secret, ATLAS_E2E_TEST_EMAIL, and ATLAS_E2E_TEST_PASSWORD.');
 if(password.length<10)throw new Error('ATLAS_E2E_TEST_PASSWORD must be at least 10 characters.');
 const headers=supabaseServiceHeaders(secret),list=await json(await fetchImpl(`${base}/auth/v1/admin/users?per_page=1000`,{headers})),existing=(list.users||[]).find(item=>String(item.email||'').toLowerCase()===email),metadata={...(existing?.user_metadata||{}),atlas_e2e_test:true};
 if(existing){
  const updated=await json(await fetchImpl(`${base}/auth/v1/admin/users/${existing.id}`,{method:'PUT',headers,body:JSON.stringify({password,email_confirm:true,user_metadata:metadata})}));
  return{enabled:true,created:false,userId:(updated.user||updated).id,email};
 }
 const created=await json(await fetchImpl(`${base}/auth/v1/admin/users`,{method:'POST',headers,body:JSON.stringify({email,password,email_confirm:true,user_metadata:metadata})}));
 return{enabled:true,created:true,userId:(created.user||created).id,email};
}

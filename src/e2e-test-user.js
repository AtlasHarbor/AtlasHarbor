import {supabaseSecretKey,supabaseServiceHeaders} from './supabase-server-key.js';

const enabled=value=>/^(1|true|yes)$/i.test(String(value||''));

async function readJson(response){
 const text=await response.text();
 let data={};
 try{data=text?JSON.parse(text):{}}catch{}
 if(!response.ok)throw new Error(data?.message||data?.error_description||data?.error||text||`Request failed (${response.status}).`);
 return data;
}

export async function ensureE2ETestUser({env=process.env,fetchImpl=globalThis.fetch}={}){
 if(!enabled(env.ATLAS_E2E_TEST_ENABLED))return{enabled:false,created:false,user:null};
 const base=String(env.SUPABASE_URL||'').replace(/\/$/,''),secret=supabaseSecretKey(env),email=String(env.ATLAS_E2E_TEST_EMAIL||'').trim().toLowerCase(),password=String(env.ATLAS_E2E_TEST_PASSWORD||'');
 if(!base||!secret)throw new Error('ATLAS_E2E_TEST_ENABLED requires SUPABASE_URL and a Supabase server secret.');
 if(!email||password.length<8)throw new Error('ATLAS_E2E_TEST_ENABLED requires ATLAS_E2E_TEST_EMAIL and ATLAS_E2E_TEST_PASSWORD (8+ characters).');
 if(env.NODE_ENV==='production'&&!enabled(env.ATLAS_E2E_ALLOW_PRODUCTION))throw new Error('Production E2E user seeding requires ATLAS_E2E_ALLOW_PRODUCTION=true.');
 const headers=supabaseServiceHeaders(secret),list=await readJson(await fetchImpl(`${base}/auth/v1/admin/users?per_page=1000`,{headers}));
 const existing=(list.users||[]).find(user=>String(user.email||'').toLowerCase()===email);
 const metadata={...(existing?.user_metadata||{}),atlas_e2e_test:true,atlas_e2e_scope:'workspace-publication-baseball'};
 if(existing){
  const saved=await readJson(await fetchImpl(`${base}/auth/v1/admin/users/${existing.id}`,{method:'PUT',headers,body:JSON.stringify({password,email_confirm:true,user_metadata:metadata})}));
  return{enabled:true,created:false,user:saved.user||saved};
 }
 const saved=await readJson(await fetchImpl(`${base}/auth/v1/admin/users`,{method:'POST',headers,body:JSON.stringify({email,password,email_confirm:true,user_metadata:metadata})}));
 return{enabled:true,created:true,user:saved.user||saved};
}

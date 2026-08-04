import express from 'express';

const jsonHeaders={'Content-Type':'application/json'};
const safeRow=row=>({
 id:row.id||null,
 share_token:row.share_token||null,
 title:String(row.title||'Untitled analysis'),
 resource_title:String(row.resource_title||'Analysis'),
 resource_type:String(row.resource_type||'analysis'),
 resource_id:String(row.resource_id||''),
 published_at:row.published_at||row.updated_at||row.created_at||null,
 updated_at:row.updated_at||row.published_at||row.created_at||null
});
const published=row=>Boolean(row&&row.is_shared&&row.is_published&&row.share_token);

async function readJson(response){
 const text=await response.text();
 if(!response.ok)throw new Error(text||`Request failed (${response.status})`);
 try{return text?JSON.parse(text):null}catch{return null}
}

export function createPublishedFeedRouter({env=process.env,fetchImpl=globalThis.fetch}={}){
 const router=express.Router();
 router.get('/api/published-feed',async(req,res)=>{
  const base=env.SUPABASE_URL;
  const publishable=env.SUPABASE_PUBLISHABLE_KEY;
  const secret=env.SUPABASE_SECRET_KEY;
  if(!base||!publishable)return res.json({publications:[],source:'unconfigured'});
  const combined=[];
  const publicHeaders={apikey:publishable};
  try{
   const query='?is_shared=eq.true&is_published=eq.true&select=id,share_token,title,resource_title,resource_type,resource_id,published_at,updated_at&order=published_at.desc.nullslast,updated_at.desc&limit=250';
   const response=await fetchImpl(`${base}/rest/v1/workspace_notes${query}`,{headers:publicHeaders});
   if(response.ok){const rows=await readJson(response);for(const row of rows||[])if(published({...row,is_shared:true,is_published:true}))combined.push(row)}
  }catch(error){console.warn('Published table feed unavailable:',error.message)}

  if(secret){
   try{
    const response=await fetchImpl(`${base}/auth/v1/admin/users?per_page=1000`,{headers:{apikey:secret,Authorization:`Bearer ${secret}`}});
    const data=await readJson(response);
    for(const account of data?.users||[]){
     const rows=account?.user_metadata?.atlas_virtual_tables?.workspace_notes;
     if(!Array.isArray(rows))continue;
     for(const row of rows)if(published(row))combined.push(row);
    }
   }catch(error){console.warn('Published metadata feed unavailable:',error.message)}
  }else{
   const token=String(req.get('authorization')||'').replace(/^Bearer\s+/i,'');
   if(token){
    try{
     const response=await fetchImpl(`${base}/auth/v1/user`,{headers:{apikey:publishable,Authorization:`Bearer ${token}`}});
     if(response.ok){const account=await readJson(response),rows=account?.user_metadata?.atlas_virtual_tables?.workspace_notes;for(const row of rows||[])if(published(row))combined.push(row)}
    }catch(error){console.warn('Current user publication feed unavailable:',error.message)}
   }
  }

  const unique=new Map();
  for(const row of combined){const key=row.share_token||row.id;if(key)unique.set(key,safeRow(row))}
  const publications=[...unique.values()].sort((a,b)=>new Date(b.published_at||b.updated_at||0)-new Date(a.published_at||a.updated_at||0)).slice(0,250);
  res.set('Cache-Control','public,max-age=15,stale-while-revalidate=60');
  return res.json({publications,source:secret?'database-and-account-metadata':'database-and-current-account'});
 });
 return router;
}

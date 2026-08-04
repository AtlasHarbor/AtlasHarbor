import express from 'express';

const safeSummary=row=>({id:row.id||null,share_token:row.share_token||null,title:String(row.title||'Untitled analysis'),resource_title:String(row.resource_title||'Analysis'),resource_type:String(row.resource_type||'analysis'),resource_id:String(row.resource_id||''),published_at:row.published_at||row.updated_at||row.created_at||null,updated_at:row.updated_at||row.published_at||row.created_at||null});
const safeDetail=row=>({...safeSummary(row),body:String(row.body||''),projections:Array.isArray(row.projections)?row.projections:[],comments_enabled:Boolean(row.comments_enabled),share_ai_analysis:row.share_ai_analysis!==false});
const published=row=>Boolean(row&&row.is_shared&&row.is_published&&row.share_token);
async function readJson(response){const text=await response.text();if(!response.ok)throw new Error(text||`Request failed (${response.status})`);try{return text?JSON.parse(text):null}catch{return null}}

export function createPublishedFeedRouter({env=process.env,fetchImpl=globalThis.fetch}={}){
 const router=express.Router(),base=env.SUPABASE_URL,publishable=env.SUPABASE_PUBLISHABLE_KEY,secret=env.SUPABASE_SECRET_KEY;
 async function collect(req,{token=null}={}){
  if(!base||!publishable)return[];
  const rows=[];
  try{
   const query=token?`?share_token=eq.${encodeURIComponent(token)}&is_shared=eq.true&is_published=eq.true&select=*&limit=1`:'?is_shared=eq.true&is_published=eq.true&select=*&order=published_at.desc.nullslast,updated_at.desc&limit=250';
   const response=await fetchImpl(`${base}/rest/v1/workspace_notes${query}`,{headers:{apikey:publishable}});
   if(response.ok)for(const row of await readJson(response)||[])if(published({...row,is_shared:true,is_published:true}))rows.push(row);
  }catch(error){console.warn('Published table feed unavailable:',error.message)}
  const appendAccount=account=>{const records=account?.user_metadata?.atlas_virtual_tables?.workspace_notes;if(!Array.isArray(records))return;for(const row of records)if(published(row)&&(!token||row.share_token===token))rows.push(row)};

  // Always inspect the signed-in account. Account-backed publications must work
  // even when a configured server secret cannot access the Auth admin endpoint.
  const bearer=String(req.get('authorization')||'').replace(/^Bearer\s+/i,'');
  if(bearer){
   try{
    const response=await fetchImpl(`${base}/auth/v1/user`,{headers:{apikey:publishable,Authorization:`Bearer ${bearer}`}});
    if(response.ok)appendAccount(await readJson(response));
   }catch(error){console.warn('Current user publication lookup unavailable:',error.message)}
  }

  if(secret){
   try{
    const response=await fetchImpl(`${base}/auth/v1/admin/users?per_page=1000`,{headers:{apikey:secret,Authorization:`Bearer ${secret}`}}),data=await readJson(response);
    for(const account of data?.users||[])appendAccount(account);
   }catch(error){console.warn('Published metadata feed unavailable:',error.message)}
  }
  return rows;
 }
 router.get('/api/published-feed',async(req,res)=>{const combined=await collect(req),unique=new Map();for(const row of combined){const key=row.share_token||row.id;if(key)unique.set(key,safeSummary(row))}const publications=[...unique.values()].sort((a,b)=>new Date(b.published_at||b.updated_at||0)-new Date(a.published_at||a.updated_at||0)).slice(0,250);res.set('Cache-Control','public,max-age=15,stale-while-revalidate=60');res.json({publications,source:secret?'database-account-and-global-metadata':'database-and-current-account'})});
 router.get('/api/published-feed/:token',async(req,res)=>{const rows=await collect(req,{token:req.params.token}),row=rows.find(item=>item.share_token===req.params.token);res.set('Cache-Control','no-store');return row?res.json({publication:safeDetail(row)}):res.status(404).json({error:'This publication was not found or is no longer shared.'})});
 return router;
}

import express from 'express';
import {isDiscoverable,isPublished,normalizeLegacyLegalRecord,normalizeWorkspaceRecord,recordKey,upsertWorkspaceRecord} from './workspace-records.js';

const safeSummary=row=>({id:row.id||null,share_token:row.share_token||null,title:String(row.title||'Untitled analysis'),resource_title:String(row.resource_title||'Analysis'),resource_type:String(row.resource_type||'analysis'),resource_id:String(row.resource_id||''),published_at:row.published_at||row.updated_at||row.created_at||null,updated_at:row.updated_at||row.published_at||row.created_at||null,author_username:String(row.author_username||'Atlas Author'),author_avatar_seed:String(row.author_avatar_seed||''),author_profile_slug:String(row.author_profile_slug||''),featured:row.featured!==false});
const safeDetail=(row,isOwner=false)=>({...safeSummary(row),body:String(row.body||''),projections:Array.isArray(row.projections)?row.projections:[],comments_enabled:Boolean(row.comments_enabled),share_ai_analysis:row.share_ai_analysis!==false,is_owner:Boolean(isOwner)});
const missingTable=(status,body)=>status===404||/Could not find the table|schema cache|PGRST205|relation .* does not exist/i.test(body||'');
async function readJson(response){const text=await response.text();if(!response.ok)throw new Error(text||`Request failed (${response.status})`);try{return text?JSON.parse(text):null}catch{return null}}

export function createPublishedFeedRouter({env=process.env,fetchImpl=globalThis.fetch}={}){
 const router=express.Router(),base=env.SUPABASE_URL,publishable=env.SUPABASE_PUBLISHABLE_KEY,secret=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SERVICE_KEY;
 async function accounts(req){
  const found=[];let current=null;if(!base||!publishable)return{accounts:found,current};
  const bearer=String(req.get('authorization')||'').replace(/^Bearer\s+/i,'');
  if(bearer)try{const response=await fetchImpl(`${base}/auth/v1/user`,{headers:{apikey:publishable,Authorization:`Bearer ${bearer}`}});if(response.ok){current=await readJson(response);found.push(current)}}catch(error){console.warn('Current account lookup unavailable:',error.message)}
  if(secret)try{const response=await fetchImpl(`${base}/auth/v1/admin/users?per_page=1000`,{headers:{apikey:secret,Authorization:`Bearer ${secret}`}}),data=await readJson(response);for(const account of data?.users||[])if(!found.some(item=>item.id===account.id))found.push(account)}catch(error){console.warn('Global account lookup unavailable:',error.message)}
  return{accounts:found,current,bearer};
 }
 async function tableRows(table,query,bearer=''){
  if(!base||!publishable)return[];const key=secret||publishable,authorization=secret?`Bearer ${secret}`:bearer?`Bearer ${bearer}`:null,headers={apikey:key,Accept:'application/json',...(authorization?{Authorization:authorization}:{})};
  try{const response=await fetchImpl(`${base}/rest/v1/${table}${query}`,{headers}),body=await response.text();if(!response.ok){if(missingTable(response.status,body))return[];console.warn(`${table} feed returned ${response.status}: ${body.slice(0,240)}`);return[]}try{return body?JSON.parse(body):[]}catch{return[]}}catch(error){console.warn(`${table} feed unavailable:`,error.message);return[]}
 }
 function accountRecords(account){
  const profile=account?.user_metadata?.atlas_profile||{},newNotes=account?.user_metadata?.atlas_problem_spaces?.publishing_workspace?.notes,virtual=account?.user_metadata?.atlas_virtual_tables?.workspace_notes,rows=[];
  for(const original of [...(Array.isArray(newNotes)?newNotes:[]),...(Array.isArray(virtual)?virtual:[])])rows.push(normalizeWorkspaceRecord({...original,user_id:original.user_id||account.id,author_username:profile.username||original.author_username,author_avatar_seed:profile.avatar_seed||original.author_avatar_seed,author_profile_slug:profile.profile_slug||original.author_profile_slug,_store:'account-metadata'}));
  return rows;
 }
 async function collect(req,{token=null,profileSlug=null,includeUnfeatured=false}={}){
  if(!base||!publishable)return{rows:[],accounts:[],current:null};
  const identity=await accounts(req),profileByUser=new Map(identity.accounts.map(account=>[account.id,account?.user_metadata?.atlas_profile||{}])),rows=[];
  const workspaceQuery=token?`?share_token=eq.${encodeURIComponent(token)}&is_shared=eq.true&is_published=eq.true&select=*&limit=5`:'?is_shared=eq.true&is_published=eq.true&select=*&order=published_at.desc.nullslast,updated_at.desc&limit=250';
  for(const original of await tableRows('workspace_notes',workspaceQuery,identity.bearer)){const profile=profileByUser.get(original.user_id)||{},row=normalizeWorkspaceRecord({...original,author_username:profile.username||original.author_username,author_avatar_seed:profile.avatar_seed||original.author_avatar_seed,author_profile_slug:profile.profile_slug||original.author_profile_slug,_store:'workspace_notes'});rows.push(row)}
  const legacyQuery=token?`?share_token=eq.${encodeURIComponent(token)}&is_shared=eq.true&select=*&limit=5`:'?is_shared=eq.true&select=*&order=updated_at.desc&limit=250';
  for(const original of await tableRows('legal_notes',legacyQuery,identity.bearer)){const profile=profileByUser.get(original.user_id)||{},row=normalizeLegacyLegalRecord({...original,author_username:profile.username||original.author_username,author_avatar_seed:profile.avatar_seed||original.author_avatar_seed,author_profile_slug:profile.profile_slug||original.author_profile_slug});rows.push({...row,author_username:profile.username||row.author_username,author_avatar_seed:profile.avatar_seed||row.author_avatar_seed,author_profile_slug:profile.profile_slug||row.author_profile_slug})}
  for(const account of identity.accounts)rows.push(...accountRecords(account));
  const filtered=rows.filter(row=>(includeUnfeatured?isPublished(row):isDiscoverable(row))&&(!token||row.share_token===token)&&(!profileSlug||row.author_profile_slug===profileSlug)),unique=new Map();
  for(const row of filtered){const key=recordKey(row);if(!key)continue;const existing=unique.get(key);if(!existing||Date.parse(row.updated_at||0)>Date.parse(existing.updated_at||0))unique.set(key,row)}
  return{rows:[...unique.values()],accounts:identity.accounts,current:identity.current,bearer:identity.bearer};
 }
 router.get('/api/published-feed',async(req,res)=>{const{rows}=await collect(req),publications=rows.map(safeSummary).sort((a,b)=>new Date(b.published_at||b.updated_at||0)-new Date(a.published_at||a.updated_at||0)).slice(0,250);res.set('Cache-Control','public,max-age=15,stale-while-revalidate=60');res.json({publications})});
 router.get('/api/published-feed/:token',async(req,res)=>{const{rows,current}=await collect(req,{token:req.params.token,includeUnfeatured:true}),row=rows.find(item=>item.share_token===req.params.token),isOwner=Boolean(row&&current&&row.user_id===current.id);res.set('Cache-Control','no-store');return row?res.json({publication:safeDetail(row,isOwner)}):res.status(404).json({error:'This publication was not found or is no longer shared.'})});
 router.patch('/api/published-feed/:token/featured',async(req,res)=>{
  if(!base||!publishable)return res.status(503).json({error:'Account storage is unavailable.'});const bearer=String(req.get('authorization')||'').replace(/^Bearer\s+/i,'');if(!bearer)return res.status(401).json({error:'Sign in required.'});const accountResponse=await fetchImpl(`${base}/auth/v1/user`,{headers:{apikey:publishable,Authorization:`Bearer ${bearer}`}});if(!accountResponse.ok)return res.status(401).json({error:'Your session expired. Sign in again.'});const account=await readJson(accountResponse),featured=req.body?.featured!==false,spaces={...(account.user_metadata?.atlas_problem_spaces||{})},workspace={...(spaces.publishing_workspace||{})},records=workspace.notes||[],index=records.findIndex(row=>row.share_token===req.params.token&&row.user_id===account.id);
  if(index>=0){workspace.notes=upsertWorkspaceRecord(records,{...records[index],featured,updated_at:new Date().toISOString()});spaces.publishing_workspace=workspace;const metadata={...(account.user_metadata||{}),atlas_problem_spaces:spaces},response=await fetchImpl(`${base}/auth/v1/user`,{method:'PUT',headers:{apikey:publishable,Authorization:`Bearer ${bearer}`,'Content-Type':'application/json'},body:JSON.stringify({data:metadata})});if(!response.ok)return res.status(response.status).json({error:'Could not save publication visibility.'});return res.json({ok:true,featured})}
  try{const response=await fetchImpl(`${base}/rest/v1/workspace_notes?share_token=eq.${encodeURIComponent(req.params.token)}&user_id=eq.${encodeURIComponent(account.id)}`,{method:'PATCH',headers:{apikey:publishable,Authorization:`Bearer ${bearer}`,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({featured,updated_at:new Date().toISOString()})});if(response.ok)return res.json({ok:true,featured})}catch{}
  return res.status(404).json({error:'Publication not found in your account.'})
 });
 router.get('/api/profiles/:slug',async(req,res)=>{const slug=String(req.params.slug||''),identity=await accounts(req),account=identity.accounts.find(item=>item?.user_metadata?.atlas_profile?.profile_slug===slug),profile=account?.user_metadata?.atlas_profile;if(!profile)return res.status(404).json({error:'Profile not found.'});const{rows}=await collect(req,{profileSlug:slug}),publications=rows.map(safeSummary).sort((a,b)=>new Date(b.published_at||0)-new Date(a.published_at||0));res.set('Cache-Control','public,max-age=30,stale-while-revalidate=120');res.json({profile:{username:profile.username,avatar_seed:profile.avatar_seed,profile_slug:profile.profile_slug},publications})});
 return router;
}

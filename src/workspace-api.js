import express from 'express';
import crypto from 'node:crypto';
import {createProblemSpaceStorage} from './problem-space-storage.js';
import{supabaseSecretKey,supabaseServiceHeaders}from'./supabase-server-key.js';
import {metadataWorkspaceRecords,normalizeWorkspaceRecord,normalizeLegacyLegalRecord,newestRecord,sameResource,workspaceMetadataKey} from './workspace-records.js';

const text=(value,max=1000)=>String(value??'').trim().slice(0,max);
const route=handler=>async(req,res)=>{try{await handler(req,res)}catch(error){console.error('Workspace API:',error);res.status(error.status||500).json({error:error.message||'Workspace request failed.'})}};
const missingTable=(status,body)=>status===404||/Could not find the table|schema cache|PGRST205|relation .* does not exist/i.test(body||'');
const safeScriptJson=value=>JSON.stringify(value).replace(/</g,'\\u003c');

export function createWorkspaceRouter({env=process.env,fetchImpl=globalThis.fetch,storage=createProblemSpaceStorage({env,fetchImpl})}={}){
 const router=express.Router(),base=env.SUPABASE_URL,publishable=env.SUPABASE_PUBLISHABLE_KEY,secret=supabaseSecretKey(env);
 router.use('/api/workspaces-form',express.urlencoded({extended:false,limit:'3mb'}));
 router.use('/api/workspaces-form',(error,req,res,next)=>{
  if(!error)return next();
  const requestId=text(req.query?.request_id||req.body?.request_id,120),status=error.status||413;
  formReply(res,{type:'atlas-workspace-form-result',requestId,ok:false,status,error:status===413?'Workspace payload is too large to save. Shorten the analysis and retry.':(error.message||'Workspace form payload could not be read.')});
 });
 const timedFetch=async(url,options={})=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000);try{return await fetchImpl(url,{...options,signal:controller.signal})}finally{clearTimeout(timer)}};

 async function tableRows(table,query,token){
  if(!base||!publishable||!token)return[];
  try{
   const headers=secret?{...supabaseServiceHeaders(secret,{json:false}),Accept:'application/json'}:{apikey:publishable,Authorization:`Bearer ${token}`,Accept:'application/json'};
   const response=await timedFetch(`${base}/rest/v1/${table}${query}`,{headers}),body=await response.text();
   if(!response.ok){if(!missingTable(response.status,body))console.warn(`Optional ${table} workspace adapter returned ${response.status}: ${body.slice(0,240)}`);return[]}
   try{return body?JSON.parse(body):[]}catch{return[]}
  }catch(error){console.warn(`Optional ${table} workspace adapter is unavailable:`,error.message);return[]}
 }
 function metadataNotes(current){return metadataWorkspaceRecords(current?.user_metadata)}
 function virtualNotes(current){return current?.user_metadata?.atlas_virtual_tables?.workspace_notes||[]}
 async function candidates(current,token,resourceType,resourceId){
  const userId=current.id,rows=[];
  for(const item of metadataNotes(current))if(sameResource(item,resourceType,resourceId,userId))rows.push({...item,_store:item._store||'account-metadata'});
  for(const item of virtualNotes(current))if(sameResource(item,resourceType,resourceId,userId))rows.push({...item,_store:'virtual-metadata'});
  const workspace=await tableRows('workspace_notes',`?user_id=eq.${encodeURIComponent(userId)}&resource_type=eq.${encodeURIComponent(resourceType)}&resource_id=eq.${encodeURIComponent(resourceId)}&select=*&order=updated_at.desc&limit=5`,token);
  rows.push(...workspace.map(item=>({...item,_store:'workspace_notes'})));
  if(resourceType==='legal_case'){
   const legacy=await tableRows('legal_notes',`?user_id=eq.${encodeURIComponent(userId)}&case_slug=eq.${encodeURIComponent(resourceId)}&select=*&order=updated_at.desc&limit=5`,token);
   rows.push(...legacy.map(normalizeLegacyLegalRecord));
  }
  return rows;
 }
 async function persistMetadata(req,note){
  await storage.patchUser(req,()=>({[workspaceMetadataKey(note.resource_type,note.resource_id)]:note}));
  return note;
 }
 async function load(req,{migrate=true}={}){
  const{token,current}=await storage.requestUser(req),resourceType=text(req.params.resourceType,80),resourceId=text(req.params.resourceId,300);
  if(!resourceType||!resourceId)throw Object.assign(new Error('Resource type and ID are required.'),{status:400});
  const options=await candidates(current,token,resourceType,resourceId),selected=newestRecord(options);
  if(!selected||selected._deleted)return{token,current,note:null,source:selected?._store||'empty'};
  const normalized=normalizeWorkspaceRecord({...selected,user_id:current.id,resource_type:resourceType,resource_id:resourceId});
  if(migrate&&!['account-metadata','segmented-account-metadata'].includes(normalized._store)){
   const migrated=await persistMetadata(req,{...normalized,_store:'account-metadata'});
   return{token,current,note:migrated,source:`migrated-from-${normalized._store}`};
  }
  return{token,current,note:normalized,source:normalized._store||'account-metadata'};
 }
 async function saveWorkspace(req,body={}){
  const resourceType=text(req.params.resourceType,80),resourceId=text(req.params.resourceId,300);
  if(!resourceType||!resourceId)throw Object.assign(new Error('Resource type and ID are required.'),{status:400});
  let note=null,source='empty';
  await storage.patchUser(req,(metadata,current)=>{
   const selected=newestRecord(metadataWorkspaceRecords(metadata).filter(item=>sameResource(item,resourceType,resourceId,current.id))),existing=selected?._deleted?null:selected;
   if(existing)source='account-metadata';
   const profile=current.user_metadata?.atlas_profile||{},intent=body.intent==='publish'?'publish':'save',now=new Date().toISOString(),shared=body.is_shared===true,published=intent==='publish'||existing?.is_published===true||body.is_published===true,shareToken=existing?.share_token||(shared&&published?crypto.randomBytes(18).toString('base64url'):null);
   note=normalizeWorkspaceRecord({...existing,...body,
    id:existing?.id||crypto.randomUUID(),user_id:current.id,
    author_username:text(profile.username||body.author_username||'Atlas Author',120),author_avatar_seed:text(profile.avatar_seed||body.author_avatar_seed,240),author_profile_slug:text(profile.profile_slug||body.author_profile_slug,160),
    resource_type:resourceType,resource_id:resourceId,resource_title:text(body.resource_title||existing?.resource_title||'Analysis',300),title:text(body.title||existing?.title||'Untitled analysis',300),body:String(body.body||existing?.body||'').slice(0,60000),ai_prompt:String(body.ai_prompt||'').slice(0,12000),
    is_shared:shared,is_published:published,share_token:shareToken,published_at:published?(existing?.published_at||body.published_at||now):null,created_at:existing?.created_at||now,updated_at:now,featured:body.featured??existing?.featured??true,_store:'account-metadata'
   });
   return{[workspaceMetadataKey(resourceType,resourceId)]:note};
  });
  return{workspace:note,storage:'segmented-account-metadata',migratedFrom:source};
 }
 function formReply(res,payload){
  res.status(200).set('Cache-Control','no-store').type('html').send(`<!doctype html><meta charset="utf-8"><script>parent.postMessage(${safeScriptJson(payload)},location.origin)<\/script>`);
 }

 router.get('/api/workspaces/status',route(async(req,res)=>{
  const{current}=await storage.requestUser(req,{required:false});
  res.set('Cache-Control','no-store');
  res.json({ok:true,signedIn:Boolean(current),supabaseConfigured:Boolean(base&&publishable),serviceKeyConfigured:Boolean(secret),serviceKeyType:secret?(secret.startsWith('sb_secret_')?'opaque-secret':'legacy-service-role'):'none'});
 }));
 router.get('/api/workspaces/:resourceType/:resourceId',route(async(req,res)=>{
  const result=await load(req);
  res.set('Cache-Control','no-store');
  res.json({workspace:result.note,storage:result.source});
 }));
 router.put('/api/workspaces/:resourceType/:resourceId',route(async(req,res)=>{
  const result=await saveWorkspace(req,req.body||{});
  res.set('Cache-Control','no-store');
  res.json(result);
 }));
 router.post('/api/workspaces-form/:resourceType/:resourceId',async(req,res)=>{
  const requestId=text(req.query?.request_id||req.body?.request_id,120);
  try{
   const token=text(req.body?.access_token,12000);
   if(!token)throw Object.assign(new Error('Sign in required.'),{status:401});
   let body={};
   try{body=JSON.parse(String(req.body?.payload||'{}'))}catch{throw Object.assign(new Error('Workspace form payload is invalid.'),{status:400})}
   req.headers.authorization=`Bearer ${token}`;
   const result=await saveWorkspace(req,body);
   formReply(res,{type:'atlas-workspace-form-result',requestId,ok:true,status:200,...result});
  }catch(error){
   console.error('Workspace form fallback:',error);
   formReply(res,{type:'atlas-workspace-form-result',requestId,ok:false,status:error.status||500,error:error.message||'Workspace form save failed.'});
  }
 });
 return router;
}

import express from 'express';
import crypto from 'node:crypto';
import {createProblemSpaceStorage} from './problem-space-storage.js';
import {normalizeWorkspaceRecord,normalizeLegacyLegalRecord,newestRecord,sameResource,upsertWorkspaceRecord} from './workspace-records.js';

const SPACE='publishing_workspace';
const MAX_NOTES=250;
const text=(value,max=1000)=>String(value??'').trim().slice(0,max);
const route=handler=>async(req,res)=>{try{await handler(req,res)}catch(error){console.error('Workspace API:',error);res.status(error.status||500).json({error:error.message||'Workspace request failed.'})}};
const missingTable=(status,body)=>status===404||/Could not find the table|schema cache|PGRST205|relation .* does not exist/i.test(body||'');

export function createWorkspaceRouter({env=process.env,fetchImpl=globalThis.fetch,storage=createProblemSpaceStorage({env,fetchImpl})}={}){
 const router=express.Router(),base=env.SUPABASE_URL,publishable=env.SUPABASE_PUBLISHABLE_KEY;
 async function tableRows(table,query,token){
  if(!base||!publishable||!token)return[];
  try{
   const response=await fetchImpl(`${base}/rest/v1/${table}${query}`,{headers:{apikey:publishable,Authorization:`Bearer ${token}`,Accept:'application/json'}}),body=await response.text();
   if(!response.ok){if(!missingTable(response.status,body))console.warn(`Optional ${table} workspace adapter returned ${response.status}: ${body.slice(0,240)}`);return[]}
   try{return body?JSON.parse(body):[]}catch{return[]}
  }catch(error){console.warn(`Optional ${table} workspace adapter is unavailable:`,error.message);return[]}
 }
 async function mirrorWorkspaceTable(note,token,existingId=null){
  if(!base||!publishable||!token)return;
  const query=existingId?`?id=eq.${encodeURIComponent(existingId)}`:'',method=existingId?'PATCH':'POST';
  try{await fetchImpl(`${base}/rest/v1/workspace_notes${query}`,{method,headers:{apikey:publishable,Authorization:`Bearer ${token}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(note)})}catch{}
 }
 function metadataNotes(current){return current?.user_metadata?.atlas_problem_spaces?.[SPACE]?.notes||[]}
 function virtualNotes(current){return current?.user_metadata?.atlas_virtual_tables?.workspace_notes||[]}
 async function candidates(current,token,resourceType,resourceId){
  const userId=current.id,rows=[];
  for(const item of metadataNotes(current))if(sameResource(item,resourceType,resourceId,userId))rows.push({...item,_store:'account-metadata'});
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
  const saved=await storage.writeUser(req,SPACE,current=>({...current,notes:upsertWorkspaceRecord(current.notes||[],note,MAX_NOTES)}));
  return saved.value.notes.find(item=>item.id===note.id)||note;
 }
 async function load(req,{migrate=true}={}){
  const{token,current}=await storage.requestUser(req),resourceType=text(req.params.resourceType,80),resourceId=text(req.params.resourceId,300);
  if(!resourceType||!resourceId)throw Object.assign(new Error('Resource type and ID are required.'),{status:400});
  const options=await candidates(current,token,resourceType,resourceId),selected=newestRecord(options);
  if(!selected)return{token,current,note:null,source:'empty'};
  const normalized=normalizeWorkspaceRecord({...selected,user_id:current.id,resource_type:resourceType,resource_id:resourceId});
  if(migrate&&normalized._store!=='account-metadata'){
   const migrated=await persistMetadata(req,{...normalized,_store:'account-metadata'});
   return{token,current,note:migrated,source:`migrated-from-${normalized._store}`};
  }
  return{token,current,note:normalized,source:normalized._store||'account-metadata'};
 }
 router.get('/api/workspaces/:resourceType/:resourceId',route(async(req,res)=>{
  const result=await load(req);
  res.set('Cache-Control','no-store');
  res.json({workspace:result.note,storage:result.source});
 }));
 router.put('/api/workspaces/:resourceType/:resourceId',route(async(req,res)=>{
  const loaded=await load(req),current=loaded.current,existing=loaded.note,profile=current.user_metadata?.atlas_profile||{},body=req.body||{},intent=body.intent==='publish'?'publish':'save',now=new Date().toISOString(),shared=body.is_shared===true,published=intent==='publish'||existing?.is_published===true||body.is_published===true,shareToken=existing?.share_token||(shared&&published?crypto.randomBytes(18).toString('base64url'):null);
  const note=normalizeWorkspaceRecord({...existing,...body,
   id:existing?.id||crypto.randomUUID(),user_id:current.id,
   author_username:text(profile.username||body.author_username||'Atlas Author',120),author_avatar_seed:text(profile.avatar_seed||body.author_avatar_seed,240),author_profile_slug:text(profile.profile_slug||body.author_profile_slug,160),
   resource_type:text(req.params.resourceType,80),resource_id:text(req.params.resourceId,300),resource_title:text(body.resource_title||existing?.resource_title||'Analysis',300),title:text(body.title||existing?.title||'Untitled analysis',300),body:String(body.body||existing?.body||'').slice(0,60000),ai_prompt:String(body.ai_prompt||'').slice(0,12000),
   is_shared:shared,is_published:published,share_token:shareToken,published_at:published?(existing?.published_at||body.published_at||now):null,created_at:existing?.created_at||now,updated_at:now,featured:body.featured??existing?.featured??true,_store:'account-metadata'
  });
  const saved=await persistMetadata(req,note);
  mirrorWorkspaceTable(saved,loaded.token,existing?._store==='workspace_notes'?existing.id:null);
  res.set('Cache-Control','no-store');
  res.json({workspace:saved,storage:'account-metadata',migratedFrom:loaded.source});
 }));
 return router;
}

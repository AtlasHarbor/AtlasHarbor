import express from 'express';
import crypto from 'node:crypto';
import {supabaseSecretKey,supabaseServiceHeaders} from './supabase-server-key.js';

export const MOVEMENT_VERSES = Object.freeze({
 'Hebrews 10:24':'hebrews-10-24',
 'Galatians 6:2':'galatians-6-2',
 'Galatians 6:10':'galatians-6-10',
 'James 2:16':'james-2-16',
 '1 John 3:18':'1-john-3-18',
 'Luke 10:37':'luke-10-37',
 'Matthew 25:40':'matthew-25-40',
 'Acts 3:6':'acts-3-6',
 'Acts 4:35':'acts-4-35',
 'Ecclesiastes 4:10':'ecclesiastes-4-10',
 'Ecclesiastes 11:6':'ecclesiastes-11-6',
 'Proverbs 3:27':'proverbs-3-27'
});
export const minBeneficiaries = amount => amount > 0 ? Math.max(3,Math.ceil(3 * amount / 100)) : 1;
const clip=(v,n=1000)=>String(v??'').trim().slice(0,n);
const uuid=v=>/^[a-f0-9]{8}-[a-f0-9-]{27,40}$/i.test(String(v||''));
const email=v=>!v||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const publicRequestColumns='id,title,description,display_name,location_label,verse_ref,verse_url,how_help_others,repeatable_step,requested_amount,beneficiaries_target,status,prayer_count,no_money_yes,no_money_no,no_money_unsure,amount_spent,beneficiaries_verified,outcome_summary,created_at';
const publicIdeaColumns='id,request_id,display_name,body,kind,created_at';
export function validateMovementRequest(input={}){
 const title=clip(input.title,140),description=clip(input.description,3000),verse_ref=clip(input.verse_ref,48);
 const how_help_others=clip(input.how_help_others,1500),repeatable_step=clip(input.repeatable_step,1000);
 const requested_amount=Number(input.requested_amount||0),beneficiaries_target=Number(input.beneficiaries_target||0);
 const contact_email=clip(input.contact_email,160);
 if(title.length<8||description.length<30)throw Object.assign(new Error('Add a title and an explanation of at least 30 characters.'),{status:400});
 if(!Object.hasOwn(MOVEMENT_VERSES,verse_ref))throw Object.assign(new Error('Choose one of the verified The Way Version verses.'),{status:400});
 if(how_help_others.length<25||repeatable_step.length<15)throw Object.assign(new Error('Explain who helps others next and how that help can continue.'),{status:400});
 if(!Number.isFinite(requested_amount)||requested_amount<0||requested_amount>1000000)throw Object.assign(new Error('Invalid proposed budget.'),{status:400});
 if(!Number.isSafeInteger(beneficiaries_target)||beneficiaries_target<minBeneficiaries(requested_amount)||beneficiaries_target>1000000)throw Object.assign(new Error('The beneficiary target is too low for the proposed spending.'),{status:400});
 if(!email(contact_email))throw Object.assign(new Error('Enter a valid contact email or leave it blank.'),{status:400});
 return {title,description,how_help_others,repeatable_step,verse_ref,
   verse_url:'https://thewayversion.com/app/share/'+MOVEMENT_VERSES[verse_ref],
   display_name:clip(input.display_name,80)||'Community member',contact_email:contact_email||null,
   location_label:clip(input.location_label,100),requested_amount,beneficiaries_target};
}
export function createMovementRouter({env=process.env,fetchImpl=globalThis.fetch}={}){
 const router=express.Router(),base=String(env.SUPABASE_URL||'').replace(/\/$/,''),secret=supabaseSecretKey(env);
 const ready=Boolean(base&&secret),visitorSalt=env.MOVEMENT_VISITOR_SALT;
 const limiter=new Map();
 function noCache(res){res.set('Cache-Control','no-store')}
 function errors(fn){return async(req,res)=>{noCache(res);try{await fn(req,res)}catch(error){console.error('Movement:',error.message);res.status(error.status||503).json({error:error.status&&error.status<500?error.message:'Movement data is temporarily unavailable.'})}}}
 function throttle(req,category,limit=12){
   const address=req.ip||req.socket.remoteAddress||'unknown',now=Date.now(),key=category+':'+address;
   const entry=limiter.get(key)||{start:now,count:0};
   if(now-entry.start>600000){entry.start=now;entry.count=0}
   if(++entry.count>limit)throw Object.assign(new Error('Too many submissions; try again later.'),{status:429});
   limiter.set(key,entry);
   if(limiter.size>10000){for(const[k,v] of limiter)if(now-v.start>600000)limiter.delete(k)}
 }
 async function db(path,options={}){
   if(!ready)throw Object.assign(new Error('Movement database has not been configured.'),{status:503});
   const headers={...supabaseServiceHeaders(secret),...(options.headers||{})};
   const response=await fetchImpl(base+'/rest/v1/'+path,{...options,headers});
   const body=await response.text(),data=body?(()=>{try{return JSON.parse(body)}catch{return body}})():null;
   if(!response.ok){const error=new Error(data?.message||'Database error');error.status=response.status;throw error}
   return data;
 }
 const admin=req=>Boolean(env.MOVEMENT_ADMIN_TOKEN)&&crypto.timingSafeEqual(
   Buffer.from(crypto.createHash('sha256').update(clip(req.get('x-movement-admin-token'),250)).digest()),
   Buffer.from(crypto.createHash('sha256').update(env.MOVEMENT_ADMIN_TOKEN).digest()));
 function adminRequired(req){if(!admin(req))throw Object.assign(new Error('Administrator authorization required.'),{status:403})}
 router.get('/health',errors(async(_req,res)=>res.json({ok:true,dbConfigured:ready,prayersConfigured:Boolean(visitorSalt),paymentsEnabled:false,mode:'community-discussion'})));
 router.get('/verses',errors(async(_req,res)=>res.json({verses:Object.entries(MOVEMENT_VERSES).map(([reference,slug])=>({reference,url:'https://thewayversion.com/app/share/'+slug}))})));
 router.get('/requests',errors(async(req,res)=>{
   const rows=await db('movement_requests?select='+publicRequestColumns+'&order=created_at.desc&limit=60');
   res.json({requests:rows});
 }));
 router.get('/requests/:id',errors(async(req,res)=>{
   if(!uuid(req.params.id))return res.status(400).json({error:'Invalid request ID.'});
   const results=await Promise.all([
     db('movement_requests?select='+publicRequestColumns+'&id=eq.'+req.params.id+'&limit=1'),
     db('movement_ideas?select='+publicIdeaColumns+'&request_id=eq.'+req.params.id+'&order=created_at.asc&limit=100')
   ]);
   if(!results[0]?.length)return res.status(404).json({error:'Request not found.'});
   res.json({request:results[0][0],ideas:results[1]});
 }));
 router.post('/requests',errors(async(req,res)=>{
   throttle(req,'request',4);
   const row=validateMovementRequest(req.body);
   const created=await db('movement_requests?select='+publicRequestColumns,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(row)});
   res.status(201).json({request:created?.[0]});
 }));
 router.post('/requests/:id/ideas',errors(async(req,res)=>{
   throttle(req,'idea',14);
   if(!uuid(req.params.id))return res.status(400).json({error:'Invalid request ID.'});
   const body=clip(req.body?.body,1500),kind=clip(req.body?.kind,30);
   if(body.length<12||!['no-money','community-action','possible-funding'].includes(kind))return res.status(400).json({error:'Add a specific, useful idea and select its type.'});
   const created=await db('movement_ideas?select='+publicIdeaColumns,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({request_id:req.params.id,display_name:clip(req.body?.display_name,80)||'Community member',body,kind})});
   res.status(201).json({idea:created?.[0]});
 }));
 router.post('/requests/:id/prayers',errors(async(req,res)=>{
   throttle(req,'prayer',30);
   if(!uuid(req.params.id))return res.status(400).json({error:'Invalid request ID.'});
   if(!visitorSalt||visitorSalt.length<24)throw Object.assign(new Error('Prayer counting is not configured.'),{status:503});
   const visitorId=clip(req.body?.visitor_id,80);
   if(!uuid(visitorId))return res.status(400).json({error:'Invalid browser identity.'});
   const visitor_digest=crypto.createHmac('sha256',visitorSalt).update(visitorId).digest('hex');
   const created=await db('movement_prayers?on_conflict=request_id,visitor_digest&select=request_id',{
     method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},
     body:JSON.stringify({request_id:req.params.id,visitor_digest})});
   const rows=await db('movement_requests?select=id,prayer_count&id=eq.'+req.params.id+'&limit=1');
   if(!rows?.length)return res.status(404).json({error:'Request not found.'});
   res.json({count:rows[0].prayer_count,added:Boolean(created?.length)});
 }));
 router.post('/requests/:id/votes',errors(async(req,res)=>{
   throttle(req,'vote',30);
   if(!uuid(req.params.id))return res.status(400).json({error:'Invalid request ID.'});
   if(!visitorSalt||visitorSalt.length<24)throw Object.assign(new Error('Community voting is not configured.'),{status:503});
   const visitorId=clip(req.body?.visitor_id,80),answer=clip(req.body?.answer,12);
   if(!uuid(visitorId)||!['yes','no','unsure'].includes(answer))return res.status(400).json({error:'Invalid vote.'});
   const visitor_digest=crypto.createHmac('sha256',visitorSalt).update(visitorId).digest('hex');
   const created=await db('movement_votes?on_conflict=request_id,visitor_digest&select=request_id',{
      method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},
      body:JSON.stringify({request_id:req.params.id,visitor_digest,answer})});
   const rows=await db('movement_requests?select=id,no_money_yes,no_money_no,no_money_unsure&id=eq.'+req.params.id+'&limit=1');
   if(!rows?.length)return res.status(404).json({error:'Request not found.'});
   res.json({counts:{yes:rows[0].no_money_yes,no:rows[0].no_money_no,unsure:rows[0].no_money_unsure},added:Boolean(created?.length)});
 }));
 router.get('/admin/requests/:id/history',errors(async(req,res)=>{
   adminRequired(req);
   if(!uuid(req.params.id))return res.status(400).json({error:'Invalid request ID.'});
   const events=await db('movement_review_events?select=*&request_id=eq.'+req.params.id+'&order=created_at.asc&limit=200');
   res.json({events});
 }));
 router.get('/admin/requests',errors(async(req,res)=>{
   adminRequired(req);
   const rows=await db('movement_requests?select=*&order=created_at.desc&limit=100');
   res.json({requests:rows});
 }));
 router.patch('/admin/requests/:id',errors(async(req,res)=>{
   adminRequired(req);
   if(!uuid(req.params.id))return res.status(400).json({error:'Invalid request ID.'});
   const status=clip(req.body?.status,20);
   if(!['vetting','approved','declined','active','completed'].includes(status))return res.status(400).json({error:'Invalid review status.'});
   const video_verified=req.body?.video_verified===true,amount_spent=Number(req.body?.amount_spent||0),
     beneficiaries_verified=Number(req.body?.beneficiaries_verified||0);
   if(['approved','active','completed'].includes(status)&&!video_verified)return res.status(400).json({error:'A recorded Way Partners video review is required before money-related approval.'});
   if(!Number.isFinite(amount_spent)||amount_spent<0||!Number.isSafeInteger(beneficiaries_verified)||beneficiaries_verified<0)return res.status(400).json({error:'Invalid actual costs or people helped.'});
   if((status==='active'||status==='completed')&&amount_spent>0&&beneficiaries_verified<minBeneficiaries(amount_spent))return res.status(400).json({error:'Reported beneficiaries do not meet the three-per-$100 standard.'});
   const payload={status,video_verified,amount_spent,beneficiaries_verified,decision_note:clip(req.body?.decision_note,1800),
     outcome_summary:clip(req.body?.outcome_summary,2000),updated_at:new Date().toISOString()};
   const row=await db('movement_requests?id=eq.'+req.params.id+'&select='+publicRequestColumns,{
     method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
   if(!row?.length)return res.status(404).json({error:'Request not found.'});
   res.json({request:row[0]});
 }));
 return router;
}

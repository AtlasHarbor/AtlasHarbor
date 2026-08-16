import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createProblemSpacesService} from './problem-spaces.js';
import {createProblemSpaceStorage} from './problem-space-storage.js';
import {createAdminMetadataControl} from './admin-metadata-control.js';
import {createAdminResearchRouter} from './admin-research.js';
import {createEconomicsService} from './economics-service.js';
import {createEconomicsRouter} from './economics.js';
import {createDropshippingRouter} from './dropshipping-api.js';
import {createWorkspaceRouter} from './workspace-api.js';
import {createAccountSessionRouter} from './account-session-api.js';
import {createPublishedFeedRouter} from './published-feed.js';
import {createBaseballProspectRouter} from './baseball-prospect-router.js';
import {createBaseballSearchRouter} from './baseball-search-router.js';
import {createBaseballTeamLiveRouter} from './baseball-team-live-router.js';
import {createGameRoutingRouter} from './game-routing.js';
import {createGameFuelRouter} from './game-fuel.js';
import {createGameClientRouter} from './game-client.js';
import {createLegalService} from './legal.js';
import {createLegalRouter} from './legal-router.js';
import {createGoToMarketRouter} from './go-to-market.js';
import {createPropositionRouter} from './proposition.js';
import {createPublicPropositionRouter} from './proposition-public.js';
import {createResearchProjectsRouter} from './research-projects.js';
import {createResearchCredentialRouter} from './research-credentials.js';
import {createLifeSciencesRouter} from './life-sciences.js';
import {metadataWorkspaceRecords,newestRecord,normalizeWorkspaceRecord,workspaceMetadataKey} from './workspace-records.js';

const directory=path.dirname(fileURLToPath(import.meta.url));
const propText=(value,max=4000)=>String(value??'').trim().slice(0,max);
const propSlug=value=>propText(value,120).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,72)||'space-block';
const plainHtml=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/\s+/g,' ').trim();
function accountWorkspaceRows(metadata,userId){
 const grouped=new Map();
 for(const original of metadataWorkspaceRecords(metadata)){
  if(original?.user_id&&String(original.user_id)!==String(userId))continue;
  const row=normalizeWorkspaceRecord({...original,user_id:original.user_id||userId}),key=`${row.resource_type}:${row.resource_id}`;
  if(!grouped.has(key))grouped.set(key,[]);
  grouped.get(key).push(row);
 }
 return[...grouped.values()].map(newestRecord).filter(row=>row&&!row._deleted).sort((a,b)=>String(b.published_at||b.updated_at||'').localeCompare(String(a.published_at||a.updated_at||'')));
}
function safeRichHtml(value){
 let html=String(value||'').slice(0,60000).replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select)[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select)[^>]*\/?\s*>/gi,'');
 const allowed=new Set(['p','br','strong','b','em','i','u','h2','h3','ul','ol','li','blockquote','a']);
 html=html.replace(/<\/?([a-z0-9]+)([^>]*)>/gi,(whole,name,attrs)=>{const tag=String(name).toLowerCase(),closing=whole.startsWith('</');if(!allowed.has(tag))return'';if(closing)return tag==='br'?'':`</${tag}>`;if(tag==='br')return'<br>';if(tag!=='a')return`<${tag}>`;const match=String(attrs||'').match(/href\s*=\s*["']([^"']+)["']/i),href=match?.[1]?.trim()||'';if(!/^(https?:\/\/|\/)/i.test(href))return'<a>';const safe=href.replace(/["<>]/g,'');return`<a href="${safe}" rel="noopener noreferrer">`});
 return html;
}
export function createProblemRouter({service=createProblemSpacesService(),env=process.env}={}){
 const router=express.Router(),legal=createLegalService({env}),storage=createProblemSpaceStorage({env}),economicsService=createEconomicsService({storage,env});
 economicsService.startScheduler();legal.startScheduler();
 router.get('/runtime-config.js',(_req,res)=>{const configured=Boolean(env.SUPABASE_URL&&env.SUPABASE_PUBLISHABLE_KEY),payload={configured,supabaseUrl:configured?env.SUPABASE_URL:null,supabasePublishableKey:configured?env.SUPABASE_PUBLISHABLE_KEY:null};res.set('Cache-Control','no-store');res.type('application/javascript').send(`window.__ATLAS_CONFIG__=${JSON.stringify(payload)};`)});
 router.use(createGameClientRouter());router.use(createBaseballSearchRouter());router.use(createBaseballProspectRouter({legal}));router.use(createBaseballTeamLiveRouter());router.use(createGameRoutingRouter());router.use(createGameFuelRouter({env}));router.use(createLegalRouter({service:legal}));
 router.get(['/economics','/economics/{*path}'],(_req,res)=>res.sendFile(path.join(directory,'../public/economics.html')));
 router.get(['/prop','/prop/{*path}'],(_req,res)=>res.sendFile(path.join(directory,'../public/prop.html')));
 router.get(['/go-to-market','/go-to-market/{*path}'],(req,res)=>res.redirect(301,req.originalUrl.replace(/^\/go-to-market/,'/prop')));
 router.get(['/leads','/leads/{*path}'],(_req,res)=>res.sendFile(path.join(directory,'../public/leads.html')));
 router.get(['/logistics','/logistics/{*path}'],(_req,res)=>res.sendFile(path.join(directory,'../public/logistics-planner.html')));
 router.get(['/life-sciences','/life-sciences/{*path}'],(_req,res)=>res.sendFile(path.join(directory,'../public/life-sciences.html')));
 router.get(['/users/:slug','/users/:slug/{*path}'],(_req,res)=>res.sendFile(path.join(directory,'../public/profile.html')));
 router.get('/api/workspaces/account',async(req,res)=>{try{const{current}=await storage.requestUser(req),workspaces=accountWorkspaceRows(current.user_metadata,current.id);res.set('Cache-Control','no-store');return res.json({workspaces,storage:'segmented-account-metadata'})}catch(error){return res.status(error.status||500).json({error:error.message||'Could not load account work.'})}});
 router.patch('/api/workspaces/account/:id',async(req,res)=>{try{const id=propText(req.params.id,160);let workspace=null;await storage.patchUser(req,(metadata,current)=>{const existing=accountWorkspaceRows(metadata,current.id).find(item=>item.id===id);if(!existing)throw Object.assign(new Error('Workspace not found.'),{status:404});workspace={...existing,featured:req.body?.featured!==false,updated_at:new Date().toISOString(),_store:'segmented-account-metadata'};return{[workspaceMetadataKey(existing.resource_type,existing.resource_id)]:workspace}});return res.json({workspace,storage:'segmented-account-metadata'})}catch(error){return res.status(error.status||500).json({error:error.message||'Could not update account work.'})}});
 router.delete('/api/workspaces/account/:id',async(req,res)=>{try{const id=propText(req.params.id,160);let count=0;await storage.patchUser(req,(metadata,current)=>{const workspaces=accountWorkspaceRows(metadata,current.id),existing=workspaces.find(item=>item.id===id);if(!existing)throw Object.assign(new Error('Workspace not found.'),{status:404});count=workspaces.length-1;const tombstone={...existing,is_shared:false,is_published:false,share_token:null,published_at:null,_deleted:true,updated_at:new Date().toISOString(),_store:'segmented-account-metadata'};return{[workspaceMetadataKey(existing.resource_type,existing.resource_id)]:tombstone}});return res.json({ok:true,count,storage:'segmented-account-metadata'})}catch(error){return res.status(error.status||500).json({error:error.message||'Could not delete account work.'})}});
 const propState=async current=>storage.readGlobal('go_to_market',{fallbackCurrent:current,defaults:{version:2,reports:[]}});
 const propSave=(report,current)=>storage.writeGlobal('go_to_market',value=>({...value,version:Math.max(2,Number(value.version||2)),reports:[report,...(value.reports||[]).filter(item=>item.id!==report.id)].slice(0,160),updatedAt:new Date().toISOString()}),{fallbackCurrent:current});
 router.get('/api/prop/manual/mine',async(req,res)=>{try{const{current}=await storage.requestUser(req),state=await propState(current),blocks=(state.reports||[]).filter(item=>item.creation_mode==='manual'&&item.user_id===current.id).sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||''))).map(item=>({id:item.id,slug:item.slug,title:item.title,proposition_type:item.proposition_type,updated_at:item.updated_at}));res.set('Cache-Control','no-store');return res.json({blocks})}catch(error){return res.status(error.status||500).json({error:error.message||'Could not load Space Blocks.'})}});
 router.post('/api/prop/manual',async(req,res)=>{try{const{current}=await storage.requestUser(req),title=propText(req.body?.title,240),bodyHtml=safeRichHtml(req.body?.body_html),summary=propText(req.body?.summary||plainHtml(bodyHtml),1800);if(title.length<2)return res.status(400).json({error:'Add a title.'});if(plainHtml(bodyHtml).length<20)return res.status(400).json({error:'Add a problem statement or proposition body.'});const id=crypto.randomUUID(),now=new Date().toISOString(),block={id,slug:`${propSlug(title)}-${id.slice(0,8)}`,user_id:current.id,author_alias:propText(current.user_metadata?.atlas_profile?.username||'Atlas Author',80),title,project_name:title,proposition_type:propText(req.body?.proposition_type||'Manual proposition',120),organizations:[],website:propText(req.body?.source_url,800),proposition:summary,decision_requested:propText(req.body?.decision_requested,1800),executive_summary:summary,recommendation:'',call_to_action:propText(req.body?.decision_requested,1800),confidence:'preliminary',status:'published',creation_mode:'manual',body_html:bodyHtml,source_url:propText(req.body?.source_url,800),generated_at:now,updated_at:now,model:'manual',needs_refresh:false,metrics:[],evidence_summary:[],stakeholders:[],outcomes:[],alternatives:[],strategic_fit:{alignment:'',capabilities:[],dependencies:[]},success_metrics:[],objections:[],audience_segments:[],demand_signals:[],market_sizing:{currency:'USD',tam:0,sam:0,som:0,label:'',assumptions:[]},unit_economics:{currency:'USD',price:0,landed_cost:0,fulfillment:0,fees:0,marketing:0,contribution:0,margin_percent:0,break_even_units:0,notes:[]},budget:{currency:'USD',low:0,base:0,high:0,items:[],notes:[]},competitors:[],channels:[],funnel:[],implementation_plan:[],launch_plan:[],partnership:{ideal_partner:'',structure:'',partner_value:'',ask:'',terms:'',proof_needed:[]},creative_direction:{front:'',back:'',tag:'',materials:'',packaging:'',campaigns:[]},risks:[],experiments:[],sources:req.body?.source_url?[{title:'Source / reference',url:propText(req.body.source_url,800),publisher:'',date:'',claim:'User-supplied reference'}]:[],assumptions:[],research_gaps:[]};await propSave(block,current);await storage.writeUser(req,'manual_space_blocks',value=>({...value,items:[{id:block.id,title:block.title,proposition_type:block.proposition_type,updated_at:block.updated_at},...(value.items||[]).filter(item=>item.id!==block.id)].slice(0,160)}));return res.status(201).json({block})}catch(error){return res.status(error.status||500).json({error:error.message||'Could not create Space Block.'})}});
 router.patch('/api/prop/manual/:id',async(req,res)=>{try{const{current}=await storage.requestUser(req),state=await propState(current),existing=(state.reports||[]).find(item=>item.id===req.params.id&&item.creation_mode==='manual');if(!existing)return res.status(404).json({error:'Space Block not found.'});if(existing.user_id!==current.id)return res.status(403).json({error:'Only the creator can edit this Space Block.'});const title=propText(req.body?.title||existing.title,240),bodyHtml=safeRichHtml(req.body?.body_html??existing.body_html),summary=propText(req.body?.summary||plainHtml(bodyHtml),1800),updated={...existing,title,project_name:title,proposition_type:propText(req.body?.proposition_type||existing.proposition_type,120),website:propText(req.body?.source_url??existing.source_url,800),source_url:propText(req.body?.source_url??existing.source_url,800),proposition:summary,executive_summary:summary,decision_requested:propText(req.body?.decision_requested??existing.decision_requested,1800),call_to_action:propText(req.body?.decision_requested??existing.call_to_action,1800),body_html:bodyHtml,updated_at:new Date().toISOString()};await propSave(updated,current);await storage.writeUser(req,'manual_space_blocks',value=>({...value,items:[{id:updated.id,title:updated.title,proposition_type:updated.proposition_type,updated_at:updated.updated_at},...(value.items||[]).filter(item=>item.id!==updated.id)].slice(0,160)}));return res.json({block:updated})}catch(error){return res.status(error.status||500).json({error:error.message||'Could not update Space Block.'})}});
 router.use(createAccountSessionRouter({env}));router.use(createEconomicsRouter({service:economicsService,storage}));router.use(createDropshippingRouter({storage}));router.use(createPublicPropositionRouter({storage}));router.use(createPropositionRouter({storage}));router.use(createGoToMarketRouter({storage}));router.use(createResearchCredentialRouter({storage}));router.use(createResearchProjectsRouter({storage}));router.use(createLifeSciencesRouter({storage}));router.use(createWorkspaceRouter({env,storage}));router.use(createAdminMetadataControl({env}));router.use(createAdminResearchRouter({env,legalService:legal}));
 router.get('/api/published-feed',(req,_res,next)=>{delete req.headers.authorization;delete req.headers['x-atlas-session'];delete req.headers.cookie;next()});
 router.use(createPublishedFeedRouter({env}));
 const legacyAdminOk=req=>Boolean(env.ADMIN_PASSWORD)&&req.get('x-admin-password')===env.ADMIN_PASSWORD;
 router.get('/api/problem-spaces',async(_req,res)=>{try{return res.json({spaces:await service.listPublic()})}catch(error){console.error(error);return res.status(500).json({error:'Problem spaces are temporarily unavailable.'})}});
 router.post('/api/problem-spaces/requests',async(req,res)=>{try{return res.status(201).json({request:await service.create(req.body||{})})}catch(error){return res.status(400).json({error:error.message})}});
 router.get('/api/admin/problem-spaces',async(req,res)=>{if(!legacyAdminOk(req))return res.status(401).json({error:'Use the signed-in admin dashboard for approvals.'});try{return res.json({requests:await service.listAdmin()})}catch(error){console.error(error);return res.status(500).json({error:'Admin queue is temporarily unavailable.'})}});
 router.patch('/api/admin/problem-spaces/:id',async(req,res)=>{if(!legacyAdminOk(req))return res.status(401).json({error:'Use the signed-in admin dashboard for approvals.'});try{const row=await service.update(req.params.id,String(req.body?.status||''));return row?res.json({request:row}):res.status(404).json({error:'Request not found.'})}catch(error){return res.status(400).json({error:error.message})}});return router;
}

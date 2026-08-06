import express from 'express';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createProblemSpacesService} from './problem-spaces.js';
import {createProblemSpaceStorage} from './problem-space-storage.js';
import {createAdminMetadataControl} from './admin-metadata-control.js';
import {createAdminResearchRouter} from './admin-research.js';
import {createEconomicsService} from './economics-service.js';
import {createEconomicsRouter} from './economics.js';
import {createDropshippingRouter} from './dropshipping-api.js';
import {createWorkspaceRouter} from './workspace-api.js';
import {createPublishedFeedRouter} from './published-feed.js';
import {createBaseballProspectRouter} from './baseball-prospect-router.js';
import {createGameRoutingRouter} from './game-routing.js';
import {createGameClientRouter} from './game-client.js';
import {createLegalService} from './legal.js';
import {createLegalRouter} from './legal-router.js';
import {createGoToMarketRouter} from './go-to-market.js';
import {createPropositionRouter} from './proposition.js';
import {createPublicPropositionRouter} from './proposition-public.js';

const directory=path.dirname(fileURLToPath(import.meta.url));
export function createProblemRouter({service=createProblemSpacesService(),env=process.env}={}){
 const router=express.Router(),legal=createLegalService({env}),storage=createProblemSpaceStorage({env}),economicsService=createEconomicsService({storage,env});
 economicsService.startScheduler();
 legal.startScheduler();
 router.use(createGameClientRouter());
 router.use(createBaseballProspectRouter({legal}));
 router.use(createGameRoutingRouter());
 router.use(createLegalRouter({service:legal}));
 router.get(['/economics','/economics/{*path}'],(_req,res)=>res.sendFile(path.join(directory,'../public/economics.html')));
 router.get(['/prop','/prop/{*path}'],(_req,res)=>res.sendFile(path.join(directory,'../public/prop.html')));
 router.get(['/go-to-market','/go-to-market/{*path}'],(req,res)=>res.redirect(301,req.originalUrl.replace(/^\/go-to-market/,'/prop')));
 router.get(['/users/:slug','/users/:slug/{*path}'],(_req,res)=>res.sendFile(path.join(directory,'../public/profile.html')));
 // Metadata-backed Problem Space APIs are mounted before legacy control routes so
 // they work without manually creating Supabase tables.
 router.use(createEconomicsRouter({service:economicsService,storage}));
 router.use(createDropshippingRouter({storage}));
 // Public reads have an example fallback and do not depend on Supabase auth being reachable.
 router.use(createPublicPropositionRouter({storage}));
 router.use(createPropositionRouter({storage}));
 // Preserve the former API for existing clients and saved integrations.
 router.use(createGoToMarketRouter({storage}));
 router.use(createWorkspaceRouter({env,storage}));
 router.use(createAdminMetadataControl({env}));
 router.use(createAdminResearchRouter({env,legalService:legal}));
 router.use(createPublishedFeedRouter({env}));
 const legacyAdminOk=req=>Boolean(env.ADMIN_PASSWORD)&&req.get('x-admin-password')===env.ADMIN_PASSWORD;
 router.get('/api/problem-spaces',async(_req,res)=>{try{return res.json({spaces:await service.listPublic()})}catch(error){console.error(error);return res.status(500).json({error:'Problem spaces are temporarily unavailable.'})}});
 router.post('/api/problem-spaces/requests',async(req,res)=>{try{return res.status(201).json({request:await service.create(req.body||{})})}catch(error){return res.status(400).json({error:error.message})}});
 router.get('/api/admin/problem-spaces',async(req,res)=>{if(!legacyAdminOk(req))return res.status(401).json({error:'Use the signed-in admin dashboard for approvals.'});try{return res.json({requests:await service.listAdmin()})}catch(error){console.error(error);return res.status(500).json({error:'Admin queue is temporarily unavailable.'})}});
 router.patch('/api/admin/problem-spaces/:id',async(req,res)=>{if(!legacyAdminOk(req))return res.status(401).json({error:'Use the signed-in admin dashboard for approvals.'});try{const row=await service.update(req.params.id,String(req.body?.status||''));return row?res.json({request:row}):res.status(404).json({error:'Request not found.'})}catch(error){return res.status(400).json({error:error.message})}});
 return router;
}

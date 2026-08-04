import express from 'express';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createProblemSpacesService} from './problem-spaces.js';
import {createAdminMetadataControl} from './admin-metadata-control.js';
import {createEconomicsRouter} from './economics.js';
import {createPublishedFeedRouter} from './published-feed.js';

const directory=path.dirname(fileURLToPath(import.meta.url));
export function createProblemRouter({service=createProblemSpacesService(),env=process.env}={}){
 const router=express.Router();
 router.get(['/economics','/economics/{*path}'],(_req,res)=>res.sendFile(path.join(directory,'../public/economics.html')));
 router.use(createAdminMetadataControl({env}));
 router.use(createEconomicsRouter({env}));
 router.use(createPublishedFeedRouter({env}));
 const legacyAdminOk=req=>Boolean(env.ADMIN_PASSWORD)&&req.get('x-admin-password')===env.ADMIN_PASSWORD;
 router.get('/api/problem-spaces',async(_req,res)=>{try{return res.json({spaces:await service.listPublic()})}catch(error){console.error(error);return res.status(500).json({error:'Problem spaces are temporarily unavailable.'})}});
 router.post('/api/problem-spaces/requests',async(req,res)=>{try{return res.status(201).json({request:await service.create(req.body||{})})}catch(error){return res.status(400).json({error:error.message})}});
 router.get('/api/admin/problem-spaces',async(req,res)=>{if(!legacyAdminOk(req))return res.status(401).json({error:'Use the signed-in admin dashboard for approvals.'});try{return res.json({requests:await service.listAdmin()})}catch(error){console.error(error);return res.status(500).json({error:'Admin queue is temporarily unavailable.'})}});
 router.patch('/api/admin/problem-spaces/:id',async(req,res)=>{if(!legacyAdminOk(req))return res.status(401).json({error:'Use the signed-in admin dashboard for approvals.'});try{const row=await service.update(req.params.id,String(req.body?.status||''));return row?res.json({request:row}):res.status(404).json({error:'Request not found.'})}catch(error){return res.status(400).json({error:error.message})}});
 return router;
}

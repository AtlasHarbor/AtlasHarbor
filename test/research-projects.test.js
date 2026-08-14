import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
import express from'express';
import{createResearchProjectsRouter}from'../src/research-projects.js';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('lead and logistics pages reuse the resilient workspace',()=>{for(const file of['public/leads.html','public/logistics-planner.html']){const html=read(file);assert.match(html,/research-projects\.js/);assert.match(html,/workspace\.css/)}const client=read('public/research-projects.js');assert.match(client,/mountWorkspace/);assert.match(client,/installWorkspaceScopeToggle/);assert.match(client,/\/api\/workspaces|workspace-scope-toggle/);assert.doesNotMatch(client,/supabaseUrl.*rest\/v1/s)});

test('provider keys remain browser local',()=>{const client=read('public/research-projects.js'),account=read('public/account-provider-keys.js');assert.match(client,/localStorage\.getItem/);assert.match(client,/atlas-apollo-key/);assert.match(client,/atlas-perplexity-key/);assert.match(account,/localStorage/);assert.doesNotMatch(account,/updateUserMetadata|rest\/v1/)});

test('research projects use metadata storage and no schema migration',()=>{const server=read('src/research-projects.js');assert.match(server,/storage\.readUser/);assert.match(server,/storage\.writeUser/);assert.match(server,/lead_discovery/);assert.match(server,/logistics_planner/);assert.doesNotMatch(server,/CREATE TABLE|ALTER TABLE|workspace_notes\?on_conflict/)});

test('workspace recovery contract is documented',()=>{const docs=read('docs/WORKSPACE_ARCHITECTURE.md'),root=read('README.md');assert.match(docs,/One writable database source of truth\. One same-origin API boundary\./);assert.match(docs,/workspace_notes/);assert.match(docs,/legacy_notes|legal_notes/);assert.match(docs,/sb_secret_/);assert.match(root,/docs\/WORKSPACE_ARCHITECTURE\.md/)});

test('public research is available only after explicit full attachment',async()=>{const account={user_metadata:{atlas_problem_spaces:{lead_discovery:{projects:[{slug:'qualified-leads',title:'Qualified leads'}]},publishing_workspace:{notes:[{resource_type:'lead_project',resource_id:'qualified-leads',is_shared:true,is_published:true,share_scope:'everything'}]}}}};const storage={listAccounts:async()=>[account],readUser:async()=>({value:{projects:[]}}),writeUser:async()=>({})};const app=express();app.use(express.json());app.use(createResearchProjectsRouter({storage,fetchImpl:fetch}));const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve));try{const base=`http://127.0.0.1:${server.address().port}`,response=await fetch(`${base}/api/public-research/lead_project/qualified-leads`),data=await response.json();assert.equal(response.status,200);assert.equal(data.project.title,'Qualified leads');account.user_metadata.atlas_problem_spaces.publishing_workspace.notes[0].share_scope='page';const privateResponse=await fetch(`${base}/api/public-research/lead_project/qualified-leads`);assert.equal(privateResponse.status,404)}finally{await new Promise(resolve=>server.close(resolve))}});

test('navigation and directory register both spaces',()=>{const nav=read('public/problem-nav.js'),spaces=read('src/problem-spaces.js'),router=read('src/problem-router.js');for(const value of['/leads','/logistics']){assert.match(nav,new RegExp(value));assert.match(spaces,new RegExp(value));assert.match(router,new RegExp(value))}});

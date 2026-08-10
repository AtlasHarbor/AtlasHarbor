import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import express from 'express';
import {createPublishedFeedRouter} from '../src/published-feed.js';

const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});

test('signed-in and signed-out feeds use the same anonymous public table visibility',async t=>{
 const publicRow={id:'pub-row-1',user_id:'author-1',resource_type:'legal_case',resource_id:'case-1',resource_title:'Example case',title:'Example analysis',body:'<p>Published</p>',is_shared:true,is_published:true,featured:true,share_token:'short-public-token',published_at:'2026-08-10T12:00:00.000Z',updated_at:'2026-08-10T12:00:00.000Z'};
 const current={id:'viewer-1',user_metadata:{atlas_profile:{username:'Viewer'}}};
 const tableAuthorization=[];
 const fetchImpl=async(url,options={})=>{
  const target=String(url);
  if(target.includes('/auth/v1/user'))return json(current);
  if(target.includes('/rest/v1/workspace_notes')){tableAuthorization.push(options.headers?.Authorization||options.headers?.authorization||null);return json([publicRow])}
  if(target.includes('/rest/v1/legal_notes')){tableAuthorization.push(options.headers?.Authorization||options.headers?.authorization||null);return json([])}
  throw new Error(`Unexpected mocked request: ${target}`);
 };
 const app=express();app.use(express.json());app.use(createPublishedFeedRouter({env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'publishable'},fetchImpl}));
 const server=app.listen(0,'127.0.0.1');t.after(()=>server.close());await once(server,'listening');const {port}=server.address();
 const signedOut=await fetch(`http://127.0.0.1:${port}/api/published-feed`).then(r=>r.json());
 const signedIn=await fetch(`http://127.0.0.1:${port}/api/published-feed`,{headers:{Authorization:'Bearer viewer-token'}}).then(r=>r.json());
 assert.deepEqual(signedOut.publications.map(row=>row.share_token),['short-public-token']);
 assert.deepEqual(signedIn.publications.map(row=>row.share_token),['short-public-token']);
 assert.ok(tableAuthorization.length>=4);
 assert.ok(tableAuthorization.every(value=>value===null),'public table reads must never inherit the viewer bearer token');
});

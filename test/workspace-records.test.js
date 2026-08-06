import test from 'node:test';
import assert from 'node:assert/strict';
import{normalizeLegacyLegalRecord,newestRecord,upsertWorkspaceRecord,isDiscoverable}from'../src/workspace-records.js';

test('legacy legal notes preserve embedded publications',()=>{const row=normalizeLegacyLegalRecord({id:'7',user_id:'u',case_slug:'case-a',title:'Old',body:'ATLAS_WORKSPACE_V1\n'+JSON.stringify({title:'Published view',body:'<p>x</p>',is_shared:true,is_published:true,resource_title:'Case A'}),updated_at:'2026-08-05T10:00:00Z'});assert.equal(row.resource_type,'legal_case');assert.equal(row.resource_id,'case-a');assert.equal(row.title,'Published view');assert.ok(row.share_token.startsWith('legacy-'));assert.equal(isDiscoverable(row),true)});
test('newest record wins across storage adapters',()=>{const value=newestRecord([{id:'a',updated_at:'2026-08-01',title:'old'},{id:'b',updated_at:'2026-08-05',title:'new'}]);assert.equal(value.title,'new')});
test('upsert replaces a shared token without duplicating it',()=>{const rows=upsertWorkspaceRecord([{id:'a',share_token:'same',updated_at:'2026-08-01'}],{id:'b',share_token:'same',updated_at:'2026-08-05',title:'new'});assert.equal(rows.length,1);assert.equal(rows[0].title,'new')});

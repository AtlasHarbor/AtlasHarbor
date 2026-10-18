import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../supabase/movement.sql',import.meta.url),'utf8');
test('all movement relations are private and database triggers use balanced SQL quotations',()=>{
 for(const table of ['movement_requests','movement_ideas','movement_prayers','movement_votes','movement_review_events']){
  assert.match(source,new RegExp('create table if not exists public\\.'+table+'\\s*\\('));
  assert.ok(source.includes('alter table public.'+table+' enable row level security;'));
 }
 const open=[...source.matchAll(/\bas (\$[a-z]*\$)/g)].map(m=>m[1]);
 assert.equal(open.length,3,'expected three trigger function bodies');
 for(const quote of open){
  assert.equal(source.split(quote).length-1,quote==='$$'?2:4);
 }
 assert.match(source,/revoke all on public\.movement_requests.*from anon,authenticated/);
 assert.match(source,/author_id uuid/);
 assert.match(source,/movement_review_events/);
});

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'data/legal/cases');
const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY;
if(!url||!key){console.error('SUPABASE_URL and SUPABASE_SECRET_KEY are required.');process.exit(1)}
const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'};
async function upsert(table,rows,onConflict){if(!rows.length)return;const r=await fetch(`${url}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`,{method:'POST',headers,body:JSON.stringify(rows)});if(!r.ok)throw new Error(`${table}: ${r.status} ${await r.text()}`)}
const files=(await fs.readdir(dir)).filter(f=>f.endsWith('.json')).sort();
for(const file of files){const c=JSON.parse(await fs.readFile(path.join(dir,file),'utf8'));const now=new Date().toISOString();
  await upsert('legal_cases',[{slug:c.slug,title:c.title,short_title:c.shortTitle,status:c.status,jurisdiction:c.jurisdiction,court:c.court,docket_number:c.indexNumber||c.docketNumber||null,filed_at:c.filedAt||null,matter_type:c.matterType||null,procedural_stage:c.proceduralStage||null,allegation_status:c.allegationStatus||null,core_question:c.coreQuestion||null,summary:c.summary||c.analysis?.importance||null,record:c,last_verified_at:c.lastVerifiedAt||null,updated_at:now}], 'slug');
  const events=(c.timeline||[]).map((e,i)=>({case_slug:c.slug,event_key:`${e.date||'unknown'}-${i}`,event_date:e.date||null,event_type:e.type||'procedural',description:e.event||e.description||'',source_url:e.sourceUrl||null,record:e}));
  await upsert('legal_case_events',events,'case_slug,event_key');
  const sources=(c.sources||[]).map((s,i)=>({case_slug:c.slug,source_key:`${i}-${s.url}`,title:s.title||s.url,url:s.url,source_type:s.type||s.sourceType||'secondary',verified_at:s.verifiedAt||null,record:s}));
  await upsert('legal_case_sources',sources,'case_slug,source_key');
  const tags=[...(c.jurisdictionTags||[]).map(v=>['jurisdiction',v]),...(c.lawTopics||[]).map(v=>['law_topic',v]),...(c.keywords||[]).map(v=>['keyword',v])].map(([kind,value])=>({case_slug:c.slug,tag_kind:kind,tag_value:String(value).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''),display_value:String(value)}));
  await upsert('legal_case_tags',tags,'case_slug,tag_kind,tag_value');
  console.log(`Seeded ${c.slug}`);
}
console.log(`Seeded ${files.length} legal cases.`);

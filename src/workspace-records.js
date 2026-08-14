import crypto from 'node:crypto';

const text=value=>String(value??'').trim();
const bool=value=>value===true||value==='true';
const dateValue=value=>{const time=Date.parse(value||'');return Number.isFinite(time)?time:0};
export const WORKSPACE_METADATA_PREFIX='atlas_workspace_record_v2_';
const cleanScenarios=value=>{
 let rows=value;
 if(typeof rows==='string')try{rows=JSON.parse(rows)}catch{rows=[]}
 return(Array.isArray(rows)?rows:[]).map(item=>({label:text(item?.label),date:text(item?.date),probability:item?.probability==null?'':String(item.probability)})).filter(item=>item.label||item.date||item.probability!=='').slice(0,20);
};

export function legacyShareToken(row={}){
 const source=text(row.id||row.share_token||`${row.user_id}:${row.case_slug}:${row.updated_at}`);
 return source?`legacy-${crypto.createHash('sha256').update(source).digest('base64url').slice(0,24)}`:null;
}

export function normalizeWorkspaceRecord(input={},fallback={}){
 const row={...fallback,...input};
 return{
  id:text(row.id)||null,
  user_id:text(row.user_id)||text(fallback.user_id)||null,
  author_username:text(row.author_username)||'Atlas Author',
  author_avatar_seed:text(row.author_avatar_seed),
  author_profile_slug:text(row.author_profile_slug),
  resource_type:text(row.resource_type)||text(fallback.resource_type)||'analysis',
  resource_id:text(row.resource_id)||text(fallback.resource_id),
  resource_title:text(row.resource_title)||text(fallback.resource_title)||'Analysis',
  title:text(row.title)||'Untitled analysis',
  body:String(row.body||''),
  ai_prompt:String(row.ai_prompt||''),
  projections:cleanScenarios(row.projections),
  is_shared:bool(row.is_shared),
  is_published:bool(row.is_published),
  share_token:text(row.share_token)||null,
  share_scope:text(row.share_scope)||'page',
  share_ai_analysis:row.share_ai_analysis!==false,
  featured:row.featured!==false,
  comments_enabled:bool(row.comments_enabled),
  created_at:row.created_at||row.updated_at||new Date().toISOString(),
  updated_at:row.updated_at||row.created_at||new Date().toISOString(),
  published_at:row.published_at||null,
  _deleted:bool(row._deleted),
  _store:text(row._store)||text(fallback._store)||null
 };
}

export function normalizeLegacyLegalRecord(row={}){
 let payload={};
 const raw=String(row.body||'');
 try{payload=JSON.parse(raw.replace(/^ATLAS_WORKSPACE_V1\n/,''))}catch{payload={body:raw}}
 const published=payload.is_published===true||row.is_published===true||Boolean(row.share_token||payload.share_token);
 const shared=payload.is_shared===true||row.is_shared===true;
 return normalizeWorkspaceRecord({...payload,
  id:row.id||payload.id,
  user_id:row.user_id||payload.user_id,
  resource_type:'legal_case',
  resource_id:row.case_slug||payload.resource_id,
  resource_title:payload.resource_title||payload.title||row.title||'Legal analysis',
  title:payload.title||row.title,
  body:payload.body??raw,
  is_shared:shared,
  is_published:published,
  share_token:row.share_token||payload.share_token||(shared&&published?legacyShareToken(row):null),
  created_at:row.created_at||payload.created_at,
  updated_at:row.updated_at||payload.updated_at,
  published_at:row.published_at||payload.published_at||(published?(row.updated_at||payload.updated_at):null),
  _store:'legacy-legal-notes'
 });
}

export function recordKey(row={}){
 return text(row.share_token)||text(row.id)||`${text(row.user_id)}:${text(row.resource_type)}:${text(row.resource_id)}`;
}

export function workspaceMetadataKey(resourceType,resourceId){
 const identity=`${text(resourceType)}:${text(resourceId)}`;
 return`${WORKSPACE_METADATA_PREFIX}${crypto.createHash('sha256').update(identity).digest('hex').slice(0,32)}`;
}

export function metadataWorkspaceRecords(metadata={}){
 const primary=metadata?.atlas_problem_spaces?.publishing_workspace?.notes,rows=Array.isArray(primary)?[...primary]:[];
 for(const[key,value]of Object.entries(metadata||{}))if(key.startsWith(WORKSPACE_METADATA_PREFIX)&&value&&typeof value==='object')rows.push({...value,_store:value._store||'segmented-account-metadata'});
 return rows;
}

export function sameResource(row={},resourceType,resourceId,userId=null){
 return text(row.resource_type)===text(resourceType)&&text(row.resource_id)===text(resourceId)&&(!userId||text(row.user_id)===text(userId));
}

export function newestRecord(records=[]){
 return records.filter(Boolean).map(item=>normalizeWorkspaceRecord(item)).sort((a,b)=>dateValue(b.updated_at||b.published_at)-dateValue(a.updated_at||a.published_at))[0]||null;
}

export function upsertWorkspaceRecord(records=[],record,max=250){
 const normalized=normalizeWorkspaceRecord(record),next=(Array.isArray(records)?records:[]).map(item=>normalizeWorkspaceRecord(item)).filter(item=>{
  const sameId=Boolean(normalized.id&&item.id&&normalized.id===item.id);
  const sameToken=Boolean(normalized.share_token&&item.share_token&&normalized.share_token===item.share_token);
  const sameScopedResource=Boolean(normalized.resource_type&&normalized.resource_id&&item.user_id===normalized.user_id&&sameResource(item,normalized.resource_type,normalized.resource_id));
  return!sameId&&!sameToken&&!sameScopedResource;
 });
 next.push(normalized);
 return next.sort((a,b)=>dateValue(a.updated_at)-dateValue(b.updated_at)).slice(-Math.max(1,max));
}

export const isPublished=row=>Boolean(row&&row.is_shared&&row.is_published&&row.share_token);
export const isDiscoverable=row=>isPublished(row)&&row.featured!==false;

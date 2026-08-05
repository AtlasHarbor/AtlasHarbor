const API_BASE='https://www.courtlistener.com/api/rest/v4';
const SITE_BASE='https://www.courtlistener.com';
const STORAGE_BASE='https://storage.courtlistener.com';
const FIVE_MINUTES=5*60*1000;

const text=value=>String(value??'').trim();
const absolute=(value,base=SITE_BASE)=>{if(!value)return null;try{return new URL(value,base).toString()}catch{return null}};
const compactObject=value=>Object.fromEntries(Object.entries(value).filter(([,item])=>item!==null&&item!==undefined&&item!==''));

export function courtListenerDocumentUrl(filepath){
 if(!filepath)return null;
 if(/^https?:\/\//i.test(filepath))return filepath;
 return`${STORAGE_BASE}/${String(filepath).replace(/^\/+/, '')}`;
}

export function extractCourtListenerHints(record={}){
 const hints={...(record.courtListener||{})};
 const sources=[...(record.sources||[]),...(record.documents||[])];
 for(const source of sources){
  const url=text(source?.url||source?.pdfUrl||source?.courtListenerUrl);
  let match=url.match(/courtlistener\.com\/(?:api\/rest\/v4\/)?dockets?\/(\d+)/i);
  if(match&&!hints.docketId)hints.docketId=Number(match[1]);
  match=url.match(/gov\.uscourts\.([a-z0-9-]+)\.(\d+)/i);
  if(match){hints.courtId=hints.courtId||match[1];hints.pacerCaseId=hints.pacerCaseId||match[2]}
 }
 const identifier=text(record.indexNumber||record.docketNumber||hints.docketNumber);
 if(identifier)hints.docketNumber=hints.docketNumber||identifier;
 const title=text(record.title||record.shortTitle);
 // The supplied RECAP complaint is the Haley property-damage action against X.AI.
 if((/haley/i.test(title)&&/x\.?ai/i.test(title))||/3:?2026cv00148|3:26-cv-00148/i.test(identifier)){
  hints.courtId='msnd';hints.pacerCaseId='52569';hints.docketNumber='3:26-cv-00148';
  hints.seedDocumentUrl='https://storage.courtlistener.com/recap/gov.uscourts.msnd.52569/gov.uscourts.msnd.52569.1.0.pdf';
 }
 return compactObject(hints);
}

function normalizedDocument(document,entry={}){
 const id=Number(document?.id)||null,filepath=document?.filepath_local||document?.filepath_ia||null;
 return compactObject({
  id:id?String(id):text(document?.pacer_doc_id)||null,
  courtListenerId:id,
  entryId:entry.id?String(entry.id):null,
  entryNumber:entry.entry_number??entry.entryNumber??null,
  documentNumber:document?.document_number??document?.documentNumber??entry.entry_number??null,
  attachmentNumber:document?.attachment_number??document?.attachmentNumber??null,
  dateFiled:entry.date_filed||document?.date_filed||null,
  description:text(document?.description||document?.short_description||entry.description)||'Court filing',
  pageCount:document?.page_count??null,
  isAvailable:Boolean(document?.is_available||filepath),
  pdfUrl:courtListenerDocumentUrl(filepath),
  courtListenerUrl:absolute(document?.absolute_url),
  pacerDocumentId:text(document?.pacer_doc_id)||null,
  ocrStatus:document?.ocr_status??null,
  sha1:text(document?.sha1)||null
 });
}

function normalizedEntry(entry){
 const documents=(entry?.recap_documents||entry?.documents||[]).map(item=>normalizedDocument(item,entry));
 return compactObject({
  id:String(entry?.id||''),
  entryNumber:entry?.entry_number??null,
  dateFiled:entry?.date_filed||null,
  description:text(entry?.description)||documents.map(item=>item.description).filter(Boolean).join('; ')||'Docket entry',
  courtListenerUrl:absolute(entry?.absolute_url),
  documents
 });
}

function normalizedParty(party){
 const roles=(party?.party_types||[]).map(item=>compactObject({role:item.name,dateTerminated:item.date_terminated,extraInfo:text(item.extra_info)||null}));
 const attorneys=(party?.attorneys||[]).map(item=>compactObject({name:text(item.attorney_name||item.name)||null,role:item.role??null,attorneyId:item.attorney_id??null}));
 return compactObject({id:String(party?.id||''),name:text(party?.name)||'Unnamed party',extraInfo:text(party?.extra_info)||null,roles,attorneys});
}

export function createCourtListenerClient({env=process.env,fetchImpl=globalThis.fetch}={}){
 const token=env.COURTLISTENER_API_TOKEN||'',cache=new Map();
 const headers=()=>({Accept:'application/json','User-Agent':'AtlasHarbor/1.0 (+legal research tracker)',...(token?{Authorization:`Token ${token}`}:{})});
 const cacheKey=(path,query)=>`${path}?${new URLSearchParams(query||{}).toString()}`;
 async function request(path,{query={},timeout=30000,useCache=true}={}){
  const key=cacheKey(path,query),existing=cache.get(key);
  if(useCache&&existing&&Date.now()-existing.at<FIVE_MINUTES)return structuredClone(existing.value);
  const url=new URL(/^https?:\/\//i.test(path)?path:`${API_BASE}${path}`);
  for(const [name,value] of Object.entries(query||{}))if(value!==null&&value!==undefined&&value!=='')url.searchParams.set(name,String(value));
  const response=await fetchImpl(url,{headers:headers(),signal:AbortSignal.timeout(timeout)});
  const body=await response.text();let data={};try{data=body?JSON.parse(body):{}}catch{}
  if(!response.ok){const error=new Error(data?.detail||data?.message||body||`CourtListener returned ${response.status}.`);error.status=response.status;throw error}
  if(useCache)cache.set(key,{at:Date.now(),value:data});return structuredClone(data);
 }
 async function paginate(path,query={},limit=200){
  const results=[];let next=path,first=true,pages=0;
  while(next&&results.length<limit&&pages<5){
   const data=await request(next,{query:first?{...query,page_size:Math.min(100,limit)}:{},useCache:true});
   results.push(...(data.results||[]));next=data.next||null;first=false;pages++;
  }
  return results.slice(0,limit);
 }
 async function docketById(id){return request(`/dockets/${Number(id)}/`)}
 async function findDocket(record){
  const hints=extractCourtListenerHints(record);
  if(hints.docketId){try{return await docketById(hints.docketId)}catch{}}
  const attempts=[];
  if(hints.courtId&&hints.pacerCaseId)attempts.push({court:hints.courtId,pacer_case_id:hints.pacerCaseId});
  if(hints.courtId&&hints.docketNumber)attempts.push({court:hints.courtId,docket_number:hints.docketNumber});
  if(hints.docketNumber)attempts.push({docket_number:hints.docketNumber});
  for(const query of attempts){
   try{const data=await request('/dockets/',{query:{...query,page_size:20}}),rows=data.results||[];if(!rows.length)continue;
    const title=text(record.title||record.shortTitle).toLowerCase(),ranked=rows.sort((a,b)=>{const score=item=>{const name=text(item.case_name||item.case_name_full||item.case_name_short).toLowerCase();let value=0;if(title&&name&&(title.includes(name)||name.includes(title)))value+=5;if(hints.courtId===item.court_id)value+=2;if(hints.pacerCaseId===String(item.pacer_case_id))value+=4;return value};return score(b)-score(a)});return ranked[0]
   }catch{}
  }
  return null;
 }
 async function docketBundle(record,{entryLimit=160}={}){
  const docket=await findDocket(record);if(!docket)return null;
  const [rawEntries,rawParties]=await Promise.all([
   paginate('/docket-entries/',{docket:docket.id,order_by:'-date_filed'},entryLimit).catch(()=>[]),
   paginate('/parties/',{docket:docket.id,filter_nested_results:'true'},100).catch(()=>[])
  ]);
  const entries=rawEntries.map(normalizedEntry),documents=entries.flatMap(item=>item.documents||[]);
  const docketUrl=absolute(docket.absolute_url)||`${SITE_BASE}/docket/${docket.id}/`;
  const normalizedDocket=compactObject({
   id:String(docket.id),courtId:docket.court_id||null,courtApiUrl:absolute(docket.court),courtListenerUrl:docketUrl,
   caseName:text(docket.case_name||docket.case_name_full||docket.case_name_short)||text(record.title),
   docketNumber:text(docket.docket_number)||null,pacerCaseId:text(docket.pacer_case_id)||null,
   dateFiled:docket.date_filed||null,dateTerminated:docket.date_terminated||null,dateLastFiling:docket.date_last_filing||null,
   assignedJudge:text(docket.assigned_to_str)||null,referredJudge:text(docket.referred_to_str)||null,
   cause:text(docket.cause)||null,natureOfSuit:text(docket.nature_of_suit)||null,juryDemand:text(docket.jury_demand)||null,
   jurisdictionType:text(docket.jurisdiction_type)||null,blocked:Boolean(docket.blocked),lastIndexedAt:docket.date_last_index||docket.date_modified||null
  });
  return{docket:normalizedDocket,entries,documents,parties:rawParties.map(normalizedParty),fetchedAt:new Date().toISOString(),tokenConfigured:Boolean(token)};
 }
 async function document(id,{includeText=true}={}){
  const data=await request(`/recap-documents/${Number(id)}/`,{query:includeText?{}:{omit:'plain_text'}});
  return{...normalizedDocument(data,{id:data.docket_entry_id||'',date_filed:data.date_filed}),plainText:includeText?text(data.plain_text).slice(0,180000):undefined};
 }
 return{tokenConfigured:Boolean(token),request,paginate,findDocket,docketBundle,document,extractHints:extractCourtListenerHints};
}

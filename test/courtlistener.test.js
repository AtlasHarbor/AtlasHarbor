import test from 'node:test';
import assert from 'node:assert/strict';
import {courtListenerDocumentUrl,extractCourtListenerHints,createCourtListenerClient} from '../src/courtlistener.js';

test('the supplied X.AI RECAP complaint resolves to the correct CourtListener hints',()=>{
 const record={
  title:'Haley et al v. X.AI Corp. et al',
  indexNumber:'3:2026cv00148',
  sources:[{url:'https://storage.courtlistener.com/recap/gov.uscourts.msnd.52569/gov.uscourts.msnd.52569.1.0.pdf'}]
 };
 assert.deepEqual(extractCourtListenerHints(record),{
  courtId:'msnd',
  pacerCaseId:'52569',
  docketNumber:'3:26-cv-00148',
  seedDocumentUrl:'https://storage.courtlistener.com/recap/gov.uscourts.msnd.52569/gov.uscourts.msnd.52569.1.0.pdf'
 });
});

test('RECAP storage paths become direct public document URLs',()=>{
 assert.equal(
  courtListenerDocumentUrl('recap/gov.uscourts.msnd.52569/gov.uscourts.msnd.52569.1.0.pdf'),
  'https://storage.courtlistener.com/recap/gov.uscourts.msnd.52569/gov.uscourts.msnd.52569.1.0.pdf'
 );
});

test('docket synchronization uses the token and normalizes entries and documents',async()=>{
 const calls=[];
 const payloads=new Map([
  ['/api/rest/v4/dockets/?court=msnd&pacer_case_id=52569&page_size=20',{results:[{id:999,court_id:'msnd',case_name:'Haley et al v. X.AI Corp. et al',docket_number:'3:26-cv-00148',pacer_case_id:'52569',date_filed:'2026-06-08',date_last_filing:'2026-06-08',absolute_url:'/docket/999/haley-v-xai/'}]}],
  ['/api/rest/v4/docket-entries/?docket=999&order_by=-date_filed&page_size=100',{results:[{id:1,entry_number:1,date_filed:'2026-06-08',description:'COMPLAINT against X.AI Corp.',absolute_url:'/docket-entry/1/',recap_documents:[{id:101,document_number:'1',description:'Complaint',is_available:true,filepath_local:'recap/gov.uscourts.msnd.52569/gov.uscourts.msnd.52569.1.0.pdf',page_count:32}]}]}],
  ['/api/rest/v4/parties/?docket=999&filter_nested_results=true&page_size=100',{results:[{id:5,name:'Michael Haley',party_types:[{name:'Plaintiff'}],attorneys:[]}]}]
 ]);
 const fetchImpl=async(url,options={})=>{
  const parsed=new URL(url),key=`${parsed.pathname}${parsed.search}`;
  calls.push({key,authorization:options.headers?.Authorization});
  const value=payloads.get(key);
  return new Response(JSON.stringify(value||{results:[]}),{status:200,headers:{'Content-Type':'application/json'}});
 };
 const client=createCourtListenerClient({env:{COURTLISTENER_API_TOKEN:'secret-token'},fetchImpl});
 const bundle=await client.docketBundle({title:'Haley et al v. X.AI Corp. et al',indexNumber:'3:2026cv00148'});
 assert.equal(bundle.docket.id,'999');
 assert.equal(bundle.entries.length,1);
 assert.equal(bundle.documents[0].pdfUrl,'https://storage.courtlistener.com/recap/gov.uscourts.msnd.52569/gov.uscourts.msnd.52569.1.0.pdf');
 assert.equal(bundle.parties[0].name,'Michael Haley');
 assert.ok(calls.every(call=>call.authorization==='Token secret-token'));
});

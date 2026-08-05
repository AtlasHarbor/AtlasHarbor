const clean=value=>String(value||'').replace(/<!\[CDATA\[|\]\]>/g,'').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
const tag=(block,name)=>clean(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`,'i'))?.[1]||'');
const slug=value=>clean(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,96)||'economic-story';
const chunks=(items,size)=>Array.from({length:Math.ceil(items.length/size)},(_,index)=>items.slice(index*size,index*size+size));

export function parsePublicationFeed(raw,type='rss',limit=20){
 if(type==='json'){
  const parsed=JSON.parse(raw),items=Array.isArray(parsed)?parsed:parsed.items||parsed.articles||parsed.results||[];
  return items.slice(0,limit).map(item=>({title:clean(item.title),url:item.url||item.link||'',summary:clean(item.description||item.summary||item.content_text||item.content),publishedAt:item.published_at||item.pubDate||item.date_published||item.date||null})).filter(item=>item.title&&item.url);
 }
 const blocks=[...(raw.match(/<item[\s\S]*?<\/item>/gi)||[]),...(raw.match(/<entry[\s\S]*?<\/entry>/gi)||[])];
 return blocks.slice(0,limit).map(block=>({title:tag(block,'title'),url:tag(block,'link')||block.match(/<link[^>]+href=["']([^"']+)/i)?.[1]||'',summary:tag(block,'description')||tag(block,'summary')||tag(block,'content:encoded')||tag(block,'content'),publishedAt:tag(block,'pubDate')||tag(block,'published')||tag(block,'updated')||null})).filter(item=>item.title&&item.url);
}

async function responseText(response){
 response=await response;
 if(!response)throw new TypeError('The request returned no HTTP response.');
 if(typeof response.text==='function')return await response.text();
 if(typeof response.json==='function')return JSON.stringify(await response.json());
 if(typeof response.body==='string')return response.body;
 throw new TypeError('The request did not return a readable HTTP response.');
}

async function requestJSON(fetchImpl,url,options){
 const started=Date.now(),response=await fetchImpl(url,options),text=await responseText(response);let data;
 try{data=text?JSON.parse(text):{}}catch{data={raw:text}}
 if(!response.ok)throw new Error(data.error?.message||data.error||data.message||text||`Provider returned ${response.status}`);
 return{data,elapsedMs:Date.now()-started};
}

function assistantText(data){
 const content=data?.choices?.[0]?.message?.content??data?.output_text??data?.response;
 if(typeof content==='string')return content.trim();
 if(Array.isArray(content))return content.map(part=>typeof part==='string'?part:part?.text||part?.content||'').join('\n').trim();
 return'';
}
function parseJsonContent(value){
 let text=String(value||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```$/,'').trim();
 const objectStart=text.indexOf('{'),arrayStart=text.indexOf('['),start=arrayStart>=0&&(objectStart<0||arrayStart<objectStart)?arrayStart:objectStart;
 if(start>0)text=text.slice(start);
 const end=Math.max(text.lastIndexOf('}'),text.lastIndexOf(']'));if(end>=0)text=text.slice(0,end+1);
 return JSON.parse(text);
}
function normalizeStories(parsed){const rows=Array.isArray(parsed)?parsed:parsed?.stories||parsed?.items||parsed?.results||[];return Array.isArray(rows)?rows:[]}
function inferTopics(title,summary){
 const haystack=`${title} ${summary}`.toLowerCase(),rules=[['inflation',['inflation','prices','cost of living']],['monetary policy',['central bank','interest rate','fed ','ecb','boe','yen','currency']],['trade',['trade','tariff','export','import','supply chain']],['energy',['oil','gas','energy','electricity']],['technology',['ai ','artificial intelligence','semiconductor','technology','digital']],['labor',['jobs','employment','wages','labor','workers']],['markets',['stocks','bonds','market','investors']],['public finance',['tax','budget','debt','deficit']],['housing',['housing','mortgage','property']],['geopolitics',['war','sanction','geopolit','security']]];
 const topics=rules.filter(([,needles])=>needles.some(needle=>haystack.includes(needle))).map(([topic])=>topic);return topics.length?topics.slice(0,6):['economics','current events'];
}
function baseProblem(item,settings){
 const summary=clean(item.summary).slice(0,900),source=clean(settings.source_name||'Publication');
 return{slug:slug(`${item.title}-${item.url}`),title:item.title,problem:summary||`This ${source} headline identifies an unfolding economic development. The decision problem is to determine who must act, what tradeoffs they face, and which evidence would change the preferred response.`,questions:['Who has to make a decision because of this development?','What are the main tradeoffs, constraints, and distributional effects?','Which facts or indicators would change the recommended response?'],topics:inferTopics(item.title,summary),source_title:item.title,source_name:source,source_url:item.url,source_published_at:safeDate(item.publishedAt),published_at:new Date().toISOString(),status:'published',ai_model:null,enrichment_status:'headline-only',research_summary:null,research_citations:[]};
}
function safeDate(value){if(!value)return null;const date=new Date(value);return Number.isNaN(date.getTime())?null:date.toISOString()}
function sourceKey(item){try{const url=new URL(item.source_url||item.url);url.hash='';return url.toString()}catch{return clean(item.source_url||item.url||item.source_title||item.title).toLowerCase()}}

export async function runAIHealthCheck({fetchImpl,providers}){
 let lastError;
 for(const provider of providers){
  if(!provider.endpoint||!provider.model||!provider.key)continue;
  try{
   const {data,elapsedMs}=await requestJSON(fetchImpl,`${provider.endpoint.replace(/\/$/,'')}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${provider.key}`,'Content-Type':'application/json'},body:JSON.stringify({model:provider.model,temperature:.2,messages:[{role:'system',content:'Be cordial and concise. This is a connectivity test.'},{role:'user',content:'Hello, how are you? Please reply with a friendly one- or two-sentence response.'}]}),signal:AbortSignal.timeout(60000)});
   const content=assistantText(data);
   if(!content)throw new Error('The provider returned no assistant message.');
   return{ok:true,provider:provider.name,model:data.model||provider.model,elapsedMs,usage:data.usage||null,response:content};
  }catch(error){lastError=error}
 }
 return{ok:false,reason:lastError?.message||'No configured provider has an endpoint, model, and API key.',elapsedMs:0};
}

async function enrichBatch({fetchImpl,providers,instruction,settings,batch}){
 let lastError;
 const compact=batch.map((item,index)=>({index,headline:item.title,summary:item.summary.slice(0,900),url:item.url}));
 for(const provider of providers){
  if(!provider.endpoint||!provider.model||!provider.key)continue;
  try{
   const prompt=`${instruction}\n\nAnalyze the following publication headlines. Return JSON only in this shape: {"stories":[{"index":0,"problem":"...","questions":["..."],"topics":["..."]}]}. Keep the original headline unchanged; do not quote or recreate full articles. Use the feed summary only as limited context.\n\nPublication: ${settings.source_name}\nStories: ${JSON.stringify(compact)}`;
   const {data}=await requestJSON(fetchImpl,`${provider.endpoint.replace(/\/$/,'')}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${provider.key}`,'Content-Type':'application/json'},body:JSON.stringify({model:provider.model,temperature:.1,max_tokens:2600,messages:[{role:'system',content:'You convert news headlines into concise economic decision problems. Return valid JSON only.'},{role:'user',content:prompt}]}),signal:AbortSignal.timeout(90000)});
   const rows=normalizeStories(parseJsonContent(assistantText(data)));
   if(!rows.length)throw new Error('The AI returned no structured story analyses.');
   return{rows,provider:provider.name,model:data.model||provider.model,error:null};
  }catch(error){lastError=error}
 }
 return{rows:[],provider:null,model:null,error:lastError?.message||'No configured AI provider responded.'};
}

async function researchBatch({fetchImpl,researchProvider,batch}){
 if(!researchProvider?.key)return{rows:[],citations:[],model:null,error:null};
 try{
  const prompt=`Research only enough current context to clarify why these economic headlines matter. Return JSON only as {"stories":[{"index":0,"context":"two or three concise sentences"}]}. Do not reproduce articles. Headlines: ${JSON.stringify(batch.map((item,index)=>({index,headline:item.title,url:item.url})))}`;
  const {data}=await requestJSON(fetchImpl,'https://api.perplexity.ai/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${researchProvider.key}`,'Content-Type':'application/json'},body:JSON.stringify({model:researchProvider.model||'sonar-pro',temperature:.1,messages:[{role:'system',content:'Use current web sources, distinguish facts from inference, and return valid JSON only.'},{role:'user',content:prompt}]}),signal:AbortSignal.timeout(90000)});
  const citations=(Array.isArray(data.citations)?data.citations:[]).map(item=>typeof item==='string'?item:item?.url).filter(Boolean).slice(0,12);
  return{rows:normalizeStories(parseJsonContent(assistantText(data))),citations,model:data.model||researchProvider.model,error:null};
 }catch(error){return{rows:[],citations:[],model:researchProvider.model,error:error.message}}
}

export async function runEconomicsNow({fetchImpl,settings,providers,instruction,existingProblems=[],researchProvider=null}){
 const started=Date.now(),errors=[];
 if(!settings.source_url)return{ok:false,reason:'Add a feed URL before running the Economics feed.',fetched:0,newItems:0,inserted:0,enriched:0,headlineOnly:0,skippedDuplicates:0,elapsedMs:Date.now()-started,problems:[],errors:[]};
 if(settings.source_type==='manual')return{ok:false,reason:'Manual sources cannot be fetched. Choose RSS, Atom, or JSON.',fetched:0,newItems:0,inserted:0,enriched:0,headlineOnly:0,skippedDuplicates:0,elapsedMs:Date.now()-started,problems:[],errors:[]};
 const response=await fetchImpl(settings.source_url,{headers:{Accept:'application/rss+xml,application/atom+xml,application/xml,text/xml,application/json;q=.8,*/*;q=.5','User-Agent':'AtlasHarbor/2.0 (+economics feed)'},signal:AbortSignal.timeout(45000)});
 if(!response?.ok)throw new Error(`Feed returned HTTP ${response?.status||'unknown'}.`);
 const raw=await responseText(response),limit=Math.max(1,Math.min(50,Number(settings.max_items)||8)),items=parsePublicationFeed(raw,settings.source_type,limit),existingKeys=new Set(existingProblems.map(sourceKey)),newItems=items.filter(item=>!existingKeys.has(sourceKey(item))),problems=newItems.map(item=>baseProblem(item,settings));
 const enrichLimit=Math.min(problems.length,Math.max(1,Math.min(9,Number(settings.ai_items_per_run)||6))),batches=chunks(newItems.slice(0,enrichLimit),3);let enriched=0,models=[];
 for(let batchIndex=0;batchIndex<batches.length;batchIndex++){
  const batch=batches[batchIndex],offset=batchIndex*3,result=await enrichBatch({fetchImpl,providers,instruction,settings,batch});if(result.error)errors.push(`AI batch ${batchIndex+1}: ${result.error}`);if(result.model)models.push(result.model);
  for(const row of result.rows){const target=problems[offset+Number(row.index)];if(!target)continue;const problem=clean(row.problem).slice(0,1800),questions=Array.isArray(row.questions)?row.questions.map(item=>clean(item,300)).filter(Boolean).slice(0,8):[],topics=Array.isArray(row.topics)?row.topics.map(item=>clean(item,80)).filter(Boolean).slice(0,10):[];if(problem)target.problem=problem;if(questions.length)target.questions=questions;if(topics.length)target.topics=topics;target.ai_model=result.model;target.enrichment_status='enriched';enriched++}
 }
 const researchItems=newItems.slice(0,Math.min(3,newItems.length)),research=await researchBatch({fetchImpl,researchProvider,batch:researchItems});if(research.error)errors.push(`Perplexity: ${research.error}`);for(const row of research.rows){const target=problems[Number(row.index)];if(!target)continue;target.research_summary=clean(row.context||row.summary).slice(0,1200)||null;target.research_citations=research.citations}
 return{ok:true,source:settings.source_name,feedUrl:settings.source_url,fetched:items.length,newItems:newItems.length,inserted:problems.length,enriched,headlineOnly:problems.length-enriched,skippedDuplicates:items.length-newItems.length,elapsedMs:Date.now()-started,models:[...new Set(models)],researchModel:research.model||null,errors,problems};
}

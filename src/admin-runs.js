const clean=value=>String(value||'').replace(/<!\[CDATA\[|\]\]>/g,'').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
const tag=(block,name)=>clean(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`,'i'))?.[1]||'');

export function parsePublicationFeed(raw,type='rss',limit=20){
 if(type==='json'){
  const parsed=JSON.parse(raw),items=Array.isArray(parsed)?parsed:parsed.items||parsed.articles||parsed.results||[];
  return items.slice(0,limit).map(item=>({title:clean(item.title),url:item.url||item.link||'',summary:clean(item.description||item.summary||item.content),publishedAt:item.published_at||item.pubDate||item.date||null})).filter(item=>item.title&&item.url);
 }
 const blocks=[...(raw.match(/<item[\s\S]*?<\/item>/gi)||[]),...(raw.match(/<entry[\s\S]*?<\/entry>/gi)||[])];
 return blocks.slice(0,limit).map(block=>({title:tag(block,'title'),url:tag(block,'link')||block.match(/<link[^>]+href=["']([^"']+)/i)?.[1]||'',summary:tag(block,'description')||tag(block,'summary')||tag(block,'content'),publishedAt:tag(block,'pubDate')||tag(block,'published')||tag(block,'updated')||null})).filter(item=>item.title&&item.url);
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

export async function runAIHealthCheck({fetchImpl,providers}){
 let lastError;
 for(const provider of providers){
  if(!provider.endpoint||!provider.model||!provider.key)continue;
  try{
   const {data,elapsedMs}=await requestJSON(fetchImpl,`${provider.endpoint.replace(/\/$/,'')}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${provider.key}`,'Content-Type':'application/json'},body:JSON.stringify({model:provider.model,temperature:.2,messages:[{role:'system',content:'Be cordial and concise. This is a connectivity test.'},{role:'user',content:'Hello, how are you? Please reply with a friendly one- or two-sentence response.'}]})});
   const content=String(data.choices?.[0]?.message?.content||'').trim();
   if(!content)throw new Error('The provider returned no assistant message.');
   return{ok:true,provider:provider.name,model:data.model||provider.model,elapsedMs,usage:data.usage||null,response:content};
  }catch(error){lastError=error}
 }
 return{ok:false,reason:lastError?.message||'No configured provider has an endpoint, model, and API key.',elapsedMs:0};
}

export async function runEconomicsNow({fetchImpl,settings,providers,instruction}){
 const started=Date.now();
 if(!settings.source_url)return{ok:false,reason:'Add a feed URL before running the Economics feed.',fetched:0,converted:0,skipped:0,elapsedMs:Date.now()-started};
 if(settings.source_type==='manual')return{ok:false,reason:'Manual sources cannot be fetched. Choose RSS, Atom, or JSON.',fetched:0,converted:0,skipped:0,elapsedMs:Date.now()-started};
 const response=await fetchImpl(settings.source_url,{headers:{Accept:'application/rss+xml,application/atom+xml,application/xml,text/xml,application/json;q=.8,*/*;q=.5','User-Agent':'AtlasHarbor/1.0'}});
 if(!response?.ok)throw new Error(`Feed returned HTTP ${response?.status||'unknown'}.`);
 const raw=await responseText(response),items=parsePublicationFeed(raw,settings.source_type,settings.max_items||20),problems=[];let skipped=0,lastError;
 for(const item of items){
  let converted=false;
  for(const provider of providers){
   if(!provider.endpoint||!provider.model||!provider.key)continue;
   try{
    const {data}=await requestJSON(fetchImpl,`${provider.endpoint.replace(/\/$/,'')}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${provider.key}`,'Content-Type':'application/json'},body:JSON.stringify({model:provider.model,temperature:.1,response_format:{type:'json_object'},messages:[{role:'system',content:'Return strict JSON with title, problem, questions, and topics. Do not reproduce the article.'},{role:'user',content:`${instruction}\nPublication: ${settings.source_name}\nHeadline: ${item.title}\nSummary: ${item.summary.slice(0,2200)}\nURL: ${item.url}`} ]})});
    const content=data.choices?.[0]?.message?.content||'{}';let problem;try{problem=JSON.parse(content)}catch{throw new Error('The AI returned invalid JSON.')}
    problems.push({sourceTitle:item.title,sourceUrl:item.url,publishedAt:item.publishedAt,provider:provider.name,model:data.model||provider.model,title:problem.title||item.title,problem:problem.problem||'',questions:Array.isArray(problem.questions)?problem.questions:[],topics:Array.isArray(problem.topics)?problem.topics:[]});converted=true;break;
   }catch(error){lastError=error}
  }
  if(!converted)skipped++;
 }
 return{ok:true,source:settings.source_name,feedUrl:settings.source_url,fetched:items.length,converted:problems.length,skipped,elapsedMs:Date.now()-started,lastError:lastError?.message||null,problems};
}

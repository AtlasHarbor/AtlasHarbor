import express from 'express';

const route=fn=>async(req,res)=>{try{await fn(req,res)}catch(error){console.error('Research credential:',error);res.status(error.status||500).json({error:error.message||'Credential validation failed.'})}};
export function createResearchCredentialRouter({storage,fetchImpl=globalThis.fetch}={}){
 const router=express.Router();
 router.post('/api/research/perplexity/test',route(async(req,res)=>{await storage.requestUser(req);const key=String(req.get('x-perplexity-key')||'').trim(),model=String(req.get('x-perplexity-model')||req.body?.model||'sonar-pro').trim();if(!key)return res.status(400).json({error:'Add a Perplexity API key first.'});const response=await fetchImpl('https://api.perplexity.ai/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,temperature:0,max_tokens:32,messages:[{role:'system',content:'Return valid JSON only.'},{role:'user',content:'Return {"ok":true}.'}]})});const data=await response.json().catch(()=>({}));if(!response.ok)return res.status(response.status).json({error:data.error?.message||data.message||'Perplexity rejected this key.'});res.json({ok:true,model:data.model||model})}));
 return router;
}

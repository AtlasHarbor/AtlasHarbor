const DAY_MS=24*60*60*1000;
const memory=new Map();

export function createBaseballCache(fetchImpl=globalThis.fetch){
  const url=process.env.SUPABASE_URL;
  const secret=process.env.SUPABASE_SECRET_KEY;
  const enabled=Boolean(url&&secret);
  const headers={apikey:secret,Authorization:`Bearer ${secret}`,'Content-Type':'application/json'};

  async function read(key){
    const local=memory.get(key)||null;
    if(!enabled)return local;
    try{
      const r=await fetchImpl(`${url}/rest/v1/baseball_cache?cache_key=eq.${encodeURIComponent(key)}&select=payload,fetched_at&limit=1`,{headers});
      if(!r.ok)throw new Error(`cache read ${r.status}`);
      const row=(await r.json())?.[0];
      if(!row)return local;
      const value={payload:row.payload,fetchedAt:new Date(row.fetched_at).getTime()};
      memory.set(key,value);
      return value;
    }catch(error){console.warn('Baseball cache read failed:',error.message);return local}
  }

  async function write(key,payload){
    const value={payload,fetchedAt:Date.now()};memory.set(key,value);
    if(!enabled)return;
    try{
      const r=await fetchImpl(`${url}/rest/v1/baseball_cache`,{method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({cache_key:key,payload,fetched_at:new Date(value.fetchedAt).toISOString()})});
      if(!r.ok)throw new Error(`cache write ${r.status}`);
    }catch(error){console.warn('Baseball cache write failed:',error.message)}
  }

  return {
    enabled,
    async getOrFetch(key,loader,{ttlMs=DAY_MS}={}){
      const cached=await read(key);
      if(cached&&Date.now()-cached.fetchedAt<ttlMs)return{data:cached.payload,cache:'fresh',fetchedAt:new Date(cached.fetchedAt).toISOString()};
      try{
        const data=await loader();
        if(data!=null)await write(key,data);
        return{data,cache:'refreshed',fetchedAt:new Date().toISOString()};
      }catch(error){
        if(cached)return{data:cached.payload,cache:'stale',fetchedAt:new Date(cached.fetchedAt).toISOString(),warning:error.message};
        throw error;
      }
    }
  };
}

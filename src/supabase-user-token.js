import crypto from'node:crypto';

const LOCAL_ALGORITHMS=new Set(['ES256','RS256','EdDSA']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function decodeJson(segment){return JSON.parse(Buffer.from(String(segment||''),'base64url').toString('utf8'))}
function audienceIncludes(value,expected){return Array.isArray(value)?value.includes(expected):value===expected}
function compatibleKey(key,header){return key?.kid===header.kid&&(!key.alg||key.alg===header.alg)&&(!key.use||key.use==='sig')}
function signatureIsValid(header,jwk,input,signature){
 const key=crypto.createPublicKey({key:jwk,format:'jwk'}),data=Buffer.from(input),bytes=Buffer.from(signature,'base64url');
 if(header.alg==='ES256')return crypto.verify('sha256',data,{key,dsaEncoding:'ieee-p1363'},bytes);
 if(header.alg==='RS256')return crypto.verify('RSA-SHA256',data,key,bytes);
 if(header.alg==='EdDSA')return crypto.verify(null,data,key,bytes);
 return false;
}

export function createSupabaseUserTokenVerifier({base,jwksUrl,loadJwks,now=()=>Date.now(),cacheMilliseconds=5*60*1000}={}){
 const issuer=`${String(base||'').replace(/\/$/,'')}/auth/v1`,canonicalDiscovery=`${issuer}/.well-known/jwks.json`,discovery=jwksUrl||canonicalDiscovery;
 let cachedKeys=[],cacheExpiresAt=0,pending=null;
 async function discoverKeys(){let lastError=null;for(const url of[...new Set([discovery,canonicalDiscovery])])try{const data=await loadJwks(url),found=Array.isArray(data?.keys)?data.keys:[];if(found.length)return found;lastError=Object.assign(new Error('Supabase signing keys are unavailable.'),{status:503})}catch(error){lastError=error}throw lastError||Object.assign(new Error('Supabase signing keys are unavailable.'),{status:503})}
 async function keys(force=false){
  if(!force&&cachedKeys.length&&cacheExpiresAt>now())return cachedKeys;
  if(pending)return pending;
  const run=(async()=>{const found=await discoverKeys();cachedKeys=found;cacheExpiresAt=now()+cacheMilliseconds;return found})();
  pending=run;try{return await run}finally{if(pending===run)pending=null}
 }
 async function verify(token){
  const parts=String(token||'').split('.');
  if(parts.length!==3)return{status:'remote'};
  let header,claims;
  try{header=decodeJson(parts[0]);claims=decodeJson(parts[1])}catch{return{status:'remote'}}
  if(!LOCAL_ALGORITHMS.has(header?.alg)||!header?.kid)return{status:'remote'};
  let available;
  try{available=await keys()}catch{return{status:'remote'}}
  let jwk=available.find(key=>compatibleKey(key,header));
  if(!jwk)try{available=await keys(true);jwk=available.find(key=>compatibleKey(key,header))}catch{return{status:'remote'}}
  if(!jwk)return{status:'remote'};
  try{if(!signatureIsValid(header,jwk,`${parts[0]}.${parts[1]}`,parts[2]))return{status:'invalid'}}catch{return{status:'remote'}}
  const seconds=Math.floor(now()/1000),expires=Number(claims.exp),notBefore=claims.nbf==null?null:Number(claims.nbf),issued=claims.iat==null?null:Number(claims.iat);
  if(!Number.isFinite(expires)||expires<=seconds-30)return{status:'invalid'};
  if(notBefore!=null&&(!Number.isFinite(notBefore)||notBefore>seconds+30))return{status:'invalid'};
  if(issued!=null&&(!Number.isFinite(issued)||issued>seconds+300))return{status:'invalid'};
  if(claims.iss!==issuer||!audienceIncludes(claims.aud,'authenticated')||claims.role!=='authenticated'||!UUID.test(String(claims.sub||'')))return{status:'invalid'};
  return{status:'verified',claims};
 }
 return{verify,discovery};
}

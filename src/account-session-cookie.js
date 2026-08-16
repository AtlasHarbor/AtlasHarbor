import crypto from 'node:crypto';
import {supabaseSecretKey} from './supabase-server-key.js';

const COOKIE_NAME='atlas_harbor_session';
const COOKIE_AUDIENCE='atlas-workspace';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jwtExpiry(token){
 try{
  const part=String(token||'').split('.')[1];
  if(!part)return 0;
  return Number(JSON.parse(Buffer.from(part,'base64url').toString('utf8')).exp)||0;
 }catch{return 0}
}

function cookieValue(req,name){
 const header=String(req?.get?.('cookie')||req?.headers?.cookie||'');
 for(const item of header.split(';')){
  const index=item.indexOf('=');
  if(index<0||item.slice(0,index).trim()!==name)continue;
  try{return decodeURIComponent(item.slice(index+1).trim())}catch{return''}
 }
 return'';
}

function secureRequest(req,env){
 if(env.NODE_ENV==='production')return true;
 if(req?.secure)return true;
 return String(req?.get?.('x-forwarded-proto')||'').split(',')[0].trim()==='https';
}

export function createAccountSessionCookie({env=process.env,now=()=>Date.now()}={}){
 const root=String(env.ATLAS_SESSION_SECRET||supabaseSecretKey(env)||'').trim();
 const secret=root?crypto.createHash('sha256').update('atlas-harbor-account-session-v1\0').update(root).digest():null;
 const sign=payload=>secret?crypto.createHmac('sha256',secret).update(payload).digest('base64url'):'';
 function issue(session){
  const source=session?.session||session,sub=String(source?.user?.id||session?.user?.id||''),exp=Number(source?.expires_at)||jwtExpiry(source?.access_token);
  if(!secret||!UUID.test(sub)||!Number.isFinite(exp)||exp<=Math.floor(now()/1000))return null;
  const payload=Buffer.from(JSON.stringify({v:1,aud:COOKIE_AUDIENCE,sub,exp})).toString('base64url');
  return`${payload}.${sign(payload)}`;
 }
 function verify(value){
  if(!secret||!value)return null;
  const parts=String(value).split('.');
  if(parts.length!==2)return null;
  const expected=Buffer.from(sign(parts[0])),actual=Buffer.from(parts[1]);
  if(expected.length!==actual.length||!crypto.timingSafeEqual(expected,actual))return null;
  try{
   const payload=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
   if(payload.v!==1||payload.aud!==COOKIE_AUDIENCE||!UUID.test(String(payload.sub||''))||!Number.isFinite(Number(payload.exp))||Number(payload.exp)<=Math.floor(now()/1000))return null;
   return{sub:String(payload.sub),exp:Number(payload.exp)};
  }catch{return null}
 }
 function read(req){return verify(cookieValue(req,COOKIE_NAME))}
 function set(res,req,session){
  const value=issue(session);
  if(!value)return false;
  const parsed=verify(value),maxAge=Math.max(1,parsed.exp-Math.floor(now()/1000)),secure=secureRequest(req,env)?'; Secure':'';
  res.append('Set-Cookie',`${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
  return true;
 }
 function clear(res,req){
  const secure=secureRequest(req,env)?'; Secure':'';
  res.append('Set-Cookie',`${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`);
 }
 return{name:COOKIE_NAME,configured:Boolean(secret),issue,verify,read,set,clear};
}

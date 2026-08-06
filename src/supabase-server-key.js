export function supabaseSecretKey(env=process.env){
 return env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SERVICE_KEY||'';
}

export function supabaseServiceHeaders(secret,{json=true}={}){
 const key=String(secret||'').trim();
 const headers={};
 if(key)headers.apikey=key;
 // New Supabase sb_secret_* keys are opaque API keys, not JWTs. Sending one
 // as Authorization: Bearer causes an Invalid JWT response. Legacy service_role
 // keys are JWTs and still require the bearer header for direct REST/Auth calls.
 if(key&&!/^sb_secret_/i.test(key))headers.Authorization=`Bearer ${key}`;
 if(json)headers['Content-Type']='application/json';
 return headers;
}

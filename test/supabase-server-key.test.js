import test from'node:test';
import assert from'node:assert/strict';
import{supabaseSecretKey,supabaseServiceHeaders}from'../src/supabase-server-key.js';

test('opaque Supabase secret keys are never sent as bearer JWTs',()=>{
 assert.deepEqual(supabaseServiceHeaders('sb_secret_example',{json:false}),{apikey:'sb_secret_example'});
});

test('legacy service-role JWTs keep the authorization header',()=>{
 const headers=supabaseServiceHeaders('eyJlegacy',{json:false});
 assert.equal(headers.apikey,'eyJlegacy');
 assert.equal(headers.Authorization,'Bearer eyJlegacy');
});

test('accepted environment aliases resolve in priority order',()=>{
 assert.equal(supabaseSecretKey({SUPABASE_SECRET_KEY:'new',SUPABASE_SERVICE_ROLE_KEY:'old'}),'new');
 assert.equal(supabaseSecretKey({SUPABASE_SERVICE_ROLE_KEY:'old'}),'old');
 assert.equal(supabaseSecretKey({SUPABASE_SERVICE_KEY:'fallback'}),'fallback');
});

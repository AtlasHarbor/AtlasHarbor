import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const router=fs.readFileSync(new URL('../src/signup-router.js',import.meta.url),'utf8');
const page=fs.readFileSync(new URL('../public/signups.html',import.meta.url),'utf8');
const client=fs.readFileSync(new URL('../public/signups.js',import.meta.url),'utf8');

test('app signup storage captures IP and best-effort region',()=>{
  assert.match(router,/function clientIp\(/);
  assert.match(router,/function clientRegion\(/);
  assert.match(router,/ip:ip\|\|registry\.signups\[index\]\.ip/);
  assert.match(router,/region:region\|\|registry\.signups\[index\]\.region/);
  assert.match(router,/x-vercel-ip-country-region/);
  assert.match(router,/cf-ipcountry/);
});

test('signup dashboard uses the master account session without the admin password',()=>{
  assert.match(router,/masterUserId/);
  assert.match(router,/This signed-in account does not have access to app signups/);
  assert.doesNotMatch(router,/Admin password required/);
  assert.doesNotMatch(page,/Admin password/i);
  assert.match(client,/signIn,signOut/);
});

test('signup dashboard exposes app, contact, network, date and source fields',()=>{
  for(const label of ['App','Name','Email','IP','Region','Signed up','Source'])assert.match(page,new RegExp(`<th>${label}<\\/th>`));
  assert.match(client,/\['App','Name','Email','IP','Region','Signed up','Source'\]/);
  assert.match(client,/data-app-card/);
});

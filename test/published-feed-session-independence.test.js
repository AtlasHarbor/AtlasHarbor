import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('published feed list is session-independent in the browser and server',()=>{
 const html=read('../public/published.html');
 const browser=read('../public/published-public-feed.js');
 const router=read('../src/problem-router.js');
 const isolationIndex=html.indexOf('/published-public-feed.js');
 const appIndex=html.indexOf('/published.js');
 assert.ok(isolationIndex>=0&&appIndex>isolationIndex,'public-feed isolation must load before published modules');
 assert.match(browser,/url\.pathname === '\/api\/published-feed'/);
 assert.match(browser,/method === 'GET'/);
 assert.match(browser,/headers\.delete\('Authorization'\)/);
 assert.match(browser,/credentials: 'omit'/);
 assert.match(router,/router\.get\('\/api\/published-feed',[\s\S]*delete req\.headers\.authorization/);
 const middlewareIndex=router.indexOf("router.get('/api/published-feed'");
 const feedRouterIndex=router.indexOf('router.use(createPublishedFeedRouter');
 assert.ok(middlewareIndex>=0&&feedRouterIndex>middlewareIndex,'server must strip viewer auth before the published feed router');
});

test('publication detail remains allowed to use authentication for owner controls',()=>{
 const source=read('../public/published.js');
 assert.match(source,/resolvePublication\(token\)[\s\S]*Authorization=`Bearer \$\{accessToken\(\)\}`/);
 assert.match(source,/\/api\/published-feed\/\$\{encodeURIComponent\(token\)\}/);
});

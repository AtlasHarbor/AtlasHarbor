import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Legal cards contain long mobile text instead of overflowing',async()=>{
 const css=await fs.readFile(new URL('../public/legal-containment.css',import.meta.url),'utf8');
 assert.match(css,/\.case-card\{overflow:hidden\}/);
 assert.match(css,/overflow-wrap:anywhere/);
 assert.match(css,/word-break:break-word/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/\.case-meta,\.case-freshness\{grid-template-columns:minmax\(0,1fr\)\}/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url),'utf8'));
test('package.json dependencies match package-lock root dependencies',()=>{const pkg=read('../package.json'),lock=read('../package-lock.json');assert.deepEqual(lock.packages?.['']?.dependencies||{},pkg.dependencies||{})});

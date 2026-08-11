import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const publishing=fs.readFileSync(new URL('../public/publishing-links.js',import.meta.url),'utf8');
const account=fs.readFileSync(new URL('../public/account-indicator.js',import.meta.url),'utf8');

test('publication link rendering is event-driven and cannot self-trigger a document mutation loop',()=>{
  assert.doesNotMatch(publishing,/new\s+MutationObserver/);
  assert.doesNotMatch(publishing,/observe\(document\.(?:documentElement|body)/);
  assert.match(publishing,/atlas-workspace-loaded/);
  assert.match(publishing,/atlas-publication-updated/);
  assert.match(publishing,/dataset\.shareToken/);
});

test('baseball workspace bootstrap mounts once and aborts requests when leaving the page',()=>{
  assert.match(account,/baseballWorkspacePromise/);
  assert.match(account,/if\(baseballWorkspacePromise\)return baseballWorkspacePromise/);
  assert.match(account,/new AbortController\(\)/);
  assert.match(account,/pagehide/);
  assert.match(account,/baseballWorkspaceController\.abort\(\)/);
  assert.match(account,/host\.dataset\.mounted/);
});

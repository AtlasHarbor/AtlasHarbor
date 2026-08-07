import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('workspace editor has one database source of truth and no device draft fallback',()=>{const source=read('../public/workspace.js');assert.match(source,/\/api\/workspaces\//);assert.match(source,/No device-only draft was created/);assert.doesNotMatch(source,/localStorage\.setItem\([^\n]*workspace/);assert.doesNotMatch(source,/Using your saved account copy/);assert.doesNotMatch(source,/account-metadata-direct/)});

test('publication-link UI reads canonical workspace API instead of browser workspace_notes REST',()=>{const source=read('../public/publishing-links.js');assert.match(source,/\/api\/workspaces\//);assert.doesNotMatch(source,/rest\(['"]workspace_notes/);assert.doesNotMatch(source,/published\/undefined/)});

test('server generates compact publication tokens and feed canonicalizes malformed legacy tokens',()=>{const workspace=read('../src/workspace-api.js'),feed=read('../src/published-feed.js');assert.match(workspace,/randomBytes\(18\)\.toString\('base64url'\)/);assert.match(feed,/token\.length>96/);assert.match(feed,/`pub-\$\{/);assert.match(feed,/atlas_virtual_tables\?\.workspace_notes/)});

test('workspace architecture explicitly prohibits local workspace copies and encoded publication tokens',()=>{const docs=read('../docs/WORKSPACE_ARCHITECTURE.md'),readme=read('../README.md');for(const text of[docs,readme]){assert.match(text,/one writable.*source of truth|One writable source of truth/i);assert.match(text,/never.*device-only/i);assert.match(text,/published\/undefined|\/published\/undefined/);assert.match(text,/entire publication.*share token|entire article.*share_token/i)}});

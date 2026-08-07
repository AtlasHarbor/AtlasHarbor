import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('workspace has one database record with two database transports and no device draft fallback',()=>{const source=read('../public/workspace.js');assert.match(source,/\/api\/workspaces\//);assert.match(source,/direct-account-database/);assert.match(source,/updateUserMetadata/);assert.match(source,/atlas_problem_spaces/);assert.doesNotMatch(source,/localStorage\.(?:getItem|setItem).*workspace/);assert.doesNotMatch(source,/device copy|device draft/i)});

test('publication-link UI consumes the saved workspace record instead of refetching workspace storage',()=>{const source=read('../public/publishing-links.js');assert.match(source,/atlas-publication-updated/);assert.match(source,/event\.detail\?\.workspace/);assert.doesNotMatch(source,/\/api\/workspaces\//);assert.doesNotMatch(source,/rest\(['"]workspace_notes/);assert.doesNotMatch(source,/published\/undefined/)});

test('attachment scope is part of the canonical workspace save and never performs a second database write',()=>{const source=read('../public/workspace-scope-toggle.js'),workspace=read('../public/workspace.js');assert.match(source,/dataset\.shareScope/);assert.doesNotMatch(source,/fetch\(/);assert.match(workspace,/share_scope:section\.dataset\.shareScope/)});

test('server generates compact publication tokens and feed canonicalizes malformed legacy tokens',()=>{const workspace=read('../src/workspace-api.js'),feed=read('../src/published-feed.js');assert.match(workspace,/randomBytes\(18\)\.toString\('base64url'\)/);assert.match(feed,/token\.length>96/);assert.match(feed,/`pub-\$\{/);assert.match(feed,/atlas_virtual_tables\?\.workspace_notes/)});

test('workspace architecture explicitly prohibits local workspace copies and encoded publication tokens',()=>{const docs=read('../docs/WORKSPACE_ARCHITECTURE.md'),readme=read('../README.md');for(const text of[docs,readme]){assert.match(text,/one writable.*source of truth|One writable source of truth/i);assert.match(text,/never.*device-only|no device-only/i);assert.match(text,/published\/undefined|\/published\/undefined/);assert.match(text,/entire publication.*share token|entire article.*share_token/i)}});

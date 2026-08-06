import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('publishing workspace is database-only in the browser', () => {
  const source = read('public/workspace.js');
  assert.match(source, /\/rest\/v1\/\$\{table\}/);
  assert.match(source, /workspace_notes/);
  assert.doesNotMatch(source, /localStorage/);
  assert.doesNotMatch(source, /atlas-workspace:/);
  assert.doesNotMatch(source, /Using your saved account copy|Saved on this device|service reconnects/i);
});

test('server workspace API writes workspace_notes instead of account metadata', () => {
  const source = read('src/workspace-api.js');
  assert.match(source, /on_conflict=user_id,resource_type,resource_id/);
  assert.match(source, /storage: 'workspace_notes'/);
  assert.doesNotMatch(source, /writeUser\(/);
  assert.doesNotMatch(source, /publishing_workspace/);
});

test('Legal hides infrastructure status and does not run device recovery', () => {
  const html = read('public/legal.html');
  assert.match(html, /id="legal-system-status" hidden/);
  assert.doesNotMatch(html, /legal-workspace-recovery\.js/);
});

test('Published reads shared publications from the workspace database', () => {
  const html = read('public/published.html');
  const browser = read('public/published.js');
  const server = read('src/published-feed.js');
  assert.doesNotMatch(html, /published-database-feed\.js/);
  assert.match(browser, /rest\/v1\/workspace_notes/);
  assert.match(browser, /is_published=eq\.true/);
  assert.match(browser, /is_shared=eq\.true/);
  assert.doesNotMatch(browser, /atlas_problem_spaces|atlas_virtual_tables/);
  assert.match(server, /storage: 'workspace_notes'/);
  assert.match(server, /tableRows\('workspace_notes'/);
  assert.doesNotMatch(server, /accountRecords|publishing_workspace|atlas_virtual_tables/);
});

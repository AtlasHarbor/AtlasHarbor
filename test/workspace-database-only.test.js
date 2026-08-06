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

test('Published can recover directly from the workspace database', () => {
  const html = read('public/published.html');
  const source = read('public/published-database-feed.js');
  assert.match(html, /published-database-feed\.js/);
  assert.match(source, /rest\/v1\/workspace_notes/);
  assert.match(source, /is_published=eq\.true/);
  assert.match(source, /is_shared=eq\.true/);
});

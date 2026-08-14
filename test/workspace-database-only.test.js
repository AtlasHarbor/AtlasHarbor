import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('publishing workspace uses only the same-origin API for persistence', () => {
  const source = read('public/workspace.js');
  const transport = read('public/workspace-transport-fallback.js');
  assert.match(source, /\/api\/workspaces\//);
  assert.match(source, /accountRecord/);
  assert.match(source, /atlas_problem_spaces/);
  assert.match(source, /atlas_virtual_tables/);
  assert.match(source, /last confirmed account record|workspace API reconnects/i);
  assert.match(transport, /\/api\/workspaces-form\//);
  assert.doesNotMatch(source, /auth\/v1\/user|persistDirectMetadata|updateUserMetadata/);
  assert.doesNotMatch(transport, /auth\/v1\/user|configuredSupabaseOrigin/);
});

test('server workspace recovers database, metadata, virtual, and legacy Legal records', () => {
  const source = read('src/workspace-api.js');
  assert.match(source, /tableRows\('workspace_notes'/);
  assert.match(source, /tableRows\('legal_notes'/);
  assert.match(source, /metadataNotes/);
  assert.match(source, /virtualNotes/);
  assert.match(source, /writeUser\(/);
  assert.match(source, /supabaseServiceHeaders/);
  assert.match(source, /serviceKeyType/);
});

test('Legal keeps the shared navigation and does not require an obsolete recovery client', () => {
  const html = read('public/legal.html');
  assert.match(html, /problem-nav\.js/);
  assert.match(html, /id="legal-system-status" hidden/);
  assert.doesNotMatch(html, /legal-workspace-recovery\.js/);
});

test('Published is server-first and the server aggregates every persistent source', () => {
  const browser = read('public/published.js');
  const server = read('src/published-feed.js');
  assert.match(browser, /\/api\/published-feed/);
  assert.match(server, /tableRows\('workspace_notes'/);
  assert.match(server, /tableRows\('legal_notes'/);
  assert.match(server, /accountRecords/);
  assert.match(server, /publishing_workspace/);
  assert.match(server, /atlas_virtual_tables/);
  assert.match(server, /supabaseServiceHeaders/);
});

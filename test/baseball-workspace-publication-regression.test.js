import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const recovery=fs.readFileSync(new URL('../public/workspace-first-note-recovery.js',import.meta.url),'utf8');
const publicFeed=fs.readFileSync(new URL('../public/published-public-feed.js',import.meta.url),'utf8');
const playerExport=fs.readFileSync(new URL('../public/baseball-player-export.js',import.meta.url),'utf8');

test('first Baseball analysis can mount from authenticated empty session state',()=>{
 assert.match(recovery,/authenticated-session-empty/);
 assert.match(recovery,/method!==['"]GET['"]/);
 assert.match(recovery,/hasExistingRecord/);
});

test('published list and publication detail are session-independent public reads',()=>{
 assert.match(publicFeed,/atlasPublishedPublicFirst/);
 assert.match(publicFeed,/published-feed/);
 assert.match(publicFeed,/headers\.delete\(['"]Authorization['"]\)/);
 assert.match(publicFeed,/credentials:\s*['"]omit['"]/);
});

test('player JSON export includes the signed-in user analysis when available',()=>{
 assert.match(playerExport,/analysis/);
 assert.match(playerExport,/api\/workspaces\/baseball_player/);
 assert.match(playerExport,/Authorization/);
 assert.match(playerExport,/sessionAnalysis/);
});

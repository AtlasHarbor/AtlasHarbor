import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DEFAULT_ECONOMICS,freshestProblems} from '../src/economics-service.js';

test('Economics keeps the newest timestamped stories even when a feed is out of order',()=>{const rows=[{title:'older',source_published_at:'2026-08-05T10:00:00Z'},{title:'newest',source_published_at:'2026-08-07T05:00:00Z'},{title:'middle',source_published_at:'2026-08-06T10:00:00Z'}];assert.deepEqual(freshestProblems(rows,2).map(x=>x.title),['newest','middle'])});

test('Economics defaults to an hourly scheduler cadence',()=>{assert.equal(DEFAULT_ECONOMICS.cadence_hours,1)});

test('public Economics quietly refreshes an enabled feed after twenty minutes',()=>{const source=fs.readFileSync(new URL('../public/economics.js',import.meta.url),'utf8');assert.match(source,/STALE_MS=20\*60\*1000/);assert.match(source,/runRefresh\(\{quiet:true\}\)/);assert.match(source,/sourceUrlConfigured/)});

test('Economics service fetches a wider candidate window before retaining configured newest items',()=>{const source=fs.readFileSync(new URL('../src/economics-service.js',import.meta.url),'utf8');assert.match(source,/max_items:Math\.max\(40,desired\*5\)/);assert.match(source,/freshestProblems\(baseline,desired\)/);assert.match(source,/freshestProblems\(rawResult\.problems\|\|\[\],desired\)/)});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fallback,distance,nearestNeighbor} from '../src/game-routing.js';

test('truck fallback is a routed corridor rather than a direct line',()=>{
 const route=fallback('truck','anaheim-pack','dallas-dc');
 assert.equal(route.mode,'truck');
 assert.ok(route.coordinates.length>4);
 assert.ok(route.distanceMeters>1_000_000);
 assert.equal(route.coordinates[0][0],33.84);
 assert.equal(route.coordinates.at(-1)[0],32.78);
});

test('ocean competitor follows a water corridor between ports',()=>{
 const route=fallback('ocean','la-port','savannah-port');
 assert.ok(route.coordinates.length>8);
 assert.ok(Math.min(...route.coordinates.map(point=>point[0]))<10);
 assert.ok(distance(route.coordinates)>4_000_000);
 assert.deepEqual(route.coordinates[0],[33.74,-118.27]);
 assert.deepEqual(route.coordinates.at(-1),[32.08,-81.09]);
});

test('nearest-neighbor optimization keeps fixed first and last stops',()=>{
 const stops=['la-port','anaheim-pack','mem-air','savannah-port','atlanta-dc'];
 const ordered=nearestNeighbor(stops);
 assert.equal(ordered[0],'la-port');
 assert.equal(ordered.at(-1),'atlanta-dc');
 assert.deepEqual(new Set(ordered),new Set(stops));
});

test('browser game engine parses as JavaScript',async()=>{
 const source=await fs.readFile(new URL('../public/game-v3.js',import.meta.url),'utf8');
 assert.doesNotThrow(()=>new Function(source));
});

test('browser manual describes the current exception-driven game',async()=>{
 const manual=await fs.readFile(new URL('../public/game-docs.html',import.meta.url),'utf8');
 assert.match(manual,/management by exception/i);
 assert.match(manual,/Overall progress/);
 assert.match(manual,/Traveling salesman clarification/);
 assert.doesNotMatch(manual,/ten-day operating cycle/i);
 assert.doesNotMatch(manual,/cold-chain slots/i);
});

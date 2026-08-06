import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {protectRouteFallbacks} from '../src/game-client.js';

test('browser logistics client does not invent land or ocean arcs',async()=>{
 const source=await fs.readFile(new URL('../public/game-v3.js',import.meta.url),'utf8'),guarded=protectRouteFallbacks(source);
 assert.doesNotMatch(guarded,/mode==='air'\?28:18/);
 assert.match(guarded,/if\(mode!=='air'\)return\{mode,from,to,coordinates:\[\],distanceKm:0,source:'route-unavailable'\}/);
 assert.match(guarded,/route\.source==='route-unavailable'\)return 0/);
 assert.match(guarded,/atlas-game-route-cache-v2/);
});

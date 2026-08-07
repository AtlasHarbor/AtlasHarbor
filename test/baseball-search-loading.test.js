import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import {createBaseballSearchRouter} from '../src/baseball-search-router.js';

const response=data=>({ok:true,status:200,json:async()=>data});

test('baseball autocomplete hydrates a player current team',async()=>{const calls=[];const fetchImpl=async url=>{calls.push(url);if(url.includes('/people/search?'))return response({people:[{id:1,fullName:'Example Player',primaryPosition:{name:'Shortstop'}}]});if(url.includes('/people?personIds=1'))return response({people:[{id:1,fullName:'Example Player',currentTeam:{name:'Chicago Cubs'},primaryPosition:{name:'Shortstop'}}]});if(url.includes('/teams?'))return response({teams:[]});if(url.includes('/schedule?'))return response({dates:[]});throw new Error(`Unexpected URL ${url}`)};const app=express();app.use(createBaseballSearchRouter({fetchImpl}));const server=app.listen(0);try{const port=server.address().port,data=await fetch(`http://127.0.0.1:${port}/api/baseball/search?q=example`).then(r=>r.json());assert.equal(data.results[0].subtitle,'Chicago Cubs · Shortstop');assert.ok(calls.some(url=>url.includes('/people?personIds=1')))}finally{await new Promise(resolve=>server.close(resolve))}});

test('shared loading feedback is randomized, contextual, and skips autocomplete',()=>{const source=fs.readFileSync(new URL('../public/loading-feedback.js',import.meta.url),'utf8');assert.doesNotMatch(source,/Opening page/);assert.match(source,/Cross-docking/);assert.match(source,/Finding the missing pallet/);assert.match(source,/Dispatching somebody competent/);assert.match(source,/Pulling the docket/);assert.match(source,/delay:220/);assert.match(source,/baseball\\\/search/);assert.match(source,/setInterval/)});

test('shared navigation, baseball, and logistics game load feedback',()=>{const nav=fs.readFileSync(new URL('../public/problem-nav.js',import.meta.url),'utf8'),baseball=fs.readFileSync(new URL('../public/baseball.html',import.meta.url),'utf8'),game=fs.readFileSync(new URL('../public/game.html',import.meta.url),'utf8');assert.match(nav,/loading-feedback\.js/);assert.match(baseball,/loading-feedback\.js/);assert.match(game,/loading-feedback\.js/)})

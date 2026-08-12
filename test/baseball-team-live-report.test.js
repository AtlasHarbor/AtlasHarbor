import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('team report prioritizes standing recent results next games roster and verified injuries',()=>{
 const page=read('../src/baseball-team-page.js');
 assert.match(page,/Last 10 games/);
 assert.match(page,/Next 5 games/);
 assert.match(page,/ACTIVE ROSTER/);
 assert.match(page,/Active injured list/);
 assert.match(page,/data-team-record/);
 assert.match(page,/data-team-division/);
 assert.match(page,/baseball-team-live\.js/);
 assert.doesNotMatch(page,/import\{mountWorkspace\}from'\/workspace\.js'/);
});

test('live team client polls once per minute and exposes live freshness',()=>{
 const js=read('../public/baseball-team-live.js');
 assert.doesNotThrow(()=>new Function(js.replace(/^const teamId=.*$/m,"const teamId='1';")));
 assert.match(js,/setInterval\(refresh,60000\)/);
 assert.match(js,/setInterval\(updateAge,1000\)/);
 assert.match(js,/data-live-age/);
 assert.match(js,/is-live/);
 assert.match(js,/team-last-ten/);
 assert.match(js,/team-next-five/);
 assert.match(js,/team-roster-live/);
 assert.match(js,/team-injuries-live/);
});

test('live team API derives injuries from MLB transactions instead of trusting injuredList rosterType',()=>{
 const js=read('../src/baseball-team-live-router.js');
 assert.doesNotThrow(()=>new Function(js.replace("import express from 'express';","const express={Router:()=>({get(){}})};").replace(/export function/g,'function')));
 assert.match(js,/transactions\?teamId=/);
 assert.match(js,/\(placed\|transferred\)/);
 assert.match(js,/\(reinstated\|activated\|returned\)/);
 assert.doesNotMatch(js,/rosterType=injuredList/);
 assert.match(js,/rosterType=active/);
 assert.match(js,/rosterType=40Man/);
});

test('live team API returns ten completed games five upcoming games standings and live status',()=>{
 const js=read('../src/baseball-team-live-router.js');
 assert.match(js,/slice\(0,10\)/);
 assert.match(js,/slice\(0,5\)/);
 assert.match(js,/standingsTypes=regularSeason/);
 assert.match(js,/liveGames:live/);
 assert.match(js,/Cache-Control','no-store/);
});

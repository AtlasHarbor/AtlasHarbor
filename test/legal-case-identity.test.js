import test from 'node:test';
import assert from 'node:assert/strict';
import {humanizeLegalLabel,isKalshiNewYorkEnforcement,withVerifiedCaseIdentity} from '../src/legal-router.js';

test('machine-style Legal labels become readable card copy',()=>{
 assert.equal(humanizeLegalLabel('removed_or_federally_docketed_enforcement_action'),'Removed or federally docketed enforcement action');
 assert.equal(humanizeLegalLabel('motions-practice'),'Motions practice');
});

test('New York v. KalshiEX resolves to the verified state and federal dockets',()=>{
 const corrected=withVerifiedCaseIdentity({
  slug:'new-york-v-kalshiex',
  title:'New York v. KalshiEX',
  shortTitle:'New York v. KalshiEX',
  court:'Supreme Court of the State of New York, New York County',
  proceduralStage:'removed_or_federally_docketed_enforcement_action',
  sources:[]
 });
 assert.equal(isKalshiNewYorkEnforcement(corrected),true);
 assert.equal(corrected.indexNumber,'1:26-cv-06550');
 assert.equal(corrected.stateCourt.docketNumber,'453272/2026');
 assert.equal(corrected.courtListener.docketId,73700030);
 assert.match(corrected.courtListener.courtListenerUrl,/\/docket\/73700030\//);
 assert.ok(corrected.sources.some(source=>source.url.includes('/docket/71766515/')));
 assert.ok(corrected.sources.some(source=>source.url.includes('/docket/73601450/')));
});

test('the separate Williams preemption action is not rewritten as the enforcement action',()=>{
 const original={title:'KalshiEX LLC v. Williams',indexNumber:'1:25-cv-08846',courtListener:{id:'71766515'}};
 const corrected=withVerifiedCaseIdentity(original);
 assert.equal(isKalshiNewYorkEnforcement(corrected),false);
 assert.equal(corrected.indexNumber,'1:25-cv-08846');
});

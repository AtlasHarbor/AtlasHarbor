import test from 'node:test';
import assert from 'node:assert/strict';
import {minBeneficiaries,validateMovementRequest,MOVEMENT_VERSES} from '../src/movement.js';
const example={title:'Shared repair tools for neighbors',description:'We have three people who can keep assisting other families with repairs after one shared toolbox is obtained.',verse_ref:'Galatians 6:2',how_help_others:'Three neighbors will continue repairing things for other residents in the community.',repeatable_step:'Share tools and train replacement volunteers.',requested_amount:100,beneficiaries_target:3};
test('each $100 needs three downstream beneficiaries',()=>{assert.equal(minBeneficiaries(0),1);assert.equal(minBeneficiaries(50),3);assert.equal(minBeneficiaries(100),3);assert.equal(minBeneficiaries(101),4);assert.equal(minBeneficiaries(200),6)});
test('validates verse and benefit chain',()=>{const row=validateMovementRequest(example);assert.match(row.verse_url,/galatians-6-2$/);assert.equal(row.beneficiaries_target,3);assert.ok(Object.keys(MOVEMENT_VERSES).length>8)});
test('rejects undercount and invalid verse',()=>{assert.throws(()=>validateMovementRequest({...example,requested_amount:200}));assert.throws(()=>validateMovementRequest({...example,verse_ref:'Fake 99:1'}))});

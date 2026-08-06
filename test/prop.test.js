import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildPropositionPrompt, normalizePropositionReport, parsePropositionJson } from '../src/proposition.js';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('parses fenced proposition JSON', () => {
  assert.deepEqual(parsePropositionJson('```json\n{"title":"Example"}\n```'), { title: 'Example' });
});

test('normalizes generic decision fields and economics', () => {
  const report = normalizePropositionReport({
    project_name: 'Internal Pilot',
    proposition_type: 'Internal work project',
    decision_requested: 'Approve the pilot',
    organizations: ['Operations'],
    budget: { base: 5000 },
    unit_economics: { price: 50, landed_cost: 15, fulfillment: 5, fees: 2, marketing: 3 }
  });
  assert.equal(report.proposition_type, 'Internal work project');
  assert.equal(report.decision_requested, 'Approve the pilot');
  assert.deepEqual(report.organizations, ['Operations']);
  assert.equal(report.unit_economics.contribution, 25);
  assert.equal(report.unit_economics.break_even_units, 200);
});

test('prompt does not force a market launch framework', () => {
  const prompt = buildPropositionPrompt({
    projectName: 'Shared Work Intake',
    propositionType: 'Internal work project',
    proposition: 'Create a structured work-intake pilot.',
    decisionRequested: 'Approve a 60-day pilot.',
    modules: ['stakeholders', 'implementation']
  });
  assert.match(prompt, /Do not force a market-launch framework/i);
  assert.match(prompt, /internal work project/i);
  assert.match(prompt, /decision_requested/);
  assert.match(prompt, /implementation_plan/);
});

test('prop route, compatibility redirect, navigation, and publishing are wired', () => {
  const router = read('src/problem-router.js');
  assert.match(router, /createPropositionRouter/);
  assert.match(router, /\['\/prop','\/prop\/\{\*path\}'\]/);
  assert.match(router, /replace\(\/\^\\\/go-to-market\//);
  assert.match(read('public/problem-nav.js'), /\['\/prop', 'Propositions'/);
  assert.match(read('public/prop.html'), /prop\.js/);
  assert.match(read('public/published-extensions.js'), /\/api\/prop\/reports/);
  assert.match(read('public/account-posts.js'), /go_to_market_report'\)return`\/prop\//);
  assert.match(read('public/profile.js'), /go_to_market_report:'Proposition'/);
});

test('builder includes work, partnership, sales, and launch examples', () => {
  const source = read('public/prop.js');
  assert.match(source, /Internal work project/);
  assert.match(source, /Partnership between companies/);
  assert.match(source, /B2B sales pitch/);
  assert.match(source, /Company partnership and product launch/);
});

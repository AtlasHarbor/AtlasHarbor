import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildResearchPrompt, normalizeGtmReport, parseResearchJson } from '../src/go-to-market.js';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('parses fenced provider JSON', () => {
  assert.deepEqual(parseResearchJson('```json\n{"title":"Example"}\n```'), { title: 'Example' });
});

test('normalizes unit economics and calculates break-even', () => {
  const report = normalizeGtmReport({ project_name: 'Example', unit_economics: { price: 50, landed_cost: 15, fulfillment: 5, fees: 2, marketing: 3 }, budget: { base: 5000 } });
  assert.equal(report.unit_economics.contribution, 25);
  assert.equal(report.unit_economics.margin_percent, 50);
  assert.equal(report.unit_economics.break_even_units, 200);
});

test('deduplicates sources and preserves direct URLs', () => {
  const report = normalizeGtmReport({ project_name: 'Example', sources: [{ title: 'Primary', url: 'https://example.com', claim: 'One' }, { title: 'Duplicate', url: 'https://example.com', claim: 'Two' }] });
  assert.equal(report.sources.length, 1);
  assert.equal(report.sources[0].url, 'https://example.com');
});

test('research prompt requires structured sourced output', () => {
  const prompt = buildResearchPrompt({ projectName: 'The Way', proposition: 'A premium minimalist apparel capsule', modules: ['demand', 'unit economics'] });
  assert.match(prompt, /Return only valid JSON/);
  assert.match(prompt, /Cite every quantitative/i);
  assert.match(prompt, /The Way/);
  assert.match(prompt, /unit economics/);
});

test('router and pages mount the problem space and publication extensions', () => {
  assert.match(read('src/problem-router.js'), /createGoToMarketRouter/);
  assert.match(read('src/problem-router.js'), /\/go-to-market/);
  assert.match(read('public/go-to-market.html'), /go-to-market\.js/);
  assert.match(read('public/legal.html'), /workspace-scope-toggle\.js/);
  assert.match(read('public/published.html'), /published-extensions\.js/);
});

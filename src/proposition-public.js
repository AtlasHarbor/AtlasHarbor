import express from 'express';
import { normalizePropositionReport } from './proposition.js';

const route = (handler) => async (req, res) => {
  try { await handler(req, res); }
  catch (error) {
    console.error('Public proposition request:', error);
    res.status(error.status || 500).json({ error: error.message || 'Public proposition request failed.' });
  }
};

function example(id, title, propositionType, proposition, decisionRequested, extra = {}) {
  return normalizePropositionReport({
    id,
    slug: id,
    user_id: 'atlas-harbor-demo',
    author_alias: 'Atlas Harbor example',
    title,
    project_name: title.split(' — ')[0],
    proposition_type: propositionType,
    proposition,
    decision_requested: decisionRequested,
    pitch_objective: decisionRequested,
    executive_summary: extra.executive_summary || proposition,
    recommendation: extra.recommendation || 'Use a bounded pilot with explicit evidence, implementation, and stop gates before making a larger commitment.',
    confidence: 'preliminary',
    model: 'starter-brief',
    needs_refresh: true,
    ...extra
  });
}

const EXAMPLES = [
  example(
    'work-intake-pilot-example',
    'Shared Work Intake — internal pilot',
    'Internal work project',
    'Replace fragmented request channels with one structured intake, triage, ownership, and prioritization pilot.',
    'Approve a 60-day pilot, named owners, and a capped implementation budget.',
    {
      organizations: ['Operations', 'Product', 'Customer Success'],
      current_state: 'Requests arrive through email, chat, meetings, and direct messages, creating duplicate work and unclear ownership.',
      problem_statement: 'Teams cannot consistently compare urgency, value, effort, and dependencies or show stakeholders where work stands.',
      decision_audience: 'Department leadership and team managers',
      why_now: 'Request volume and cross-functional work have grown beyond the current informal process.',
      timeline: '60-day pilot',
      financial_frame: 'Capped pilot budget; quantify staff time recovered before expansion.',
      implementation_plan: [
        { phase: 'Baseline', timing: 'Weeks 1–2', owner: 'Operations', objective: 'Measure current request volume, assignment time, clarification, and meeting load.', actions: ['Sample current requests', 'Define common fields', 'Confirm owners'], gate: 'Do not launch until the baseline and ownership rules are agreed.' },
        { phase: 'Pilot', timing: 'Weeks 3–8', owner: 'Cross-functional pilot team', objective: 'Run one shared intake and weekly prioritization process.', actions: ['Route selected requests', 'Track cycle time', 'Collect stakeholder feedback'], gate: 'Expand only if visibility improves without excessive administrative burden.' }
      ],
      success_measures: [
        { measure: 'Assignment time', target: 'Meaningful reduction from baseline', method: 'Compare median time before and during pilot', owner: 'Operations' },
        { measure: 'Status visibility', target: 'Most pilot stakeholders can find current status without a meeting', method: 'Stakeholder pulse survey', owner: 'Pilot lead' }
      ],
      alternatives: [
        { name: 'Keep the current informal process', description: 'Continue email, chat, and meeting-based intake.', advantages: ['No implementation cost'], disadvantages: ['Duplicate work and unclear ownership continue'], cost: 'Hidden staff time', timing: 'Immediate', evidence_needed: 'Current rework and meeting baseline' },
        { name: 'Buy or configure a full enterprise work-management system now', description: 'Make a larger platform commitment before validating the workflow.', advantages: ['Potentially broader capability'], disadvantages: ['Higher cost and change burden'], cost: 'Material', timing: 'Longer', evidence_needed: 'Validated requirements and adoption case' }
      ],
      risks: [
        { risk: 'The intake becomes administrative overhead', likelihood: 'Medium', impact: 'High', mitigation: 'Keep required fields minimal and measure handling time.' },
        { risk: 'Teams continue using side channels', likelihood: 'High', impact: 'Medium', mitigation: 'Limit the pilot scope, publish ownership rules, and review exceptions weekly.' }
      ],
      experiments: [
        { name: '60-day intake pilot', hypothesis: 'A shared intake reduces assignment delay and status-chasing without adding excessive administration.', budget: 0, duration: '60 days', success: 'Improved assignment time and visibility with acceptable handling effort.', stop: 'Stop or redesign if administrative time offsets the measured benefit.' }
      ]
    }
  ),
  example('company-partnership-example', 'Joint Market Intelligence — company partnership', 'Partnership between companies', 'Combine an analytics product with a trusted industry network in a bounded data and distribution pilot.', 'Authorize joint diligence and a six-month pilot.'),
  example('enterprise-sales-example', 'Uptime Analytics — sales case', 'B2B sales pitch', 'Run a paid one-site analytics pilot to identify recurring downtime patterns and prioritize interventions.', 'Approve technical discovery and a 12-week paid pilot.'),
  example('the-way-starter-brief', 'The Way — apparel partnership', 'Company partnership and product launch', 'Create a premium minimalist apparel capsule around “The Way” with discreet The Way Version attribution and partner-operated fulfillment.', 'Approve a gated partner pilot.')
];

const DEFAULT = { version: 2, reports: EXAMPLES, updatedAt: EXAMPLES[0].updated_at };

export function createPublicPropositionRouter({ storage } = {}) {
  if (!storage) throw new Error('Proposition storage is required.');
  const router = express.Router();

  async function current(req) {
    try { return (await storage.requestUser(req, { required: false })).current; }
    catch { return null; }
  }

  async function state(account = null) {
    try {
      const stored = await storage.readGlobal('go_to_market', { fallbackCurrent: account, defaults: DEFAULT });
      const merged = new Map(EXAMPLES.map((item) => [item.id, item]));
      for (const item of stored.reports || []) merged.set(item.id, item);
      return { ...DEFAULT, ...stored, reports: [...merged.values()] };
    } catch (error) {
      console.warn('Public proposition storage unavailable; serving built-in examples:', error.message);
      return DEFAULT;
    }
  }

  router.get('/api/prop/reports', route(async (req, res) => {
    const account = await current(req);
    const query = String(req.query.q || '').trim().toLowerCase().slice(0, 240);
    let reports = (await state(account)).reports?.filter((item) => item.status === 'published') || [];
    if (query) reports = reports.filter((item) => [
      item.title, item.project_name, item.proposition_type, item.proposition,
      item.decision_audience, item.decision_requested, item.geography,
      item.route_to_market, item.partner_profile, ...(item.organizations || [])
    ].join(' ').toLowerCase().includes(query));
    reports = reports
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
      .slice(0, 160)
      .map((item) => ({
        id: item.id,
        slug: item.slug,
        title: item.title,
        project_name: item.project_name,
        proposition_type: item.proposition_type || 'Proposition',
        organizations: item.organizations || [],
        proposition: item.proposition,
        decision_requested: item.decision_requested || item.pitch_objective,
        geography: item.geography,
        route_to_market: item.route_to_market,
        recommendation: item.recommendation,
        confidence: item.confidence,
        updated_at: item.updated_at,
        model: item.model,
        needs_refresh: item.needs_refresh,
        is_owner: account?.id === item.user_id
      }));
    res.set('Cache-Control', 'public,max-age=15,stale-while-revalidate=120');
    res.json({ reports, total: reports.length, storage: 'supabase-account-metadata-with-example-fallback' });
  }));

  router.get('/api/prop/reports/:id', route(async (req, res) => {
    const account = await current(req);
    const builtIn = EXAMPLES.find((item) => item.id === req.params.id || item.slug === req.params.id);
    const report = builtIn || (await state(account)).reports?.find((item) => item.id === req.params.id || item.slug === req.params.id);
    if (!report || report.status !== 'published') return res.status(404).json({ error: 'Proposition not found.' });
    res.set('Cache-Control', 'public,max-age=30,stale-while-revalidate=300');
    res.json({ report: { ...report, is_owner: account?.id === report.user_id } });
  }));

  return router;
}

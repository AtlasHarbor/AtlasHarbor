import './problem-nav.js';
import { accessToken, refreshSession, user, ai } from './supabase-client.js';
import { mountWorkspace } from './workspace.js';
import { renderGtmReport } from './go-to-market-render.js';
import { installWorkspaceScopeToggle } from './workspace-scope-toggle.js';

const root = document.querySelector('#go-to-market-root');
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const compact = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const key = () => localStorage.getItem('atlas-perplexity-key') || '';
const model = () => localStorage.getItem('atlas-perplexity-model') || 'sonar-pro';
let credentialReady = false;

async function request(url, options = {}, { authenticated = false, perplexity = false } = {}) {
  let token = accessToken();
  const run = () => fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.headers || {}),
      ...(authenticated && token ? { Authorization: `Bearer ${token}` } : {}),
      ...(perplexity && key() ? { 'x-perplexity-key': key() } : {})
    }
  });
  let response = await run();
  if (response.status === 401 && authenticated && token) {
    await refreshSession();
    token = accessToken();
    response = await run();
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

function parseJson(raw) {
  const text = String(raw || '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  const first = fenced.indexOf('{');
  const last = fenced.lastIndexOf('}');
  if (first < 0 || last <= first) throw new Error('Your AI did not return a complete JSON report.');
  return JSON.parse(fenced.slice(first, last + 1));
}

function credentialGate({ compactMode = false } = {}) {
  const current = user();
  const hasKey = Boolean(key());
  return `<section class="credential-gate ${compactMode ? 'compact' : ''}">
    <div><p class="eyebrow">RESEARCH CREDENTIAL</p><h2>${current ? (hasKey ? 'Validate Perplexity before research' : 'Add a Perplexity key to continue') : 'Sign in to create research'}</h2>
    <p>${current ? 'Your key stays in this browser and is sent only when you test or generate research. Atlas Harbor stores the resulting report, never the key.' : 'Public reports remain readable, but creating, regenerating, and saving research requires an Atlas Harbor account.'}</p></div>
    <div class="credential-actions">
      ${current && hasKey ? '<button type="button" data-test-perplexity>Refresh credential status</button>' : ''}
      ${current && !hasKey ? '<a class="button" href="/account#perplexity-key">Open Account settings</a>' : ''}
      ${!current ? '<a class="button" href="/account">Sign in</a>' : ''}
      <span data-credential-status>${credentialReady ? `Perplexity ${esc(model())} is validated for this session.` : hasKey ? 'Stored key has not been validated on this page.' : 'No browser-local key detected.'}</span>
    </div>
  </section>`;
}

async function bindCredentialGate(host = document) {
  for (const button of host.querySelectorAll('[data-test-perplexity]')) {
    button.onclick = async () => {
      const status = button.closest('.credential-gate')?.querySelector('[data-credential-status]');
      button.disabled = true;
      if (status) status.textContent = 'Testing Perplexity…';
      try {
        const data = await request('/api/go-to-market/perplexity/test', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: model() })
        }, { authenticated: true, perplexity: true });
        credentialReady = true;
        if (status) status.textContent = `Validated. ${data.model || model()} is ready for current-source research.`;
        document.querySelectorAll('[data-research-submit], [data-regenerate]').forEach((item) => { item.disabled = false; });
      } catch (error) {
        credentialReady = false;
        if (status) status.textContent = `Validation failed: ${error.message}`;
      } finally {
        button.disabled = false;
      }
    };
  }
}

const modules = [
  ['market size', 'Market size and reachable audience'],
  ['demographics', 'Demographics and audience segments'],
  ['demand', 'Demand signals and search behavior'],
  ['competitors', 'Competitors and positioning gaps'],
  ['channels', 'Channel fit and customer acquisition'],
  ['unit economics', 'Unit economics and break-even'],
  ['launch budget', 'Launch budget and cash needs'],
  ['partnership', 'Partner profile and deal structure'],
  ['creative', 'Creative and messaging direction'],
  ['risks', 'Risks and verification tasks'],
  ['90-day plan', 'Phased 90-day launch plan'],
  ['experiments', 'Validation experiments and stop rules']
];

function builder() {
  return `<section class="gtm-builder" ${user() ? '' : 'hidden'}><p class="eyebrow">CREATE RESEARCH</p><h2>Describe the proposition, then let the system build the decision case.</h2><p>The research prompt is generated from your answers, normalized into a consistent report schema, and rendered as infographics. Weak evidence becomes an assumption or research gap rather than a hidden claim.</p>
    <form id="gtm-form"><div class="gtm-form-grid">
      <label>Project or brand name<input name="projectName" required minlength="2" maxlength="180" placeholder="The Way"></label>
      <label>Website<input name="website" type="url" maxlength="800" placeholder="https://thewayversion.com/"></label>
      <label class="wide">What is the proposition?<textarea name="proposition" required minlength="20" maxlength="4000" rows="4" placeholder="Describe the product, service, business model, or partnership concept."></textarea></label>
      <label class="wide">Who should care?<textarea name="audience" maxlength="2000" rows="3" placeholder="Customers, buyers, users, decision-makers, and underserved segments."></textarea></label>
      <label>Geography<input name="geography" maxlength="180" value="United States"></label>
      <label>Route to market<select name="routeToMarket"><option>Direct-to-consumer</option><option>Partnership or licensing</option><option>B2B sales</option><option>Wholesale or retail</option><option>Marketplace</option><option>Hybrid</option></select></label>
      <label class="wide">Ideal partner or buyer profile<textarea name="partnerProfile" maxlength="1500" rows="3" placeholder="Capabilities, audience, manufacturing, distribution, budget, or strategic fit."></textarea></label>
      <label>Target price or contract value<input name="targetPrice" maxlength="120" placeholder="$42 retail or $50k annual contract"></label>
      <label>Current stage<input name="stage" maxlength="240" placeholder="Idea, prototype, waitlist, revenue, expansion"></label>
      <label class="wide">What must the research convince someone to do?<textarea name="pitchObjective" maxlength="1500" rows="3" placeholder="Approve a pilot, fund a launch, sign a partnership, choose a market, or stop the idea."></textarea></label>
      <label class="wide">Constraints and non-negotiables<textarea name="constraints" maxlength="2500" rows="3" placeholder="Budget, timeline, brand restrictions, geography, margin floor, compliance, manufacturing, or evidence standards."></textarea></label>
      <label class="wide">Additional research inquiry<textarea name="query" maxlength="6000" rows="4" placeholder="Add specific questions, hypotheses, companies, customer groups, or datasets to investigate."></textarea></label>
    </div><h3>Research modules</h3><div class="module-grid">${modules.map(([value, label]) => `<label><input type="checkbox" name="modules" value="${esc(value)}" checked>${esc(label)}</label>`).join('')}</div>
    <div class="gtm-actions"><button type="submit" data-research-submit ${credentialReady ? '' : 'disabled'}>Generate go-to-market analysis</button><a class="button secondary" href="/account#perplexity-key">Perplexity settings</a></div><p class="gtm-status" id="gtm-create-status"></p></form></section>`;
}

function reportCards(reports) {
  return reports.length ? reports.map((item) => `<a class="gtm-card" href="/go-to-market/${encodeURIComponent(item.id)}"><span>${esc(item.confidence)} confidence${item.needs_refresh ? ' · starter' : ''}</span><h3>${esc(item.title)}</h3><p>${esc(compact(item.proposition).slice(0, 190))}</p><footer><b>${esc(item.geography)}</b><time>${esc(new Date(item.updated_at).toLocaleDateString())}</time></footer></a>`).join('') : '<p>No public reports match this search.</p>';
}

async function showIndex() {
  const data = await request('/api/go-to-market/reports').catch(() => ({ reports: [] }));
  root.innerHTML = `<section class="gtm-index-hero"><div><p class="eyebrow">GO-TO-MARKET PROBLEM SPACE</p><h1>Turn a proposition into a research-backed decision case.</h1><p>Build current-source market analysis, audience segments, demand evidence, competitor maps, unit economics, launch budgets, partnership structures, validation experiments, and a publishable pitch.</p></div><aside><b>Designed for decisions</b><ol><li>Define the proposition.</li><li>Validate Perplexity.</li><li>Generate and lint research.</li><li>Refine with feedback or your AI.</li><li>Write and publish your own pitch.</li></ol></aside></section>
    ${credentialGate()}${builder()}
    <section class="gtm-library"><div class="gtm-library-head"><div><p class="eyebrow">PUBLIC RESEARCH</p><h2>Go-to-market reports</h2></div><input id="gtm-search" type="search" placeholder="Search projects, markets, partners, or propositions"></div><div id="gtm-card-grid" class="gtm-card-grid">${reportCards(data.reports || [])}</div></section>`;
  await bindCredentialGate(root);
  const form = root.querySelector('#gtm-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = root.querySelector('#gtm-create-status');
    if (!credentialReady) {
      status.textContent = 'Validate the Perplexity key on this page before generating research.';
      return;
    }
    const button = event.submitter;
    button.disabled = true;
    status.textContent = 'Researching the market, normalizing evidence, and building the report…';
    try {
      const formData = new FormData(form);
      const brief = Object.fromEntries(formData.entries());
      brief.modules = formData.getAll('modules');
      const result = await request('/api/go-to-market/reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief, model: model() })
      }, { authenticated: true, perplexity: true });
      location.assign(`/go-to-market/${encodeURIComponent(result.report.id)}`);
    } catch (error) {
      status.textContent = error.message;
      button.disabled = false;
    }
  });
  let timer;
  root.querySelector('#gtm-search')?.addEventListener('input', (event) => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const query = event.target.value.trim();
      const results = await request(`/api/go-to-market/reports?q=${encodeURIComponent(query)}`).catch(() => ({ reports: [] }));
      root.querySelector('#gtm-card-grid').innerHTML = reportCards(results.reports || []);
    }, 180);
  });
}

function ownerTools(report) {
  if (!report.is_owner && report.id !== 'the-way-starter-brief') return '';
  return `<section class="gtm-owner-tools"><p class="eyebrow">REFINE THE RESEARCH</p><h2>${report.is_owner ? 'Regenerate or optimize this report' : 'Use this starter as your first live research run'}</h2><label>Feedback for the next Perplexity research run<textarea id="gtm-feedback" rows="4" placeholder="Correct an assumption, deepen a market, compare partner types, update the budget, or add evidence requirements."></textarea></label><div class="gtm-actions"><button type="button" data-regenerate ${credentialReady ? '' : 'disabled'}>${report.is_owner ? 'Regenerate with Perplexity' : 'Create my researched version'}</button>${report.is_owner ? '<button type="button" class="secondary" data-ai-optimize>Optimize with my AI</button>' : ''}<a class="button secondary" href="/account">AI settings</a></div><p class="gtm-status" id="gtm-owner-status"></p></section>`;
}

async function optimizeWithAi(report) {
  const direction = document.querySelector('#gtm-feedback')?.value.trim() || 'Improve clarity, decision usefulness, internal consistency, and the partner pitch without inventing evidence.';
  const result = await ai([
    { role: 'system', content: 'You are a go-to-market report editor. Return one complete valid JSON object only. Preserve direct source URLs and clearly label unsupported estimates as assumptions. Do not fabricate sources, market sizes, competitor facts, or validation results.' },
    { role: 'user', content: `Edit this complete report while preserving its top-level structure. User direction: ${direction}\n\nREPORT:\n${JSON.stringify(report)}` }
  ], { surface: 'go_to_market_report', resourceId: report.id });
  const edited = parseJson(result.content);
  return request(`/api/go-to-market/reports/${encodeURIComponent(report.id)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ report: edited, model: result.model, changeSummary: direction })
  }, { authenticated: true });
}

async function showReport(id) {
  const data = await request(`/api/go-to-market/reports/${encodeURIComponent(id)}`, {}, { authenticated: Boolean(accessToken()) });
  const report = data.report;
  document.title = `${report.title} · Go-to-Market · Atlas Harbor`;
  root.innerHTML = `<p class="gtm-back"><a href="/go-to-market">← All go-to-market research</a></p>${renderGtmReport(report)}${credentialGate({ compactMode: true })}${ownerTools(report)}<div id="gtm-workspace"></div>`;
  await bindCredentialGate(root);
  const regenerate = root.querySelector('[data-regenerate]');
  regenerate?.addEventListener('click', async () => {
    const status = root.querySelector('#gtm-owner-status');
    if (!credentialReady) return void (status.textContent = 'Validate the Perplexity key first.');
    regenerate.disabled = true;
    status.textContent = 'Running a new current-source research pass…';
    try {
      const result = await request(`/api/go-to-market/reports/${encodeURIComponent(report.id)}/regenerate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: model(), feedback: root.querySelector('#gtm-feedback')?.value || '', modules: modules.map(([value]) => value) })
      }, { authenticated: true, perplexity: true });
      location.assign(`/go-to-market/${encodeURIComponent(result.report.id)}`);
    } catch (error) {
      status.textContent = error.message;
      regenerate.disabled = false;
    }
  });
  root.querySelector('[data-ai-optimize]')?.addEventListener('click', async (event) => {
    const status = root.querySelector('#gtm-owner-status');
    event.currentTarget.disabled = true;
    status.textContent = 'Running your selected AI editor…';
    try {
      await optimizeWithAi(report);
      status.textContent = 'Optimized report saved. Reloading…';
      location.reload();
    } catch (error) {
      status.textContent = `AI optimization failed: ${error.message}`;
      event.currentTarget.disabled = false;
    }
  });
  const workspace = root.querySelector('#gtm-workspace');
  await mountWorkspace(workspace, { type: 'go_to_market_report', id: report.id, title: report.title, context: report });
  await installWorkspaceScopeToggle({ host: workspace, resourceType: 'go_to_market_report', resourceId: report.id, label: 'Attach the full market research beneath the published article' });
}

const id = decodeURIComponent(location.pathname.replace(/^\/go-to-market\/?/, '').split('/')[0] || '');
(id ? showReport(id) : showIndex()).catch((error) => {
  root.innerHTML = `<section class="gtm-error"><h1>Go-to-market research unavailable</h1><p>${esc(error.message)}</p><p><a href="/go-to-market">Return to the research library</a></p></section>`;
});

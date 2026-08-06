const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const money = (value, currency = 'USD') => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: number >= 1000 ? 0 : 2 }).format(number);
};
const pct = (value) => `${Math.round(Number(value) || 0)}%`;
const list = (items) => `<ul>${(items || []).map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`;
const link = (url, label) => /^https?:\/\//i.test(String(url || ''))
  ? `<a href="${esc(url)}" target="_blank" rel="noreferrer">${esc(label || url)}</a>`
  : esc(label || url || 'Source');

function bars(items, valueKey, labelKey, detailKey) {
  const max = Math.max(1, ...(items || []).map((item) => Number(item?.[valueKey]) || 0));
  return `<div class="gtm-bars">${(items || []).map((item) => {
    const value = Math.max(0, Number(item?.[valueKey]) || 0);
    return `<div class="gtm-bar-row"><div class="gtm-bar-label"><b>${esc(item?.[labelKey])}</b><span>${esc(item?.[detailKey] || value)}</span></div><div class="gtm-bar-track"><span style="width:${Math.max(2, (value / max) * 100)}%"></span></div></div>`;
  }).join('')}</div>`;
}

function metricCards(report) {
  return `<div class="gtm-metrics">${(report.metrics || []).map((item) => `<article class="gtm-metric"><span>${esc(item.label)}</span><strong>${esc(item.value)}${item.unit ? `<small>${esc(item.unit)}</small>` : ''}</strong><p>${esc(item.detail)}</p><em>${esc(item.confidence || 'low')} confidence</em></article>`).join('')}</div>`;
}

function marketSizing(report) {
  const sizing = report.market_sizing || {};
  const rows = [
    { label: 'TAM', value: sizing.tam, note: 'Total planning envelope' },
    { label: 'SAM', value: sizing.sam, note: 'Reachable segment' },
    { label: 'SOM', value: sizing.som, note: 'Obtainable target' }
  ];
  return `<section class="gtm-section"><div class="gtm-section-head"><div><p class="eyebrow">MARKET ENVELOPE</p><h2>Market sizing and assumptions</h2></div><span class="gtm-confidence">${esc(report.confidence || 'preliminary')}</span></div><div class="gtm-sizing">${rows.map((row) => `<article><span>${row.label}</span><strong>${money(row.value, sizing.currency || 'USD')}</strong><small>${row.note}</small></article>`).join('')}</div>${sizing.label ? `<p class="gtm-note">${esc(sizing.label)}</p>` : ''}${list(sizing.assumptions)}</section>`;
}

function unitEconomics(report) {
  const unit = report.unit_economics || {};
  const currency = unit.currency || 'USD';
  const rows = [
    ['Retail price', unit.price],
    ['Landed product', unit.landed_cost],
    ['Fulfillment', unit.fulfillment],
    ['Payment and platform fees', unit.fees],
    ['Marketing allowance', unit.marketing],
    ['Contribution', unit.contribution]
  ];
  return `<section class="gtm-section"><p class="eyebrow">UNIT ECONOMICS</p><h2>What one order can support</h2><div class="gtm-unit-grid"><div>${rows.map(([label, value], index) => `<div class="gtm-unit-row ${index === rows.length - 1 ? 'total' : ''}"><span>${esc(label)}</span><strong>${money(value, currency)}</strong></div>`).join('')}</div><div class="gtm-margin"><span>Contribution margin</span><strong>${pct(unit.margin_percent)}</strong><div class="gtm-ring" style="--score:${Math.max(0, Math.min(100, Number(unit.margin_percent) || 0))}"></div><small>Break-even: ${Number(unit.break_even_units || 0).toLocaleString()} units</small></div></div>${list(unit.notes)}</section>`;
}

function budget(report) {
  const data = report.budget || {};
  const total = Math.max(1, ...(data.items || []).map((item) => Number(item.amount) || 0), Number(data.base) || 0);
  return `<section class="gtm-section"><p class="eyebrow">LAUNCH BUDGET</p><h2>Capital range and use</h2><div class="gtm-budget-range"><article><span>Lean</span><strong>${money(data.low)}</strong></article><article class="selected"><span>Base</span><strong>${money(data.base)}</strong></article><article><span>Expanded</span><strong>${money(data.high)}</strong></article></div><div class="gtm-budget-items">${(data.items || []).map((item) => `<div><div><b>${esc(item.label)}</b><span>${esc(item.category)}</span></div><strong>${money(item.amount)}</strong><i style="width:${Math.max(3, ((Number(item.amount) || 0) / total) * 100)}%"></i></div>`).join('')}</div>${list(data.notes)}</section>`;
}

function audience(report) {
  return `<section class="gtm-section"><p class="eyebrow">AUDIENCE</p><h2>Who has the strongest reason to care</h2><div class="gtm-audience-grid">${(report.audience_segments || []).map((item) => `<article><div class="gtm-donut" style="--score:${Math.max(0, Math.min(100, Number(item.share) || 0))}"><strong>${pct(item.share)}</strong></div><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><small><b>Need:</b> ${esc(item.need)}</small><small><b>Reach through:</b> ${esc(item.channel)}</small></article>`).join('')}</div></section>`;
}

function demand(report) {
  return `<section class="gtm-section"><p class="eyebrow">DEMAND SIGNALS</p><h2>What supports the proposition — and what still needs proof</h2>${bars(report.demand_signals || [], 'score', 'signal', 'score')}<div class="gtm-signal-notes">${(report.demand_signals || []).map((item) => `<article><h3>${esc(item.signal)} <span>${esc(item.confidence)}</span></h3><p>${esc(item.evidence)}</p><small>Verify: ${esc(item.verification)}</small></article>`).join('')}</div></section>`;
}

function partnership(report) {
  const item = report.partnership || {};
  return `<section class="gtm-section gtm-partnership"><p class="eyebrow">PARTNERSHIP CASE</p><h2>What a capable partner needs to believe</h2><div class="gtm-two-col"><article><h3>Ideal partner</h3><p>${esc(item.ideal_partner)}</p><h3>Operating structure</h3><p>${esc(item.structure)}</p><h3>Value to the partner</h3><p>${esc(item.partner_value)}</p></article><article><h3>The ask</h3><p>${esc(item.ask)}</p><h3>Terms to settle</h3><p>${esc(item.terms)}</p><h3>Proof required</h3>${list(item.proof_needed)}</article></div></section>`;
}

function channelsAndCompetitors(report) {
  return `<section class="gtm-section"><div class="gtm-two-col"><article><p class="eyebrow">CHANNEL FIT</p><h2>Best routes to market</h2>${bars(report.channels || [], 'fit', 'name', 'fit')}${(report.channels || []).map((item) => `<div class="gtm-compact"><b>${esc(item.name)}</b><span>${esc(item.cost)} · ${esc(item.speed)}</span><p>${esc(item.notes)}</p></div>`).join('')}</article><article><p class="eyebrow">COMPETITIVE SPACE</p><h2>Where the proposition can be distinct</h2>${(report.competitors || []).map((item) => `<div class="gtm-competitor"><h3>${item.url ? link(item.url, item.name) : esc(item.name)}</h3><p>${esc(item.positioning)}</p><small><b>Range:</b> ${esc(item.price_range || 'Research required')}</small><small><b>Advantage:</b> ${esc(item.advantage)}</small><small><b>Open gap:</b> ${esc(item.gap)}</small></div>`).join('')}</article></div></section>`;
}

function launchPlan(report) {
  return `<section class="gtm-section"><p class="eyebrow">GO-TO-MARKET PLAN</p><h2>Phased launch with decision gates</h2><div class="gtm-timeline">${(report.launch_plan || []).map((item, index) => `<article><span>${index + 1}</span><div><small>${esc(item.timing)}</small><h3>${esc(item.phase)}</h3><p>${esc(item.objective)}</p>${list(item.actions)}<div class="gtm-gate"><b>Decision gate</b>${esc(item.gate)}</div></div></article>`).join('')}</div></section>`;
}

function creative(report) {
  const item = report.creative_direction || {};
  return `<section class="gtm-section"><p class="eyebrow">CREATIVE DIRECTION</p><h2>How the proposition should show up</h2><div class="gtm-creative"><article><span>Front</span><p>${esc(item.front)}</p></article><article><span>Back</span><p>${esc(item.back)}</p></article><article><span>Tag</span><p>${esc(item.tag)}</p></article><article><span>Material</span><p>${esc(item.materials)}</p></article><article><span>Packaging</span><p>${esc(item.packaging)}</p></article></div><div class="gtm-campaigns">${(item.campaigns || []).map((campaign) => `<blockquote>${esc(campaign)}</blockquote>`).join('')}</div></section>`;
}

function experimentsAndRisks(report) {
  return `<section class="gtm-section"><div class="gtm-two-col"><article><p class="eyebrow">VALIDATION EXPERIMENTS</p><h2>What to test before scaling</h2>${(report.experiments || []).map((item) => `<div class="gtm-experiment"><h3>${esc(item.name)}</h3><p>${esc(item.hypothesis)}</p><small>${money(item.budget)} · ${esc(item.duration)}</small><b>Success</b><p>${esc(item.success)}</p><b>Stop rule</b><p>${esc(item.stop)}</p></div>`).join('')}</article><article><p class="eyebrow">RISKS</p><h2>What could break the case</h2>${(report.risks || []).map((item) => `<div class="gtm-risk"><div><h3>${esc(item.risk)}</h3><span>${esc(item.likelihood)} likelihood · ${esc(item.impact)} impact</span></div><p>${esc(item.mitigation)}</p></div>`).join('')}</article></div></section>`;
}

function evidence(report) {
  return `<section class="gtm-section"><p class="eyebrow">EVIDENCE AND QUALITY CONTROL</p><h2>Sources, assumptions, and research gaps</h2><div class="gtm-source-grid">${(report.sources || []).map((item) => `<article><h3>${link(item.url, item.title)}</h3><span>${esc([item.publisher, item.date].filter(Boolean).join(' · '))}</span><p>${esc(item.claim)}</p></article>`).join('')}</div><div class="gtm-two-col"><article><h3>Assumptions</h3>${list(report.assumptions)}</article><article><h3>Research gaps</h3>${list(report.research_gaps)}</article></div></section>`;
}

export function renderGtmReport(report, { embedded = false } = {}) {
  if (!report) return '<p>Report unavailable.</p>';
  return `<div class="gtm-report ${embedded ? 'gtm-report-embedded' : ''}">
    <section class="gtm-report-hero"><div><p class="eyebrow">GO-TO-MARKET RESEARCH</p><h1>${esc(report.title)}</h1><p>${esc(report.proposition)}</p><div class="gtm-hero-meta"><span>${esc(report.geography)}</span><span>${esc(report.route_to_market)}</span><span>${esc(report.model)}</span></div></div><aside><span>Recommendation</span><p>${esc(report.recommendation)}</p><small>${esc(report.confidence)} confidence · updated ${esc(new Date(report.updated_at || report.generated_at).toLocaleDateString())}</small></aside></section>
    ${report.needs_refresh ? '<div class="gtm-refresh-warning"><b>Starter brief:</b> Quantitative assumptions require a live Perplexity refresh before use in a consequential pitch.</div>' : ''}
    <section class="gtm-section gtm-summary"><p class="eyebrow">EXECUTIVE SUMMARY</p><p>${esc(report.executive_summary)}</p></section>
    ${metricCards(report)}
    ${audience(report)}
    ${demand(report)}
    ${marketSizing(report)}
    ${unitEconomics(report)}
    ${budget(report)}
    ${partnership(report)}
    ${channelsAndCompetitors(report)}
    ${creative(report)}
    ${launchPlan(report)}
    ${experimentsAndRisks(report)}
    ${evidence(report)}
  </div>`;
}

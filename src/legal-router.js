import express from 'express';

const MINUTE = 60 * 1000;
const KALSHI_FEDERAL_DOCKET = '1:26-cv-06550';
const KALSHI_STATE_DOCKET = '453272/2026';
const KALSHI_COURTLISTENER_ID = '73700030';
const KALSHI_COURTLISTENER_URL = 'https://www.courtlistener.com/docket/73700030/people-of-the-state-of-new-york-by-letitia-james-attorney-general-of-the/';
const KALSHI_STATE_URL = 'https://iapps.courts.state.ny.us/nyscef/DocumentList?courtType=New+York+County+Supreme+Court&display=all&docketId=BKqVr8gO8%2FWSZgsgX0Pm5w%3D%3D&resultsPageNum=1';

const route = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || 'Legal request failed.' });
  }
};

export function humanizeLegalLabel(value) {
  const cleaned = String(value ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned ? `${cleaned[0].toUpperCase()}${cleaned.slice(1)}` : '';
}

function source(title, url, supports, type = 'primary') {
  return { title, url, type, supports };
}

function mergeSources(existing = [], additions = []) {
  const rows = [...additions, ...(Array.isArray(existing) ? existing : [])];
  const seen = new Set();
  return rows.filter((item) => {
    const url = String(item?.url || '').trim();
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

export function isKalshiNewYorkEnforcement(item = {}) {
  const identity = [
    item.slug,
    item.title,
    item.shortTitle,
    item.indexNumber,
    item.courtListener?.docketNumber,
    item.courtListener?.docketId,
    item.courtListener?.id
  ].filter(Boolean).join(' ').toLowerCase();
  return identity.includes(KALSHI_FEDERAL_DOCKET)
    || identity.includes(KALSHI_STATE_DOCKET.toLowerCase())
    || identity.includes(KALSHI_COURTLISTENER_ID)
    || (/new[\s-]*york/.test(identity) && /kalshi/.test(identity) && !/kalshiex llc v\.? williams/.test(identity));
}

export function withVerifiedCaseIdentity(item) {
  if (!item) return item;
  const humanized = {
    ...item,
    status: humanizeLegalLabel(item.status || 'Pending'),
    proceduralStage: humanizeLegalLabel(item.proceduralStage || item.matterType || 'Case review'),
    matterType: humanizeLegalLabel(item.matterType || '')
  };
  if (!isKalshiNewYorkEnforcement(humanized)) return humanized;

  const sources = mergeSources(humanized.sources, [
    source(
      'CourtListener docket · New York v. KalshiEX LLC',
      KALSHI_COURTLISTENER_URL,
      `Federal removal docket ${KALSHI_FEDERAL_DOCKET}, including docket entries and available RECAP documents.`
    ),
    source(
      'New York County Supreme Court docket',
      KALSHI_STATE_URL,
      `Originating state enforcement action ${KALSHI_STATE_DOCKET}.`
    ),
    source(
      'Related matter · KalshiEX LLC v. Williams',
      'https://www.courtlistener.com/docket/71766515/kalshiex-llc-v-williams/',
      'Separate preemption action, S.D.N.Y. docket 1:25-cv-08846. Do not merge its filings with the New York enforcement action.',
      'related'
    ),
    source(
      'Related appeal · KalshiEX LLC v. Williams',
      'https://www.courtlistener.com/docket/73601450/kalshiex-llc-v-williams/',
      'Separate Second Circuit appeal, docket 26-1835.',
      'related'
    )
  ]);

  const currentPosition = humanized.docketEntries?.length
    ? humanized.decisionBoard?.currentPosition
    : `New York filed enforcement action ${KALSHI_STATE_DOCKET} in New York County Supreme Court. Kalshi removed it to the Southern District of New York as ${KALSHI_FEDERAL_DOCKET}. Synchronize the linked CourtListener docket for the current filings and available RECAP documents.`;

  return {
    ...humanized,
    title: humanized.courtListener?.caseName || 'People of the State of New York, by Letitia James, Attorney General of the State of New York v. KalshiEX LLC',
    shortTitle: 'New York v. KalshiEX',
    court: 'U.S. District Court for the Southern District of New York; removed from New York Supreme Court, New York County',
    indexNumber: KALSHI_FEDERAL_DOCKET,
    status: humanized.status === 'Closed' ? 'Closed' : 'Active',
    proceduralStage: humanized.courtListener?.lastSyncedAt && humanized.proceduralStage !== 'Case review'
      ? humanized.proceduralStage
      : 'Removed to federal court',
    matterType: 'State enforcement action removed to federal court',
    filedAt: humanized.filedAt || '2026-07-30',
    stateCourt: {
      court: 'New York Supreme Court, New York County',
      docketNumber: KALSHI_STATE_DOCKET,
      url: KALSHI_STATE_URL
    },
    relatedMatters: [
      { title: 'KalshiEX LLC v. Williams', court: 'S.D.N.Y.', docketNumber: '1:25-cv-08846', courtListenerUrl: 'https://www.courtlistener.com/docket/71766515/kalshiex-llc-v-williams/' },
      { title: 'KalshiEX LLC v. Williams', court: 'Second Circuit', docketNumber: '26-1835', courtListenerUrl: 'https://www.courtlistener.com/docket/73601450/kalshiex-llc-v-williams/' }
    ],
    courtListener: {
      ...(humanized.courtListener || {}),
      id: KALSHI_COURTLISTENER_ID,
      docketId: Number(KALSHI_COURTLISTENER_ID),
      courtId: 'nysd',
      docketNumber: KALSHI_FEDERAL_DOCKET,
      stateDocketNumber: KALSHI_STATE_DOCKET,
      courtListenerUrl: KALSHI_COURTLISTENER_URL
    },
    sources,
    decisionBoard: {
      ...(humanized.decisionBoard || {}),
      stage: humanized.decisionBoard?.stage || 'Removed to federal court',
      currentPosition,
      actionQueue: humanized.decisionBoard?.actionQueue?.length ? humanized.decisionBoard.actionQueue : [
        'Read the notice of removal and the state-court pleading before analyzing the merits.',
        'Confirm whether a remand motion, jurisdictional response, or emergency-relief request is pending.',
        'Keep the separate KalshiEX LLC v. Williams preemption suit and its appeal in a related-matters track rather than combining their filings.',
        'Calendar deadlines only from the operative federal docket entry or order.'
      ],
      openQuestions: humanized.decisionBoard?.openQuestions?.length ? humanized.decisionBoard.openQuestions : [
        'What claims and requested relief were removed from state court?',
        'What federal-jurisdiction or preemption issues control the next decision?',
        'Has either side requested remand, emergency relief, consolidation, or coordination with the Williams matter?',
        'Which filing creates the next response or hearing deadline?'
      ]
    },
    dataQuality: {
      ...(humanized.dataQuality || {}),
      identity: `Verified federal docket ${KALSHI_FEDERAL_DOCKET}; CourtListener docket ${KALSHI_COURTLISTENER_ID}; originating state docket ${KALSHI_STATE_DOCKET}.`
    }
  };
}

function withCourtListenerLink(input) {
  if (!input) return input;
  const item = withVerifiedCaseIdentity(input);
  const sources = Array.isArray(item.sources) ? [...item.sources] : [];
  const exact = item.courtListener?.courtListenerUrl || sources.find((entry) => /courtlistener\.com\/docket\//i.test(entry?.url || ''))?.url;
  if (exact) return { ...item, courtListener: { ...(item.courtListener || {}), courtListenerUrl: exact }, sources };
  const query = item.indexNumber || item.courtListener?.docketNumber || item.title || item.shortTitle;
  const url = `https://www.courtlistener.com/?type=r&q=${encodeURIComponent(query || '')}`;
  if (!sources.some((entry) => entry.url === url)) {
    sources.unshift({
      title: 'Find this matter on CourtListener',
      url,
      type: 'discovery',
      supports: 'CourtListener search by docket number or caption; run synchronization to save the exact docket URL.'
    });
  }
  return { ...item, courtListener: { ...(item.courtListener || {}), searchUrl: url }, sources };
}

export function createLegalRouter({ service, fetchImpl = globalThis.fetch } = {}) {
  if (!service) throw new Error('Legal service is required.');
  const router = express.Router();
  const hits = new Map();

  function limited(key, windowMs = MINUTE) {
    const current = Date.now();
    const last = hits.get(key) || 0;
    if (current - last < windowMs) return true;
    hits.set(key, current);
    if (hits.size > 2000) {
      for (const [item, time] of hits) if (current - time > 10 * MINUTE) hits.delete(item);
    }
    return false;
  }

  async function correctedRecord(slug) {
    const original = await service.getCase(slug);
    if (!original) return null;
    const corrected = withVerifiedCaseIdentity(original);
    if (isKalshiNewYorkEnforcement(corrected)) await service.saveCase(corrected);
    return corrected;
  }

  async function syncCase(req, res) {
    const key = `sync:${req.ip}:${req.params.slug}`;
    if (limited(key)) throw Object.assign(new Error('This case was just requested. CourtListener synchronization is limited to one request per minute and cached for five minutes.'), { status: 429 });
    const corrected = await correctedRecord(req.params.slug);
    if (!corrected) return res.status(404).json({ error: 'Case not found.' });
    const result = await service.refreshFromCourtListener(req.params.slug, {
      force: isKalshiNewYorkEnforcement(corrected),
      trigger: 'public-endpoint'
    });
    res.json(result);
  }

  // Persist verified identities early, then use the ordinary non-AI CourtListener
  // pipeline to populate docket entries and available RECAP documents.
  const primeTimer = setTimeout(async () => {
    try {
      const cases = await service.listCases();
      for (const compact of cases.filter(isKalshiNewYorkEnforcement).slice(0, 2)) {
        const corrected = await correctedRecord(compact.slug);
        if (corrected && service.courtListenerTokenConfigured) {
          await service.refreshFromCourtListener(compact.slug, { force: true, trigger: 'verified-identity-startup' });
        }
      }
    } catch (error) {
      console.warn('Verified Legal identity startup:', error.message);
    }
  }, 20000);
  primeTimer.unref?.();

  router.get('/api/legal/status', route(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await service.status());
  }));
  router.post('/api/legal/seed', route(async (req, res) => {
    if (limited(`seed:${req.ip}`)) throw Object.assign(new Error('The Legal seed endpoint can be called once per minute.'), { status: 429 });
    const result = await service.seed({ force: false });
    res.status(result.alreadyInitialized ? 200 : 201).json(result);
  }));
  router.get('/api/legal/cases', route(async (_req, res) => {
    res.set('Cache-Control', 'public,max-age=30,stale-while-revalidate=300');
    res.json({ cases: (await service.listCases()).map(withCourtListenerLink) });
  }));
  router.get('/api/legal/cases/:slug', route(async (req, res) => {
    const item = withCourtListenerLink(await service.getCase(req.params.slug));
    if (!item) return res.status(404).json({ error: 'Case not found.' });
    res.set('Cache-Control', 'public,max-age=30,stale-while-revalidate=300');
    res.json(item);
  }));
  router.get('/api/legal/cases/:slug/docket', route(async (req, res) => {
    const item = withCourtListenerLink(await service.getCase(req.params.slug));
    if (!item) return res.status(404).json({ error: 'Case not found.' });
    res.json({
      case: {
        slug: item.slug,
        title: item.title,
        court: item.court,
        indexNumber: item.indexNumber,
        courtListener: item.courtListener,
        stateCourt: item.stateCourt,
        relatedMatters: item.relatedMatters,
        sources: item.sources
      },
      entries: item.docketEntries || [],
      documents: item.documents || [],
      parties: item.parties || [],
      decisionBoard: item.decisionBoard || null
    });
  }));
  router.get('/api/legal/cases/:slug/documents', route(async (req, res) => {
    const item = await service.getCase(req.params.slug);
    if (!item) return res.status(404).json({ error: 'Case not found.' });
    res.json({ documents: item.documents || [] });
  }));
  router.get('/api/legal/cases/:slug/documents/:id', route(async (req, res) => {
    const item = await service.document(req.params.slug, req.params.id);
    if (!item) return res.status(404).json({ error: 'Document not found.' });
    res.set('Cache-Control', 'public,max-age=300');
    res.json({ document: item });
  }));
  router.post('/api/legal/cases/:slug/sync', route(syncCase));
  router.post('/api/legal/cases/:slug/refresh', route(syncCase));
  router.post('/api/legal/cases/:slug/analysis-context', route(async (req, res) => {
    await service.authUser(req);
    const context = await service.analysisContext(req.params.slug, {
      question: String(req.body?.question || '').slice(0, 4000),
      documentIds: Array.isArray(req.body?.documentIds) ? req.body.documentIds.slice(0, 8) : []
    });
    if (!context) return res.status(404).json({ error: 'Case not found.' });
    res.json(context);
  }));
  router.post('/api/legal/cases/:slug/ask-perplexity', route(async (req, res) => {
    const { current } = await service.authUser(req);
    const key = `ask:${current.id}:${req.params.slug}`;
    if (limited(key, 30000)) throw Object.assign(new Error('Wait 30 seconds before starting another Perplexity request for this case. Identical requests are cached for five minutes.'), { status: 429 });
    const apiKey = String(req.get('x-perplexity-key') || '').trim();
    const result = await service.askPerplexity(req.params.slug, {
      question: String(req.body?.question || '').trim().slice(0, 6000),
      documentIds: Array.isArray(req.body?.documentIds) ? req.body.documentIds.slice(0, 8) : [],
      apiKey,
      model: String(req.body?.model || 'sonar-pro').slice(0, 120)
    });
    res.json(result);
  }));
  router.post('/api/legal/perplexity/test', route(async (req, res) => {
    await service.authUser(req);
    const apiKey = String(req.get('x-perplexity-key') || '').trim();
    if (!apiKey) throw Object.assign(new Error('Perplexity API key required.'), { status: 400 });
    const response = await fetchImpl('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: String(req.body?.model || 'sonar-pro').slice(0, 120),
        messages: [{ role: 'user', content: 'Reply with only: legal research ready' }],
        temperature: 0
      }),
      signal: AbortSignal.timeout(30000)
    });
    const body = await response.text();
    let data = {};
    try { data = JSON.parse(body); } catch {}
    if (!response.ok) throw Object.assign(new Error(data?.error?.message || data?.message || body || `Perplexity returned ${response.status}.`), { status: response.status });
    res.json({ ok: true, model: data.model || req.body?.model, response: data.choices?.[0]?.message?.content || '' });
  }));
  return router;
}

import express from 'express';

const MINUTE = 60 * 1000;
const route = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || 'Legal request failed.' });
  }
};

function withCourtListenerLink(item) {
  if (!item) return item;
  const sources = Array.isArray(item.sources) ? [...item.sources] : [];
  const exact = item.courtListener?.courtListenerUrl || sources.find((source) => /courtlistener\.com\/docket\//i.test(source?.url || ''))?.url;
  if (exact) return { ...item, courtListener: { ...(item.courtListener || {}), courtListenerUrl: exact }, sources };
  const query = item.indexNumber || item.courtListener?.docketNumber || item.title || item.shortTitle;
  const url = `https://www.courtlistener.com/?type=r&q=${encodeURIComponent(query || '')}`;
  if (!sources.some((source) => source.url === url)) {
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
  async function syncCase(req, res) {
    const key = `sync:${req.ip}:${req.params.slug}`;
    if (limited(key)) throw Object.assign(new Error('This case was just requested. CourtListener synchronization is limited to one request per minute and cached for five minutes.'), { status: 429 });
    const result = await service.refreshFromCourtListener(req.params.slug, { force: false, trigger: 'public-endpoint' });
    if (!result) return res.status(404).json({ error: 'Case not found.' });
    res.json(result);
  }

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
    res.json({ case: { slug: item.slug, title: item.title, court: item.court, indexNumber: item.indexNumber, courtListener: item.courtListener, sources: item.sources }, entries: item.docketEntries || [], documents: item.documents || [], parties: item.parties || [], decisionBoard: item.decisionBoard || null });
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
    const context = await service.analysisContext(req.params.slug, { question: String(req.body?.question || '').slice(0, 4000), documentIds: Array.isArray(req.body?.documentIds) ? req.body.documentIds.slice(0, 8) : [] });
    if (!context) return res.status(404).json({ error: 'Case not found.' });
    res.json(context);
  }));
  router.post('/api/legal/cases/:slug/ask-perplexity', route(async (req, res) => {
    const { current } = await service.authUser(req);
    const key = `ask:${current.id}:${req.params.slug}`;
    if (limited(key, 30000)) throw Object.assign(new Error('Wait 30 seconds before starting another Perplexity request for this case. Identical requests are cached for five minutes.'), { status: 429 });
    const apiKey = String(req.get('x-perplexity-key') || '').trim();
    const result = await service.askPerplexity(req.params.slug, { question: String(req.body?.question || '').trim().slice(0, 6000), documentIds: Array.isArray(req.body?.documentIds) ? req.body.documentIds.slice(0, 8) : [], apiKey, model: String(req.body?.model || 'sonar-pro').slice(0, 120) });
    res.json(result);
  }));
  router.post('/api/legal/perplexity/test', route(async (req, res) => {
    await service.authUser(req);
    const apiKey = String(req.get('x-perplexity-key') || '').trim();
    if (!apiKey) throw Object.assign(new Error('Perplexity API key required.'), { status: 400 });
    const response = await fetchImpl('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: String(req.body?.model || 'sonar-pro').slice(0, 120), messages: [{ role: 'user', content: 'Reply with only: legal research ready' }], temperature: 0 }),
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

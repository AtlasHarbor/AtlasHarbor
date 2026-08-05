# Atlas Harbor

Atlas Harbor is a decision platform organized around inspectable **Problem Spaces**. Each space turns a difficult real-world question into structured data, explicit tradeoffs, user notes, AI-assisted analysis, collaboration, and optional public publishing.

## Problem Spaces

- `/economics` — current economic headlines converted into decision problems and discussion surfaces.
- `/game` — an exception-driven logistics control-tower game. See [`docs/logistics-game/README.md`](docs/logistics-game/README.md) for the player loop, routing model, persistence, optimization mapping, known limitations, and deployment checklist.
- `/baseball` — professional, minor-league, and college baseball intelligence.
- `/legal` — CourtListener-backed case records, dockets, primary filings, decision boards, and filing-aware analysis. See [`docs/legal/README.md`](docs/legal/README.md).
- `/food` — restaurant and food discovery under real constraints.
- `/dropshipping` — product hypotheses, unit economics, advertising experiments, and measured results.
- `/life-sciences` — research questions, evidence, experiments, and translation.
- `/featured` — work selected by the global quality system.
- `/published` — public user analysis.
- `/problems` — directory and public requests for future spaces.

## Logistics game

The logistics game uses management by exception: routine production and safe dispatch can be delegated, while the player handles breakdowns, port congestion, customer changes, quality holds, and capital-allocation decisions.

Truck routes use OSRM/OpenStreetMap road geometry through `src/game-routing.js`; rail, air, and ocean movements use mode-specific corridors. Vehicle position, journey percentage, and ETA are calculated from the same routed path. Signed-in progress is stored in Supabase account metadata under `atlas_problem_spaces.logistics_game`, with local storage as an immediate fallback and optional import from the legacy `game_progress` table.

The detailed manual distinguishes what is implemented today from future operations-research mechanics, including shortest path, weighted scheduling, capital allocation, capacity planning, stochastic control, network flow, and the difference between current fixed-stop contracts and a true traveling-salesman or capacitated vehicle-routing problem.

- Browser manual: `/game/docs`
- Technical and design manual: [`docs/logistics-game/README.md`](docs/logistics-game/README.md)

## Legal case command center

Legal is database-first and CourtListener/RECAP-first. It no longer depends on AI to determine whether a docket changed.

The storage order is:

1. The optional dedicated Supabase `legal_cases` table.
2. Shared Supabase account metadata at `atlas_problem_spaces.legal_tracker`.
3. Repository JSON files in `data/legal/cases` as bootstrap seeds and a read-only fallback.

`POST /api/legal/seed` initializes the persistent store when it is empty. Ordinary users do not need to run a SQL migration.

With `COURTLISTENER_API_TOKEN` configured, a non-AI synchronization saves structured docket metadata, docket entries, parties, RECAP document records, direct public PDF links, the latest filing date, judges, sources, and a decision board. The Admin control plane can seed Legal storage, synchronize one case, or synchronize a bounded batch without invoking OpenRouter or Perplexity.

Case pages are organized around the current procedural position, an action queue, unresolved questions, primary filings, and a document workbench. Signed-in users can select filings and ask their configured AI to review only the bounded synchronized case context. Users may also keep a personal Perplexity key in browser local storage. Admin can use an encrypted Admin key or `PERPLEXITY_API_KEY` for optional current-source research after the CourtListener record is synchronized.

Public APIs include:

```text
GET  /api/legal/status
POST /api/legal/seed
GET  /api/legal/cases
GET  /api/legal/cases/:slug
GET  /api/legal/cases/:slug/docket
GET  /api/legal/cases/:slug/documents
GET  /api/legal/cases/:slug/documents/:id
POST /api/legal/cases/:slug/sync
```

The complete architecture, endpoint reference, rate limits, source hierarchy, AI rules, and deployment checklist are in [`docs/legal/README.md`](docs/legal/README.md).

## Problem Space persistence standard

New Problem Spaces must **work after deployment without requiring a person to open the Supabase SQL editor**.

The standard implementation is:

1. The browser talks to an Atlas Harbor API route. It must not reference a Supabase table name directly.
2. The API authenticates the Supabase bearer token when a write or private read is required.
3. Shared Problem Space data is stored through `src/problem-space-storage.js` under the host account’s `user_metadata.atlas_problem_spaces` object.
4. User-only preferences, categories, drafts, and filters are stored under that user’s own `user_metadata.atlas_problem_spaces` object.
5. Shared writes are serialized in the application process to reduce metadata overwrite races.
6. Collections are bounded and trimmed. A dedicated database adapter can replace metadata storage when a space grows beyond the bootstrap scale, without changing its public API.
7. Missing optional tables must never produce an instruction telling an ordinary user to run SQL.

This pattern is used by Economics, Dropshipping, Legal, and the logistics career. The existing Admin control plane uses the related `user_metadata.atlas_admin` store.

A dedicated Supabase table remains appropriate for high-volume records, complex joins, realtime subscriptions, or large public archives. That is a scaling implementation detail, not a prerequisite for the feature to function.

## Economics publication feed

Economics is **headline-first**. A slow or incompatible model can no longer prevent stories from appearing.

The run sequence is:

1. Fetch the configured RSS, Atom, or JSON feed.
2. Parse only the publication title, URL, permitted feed summary, and publication date.
3. Deduplicate against previously stored source URLs.
4. Save every new headline immediately as a usable decision problem with baseline questions and topics.
5. Enrich a bounded number of new stories in batches of three using the primary OpenAI-compatible provider saved in Admin; use the saved backup provider if needed.
6. Keep the original headline as the displayed title. AI supplies decision framing, questions, and topics rather than rewriting the source title.
7. If a Perplexity key is saved in Admin Research, optionally add brief current-source context and citations. If no Perplexity key exists, that step is skipped.
8. Record the start time, completion time, trigger, counts, models, warnings, elapsed time, and recent run history.

The default is eight fetched stories and up to six AI enrichments per run. Existing Admin values are preserved, and the maximum remains configurable.

### Economics endpoints

```text
GET  /api/economics/problems   public story feed
GET  /api/economics/status     current run, last result, errors, and recent run log
POST /api/economics/run        public asynchronous trigger
```

The trigger is limited to one accepted run per minute and returns immediately with a `runId`. Clients poll the status endpoint instead of holding a request open while OpenRouter or Perplexity works.

Admin uses the same pipeline:

```text
GET  /api/admin/economics/settings
PUT  /api/admin/economics/settings
POST /api/admin/economics/run
```

The background scheduler checks once per minute and starts a run when the saved cadence is due. Enabling a 12-hour cadence therefore performs real work; it is not an empty timer.

The feed and run history are stored in the initialized Admin account metadata. `supabase/economics-feed.sql` is now a **legacy optional migration**, not a requirement.

Use publication feeds in accordance with their terms. Retain attribution and links, ingest only metadata or permitted summaries, and do not reproduce paywalled article text.

## Dropshipping & Advertising

Dropshipping no longer calls `dropship_strategies`, `strategy_comments`, or other PostgREST tables from the browser. It works without `supabase/dropshipping-space.sql`.

The page is organized as a decision workspace:

- searchable product-type lens near the top,
- shared Atlas Harbor product-type defaults,
- private product types added only to the signed-in user’s account,
- product evidence and fulfillment risk,
- selling price, supplier cost, shipping, target CPA, budget, and contribution preview,
- a human decision thesis,
- a separately stored AI challenge,
- explicit success and kill criteria,
- measured results added after the experiment,
- optional comments, funding interest, and private creator contact requests.

Published decision briefs and their discussion records use shared application-managed metadata. Personal categories and filters use the individual user’s metadata. A creator can see funding and contact requests in the strategy’s creator inbox.

`supabase/dropshipping-space.sql` and `supabase/direct-messaging-fix.sql` remain available only for legacy installations that intentionally retain the old table-backed implementation.

## Global AI and administration

The first signed-in Supabase user to initialize `/admin` becomes `master_admin`. The administrator can configure:

- primary and backup OpenAI-compatible endpoints, models, and encrypted keys,
- quality-review instructions and budget,
- Economics feed settings and cadence,
- Perplexity Legal/Economics research settings,
- non-AI CourtListener Legal synchronization,
- legal case recommendations.

Provider keys are encrypted using:

```bash
ADMIN_ENCRYPTION_KEY=YOUR_LONG_STABLE_RANDOM_SECRET
```

Economics always uses the provider and model saved in Admin, not the AI model selected in an ordinary user’s Account page. CourtListener Legal synchronization does not require any AI provider.

## Comments and publishing

Comments are off by default. A creator must explicitly enable them. Canonical legal, baseball, Economics, and other source pages remain separate from user publications.

Public analysis uses separate links:

```text
/published/<share-token>
```

## Food Discovery

Food Discovery can use public map data without credentials. Optional Google Places enrichment adds ratings, review counts, hours, excerpts, and maps links:

```bash
GOOGLE_PLACES_API_KEY=YOUR_SERVER_SIDE_GOOGLE_PLACES_KEY
```

## Supabase setup

The application requires Supabase Auth credentials and a server secret for shared metadata persistence:

```bash
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=YOUR_SUPABASE_SECRET_KEY
SUPABASE_JWKS_URL=https://YOUR_PROJECT_REF.supabase.co/auth/v1/.well-known/jwks.json
PUBLIC_APP_URL=http://localhost:3000
ADMIN_ENCRYPTION_KEY=YOUR_LONG_STABLE_RANDOM_SECRET
COURTLISTENER_API_TOKEN=YOUR_COURTLISTENER_API_TOKEN
PERPLEXITY_API_KEY=OPTIONAL_SERVER_MANAGED_PERPLEXITY_KEY
```

Some older or high-volume features still have SQL migrations in `supabase/`. They are deployment-specific adapters. Economics, Dropshipping, Legal bootstrap storage, and logistics career persistence do not require their legacy migrations.

## Run locally

Requires Node.js 20 or later.

```bash
cp .env.example .env
npm install
npm start
npm test
```

Open `http://localhost:3000/`.

## Responsible use

Atlas Harbor is experimental decision support. News-derived problems, product claims, restaurant data, sports data, legal records, scientific evidence, model output, quality scores, and projections may be incomplete, stale, biased, manipulated, or wrong. Verify consequential information with primary sources. User publications and comments are personal views, not official records, legal advice, medical advice, investment advice, or guaranteed recommendations.

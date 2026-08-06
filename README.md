# Atlas Harbor

Atlas Harbor is a decision platform organized around inspectable **Problem Spaces**. Each space turns a difficult real-world question into structured evidence, constraints, objectives, explicit tradeoffs, user notes, AI-assisted analysis, collaboration, and optional public publishing.

## Core Problem Space loop

Every Problem Space should:

1. define the problem and decision,
2. identify stakeholders and decision-makers,
3. collect structured evidence,
4. separate hard constraints from preferences,
5. state the objective,
6. compare feasible actions,
7. expose tradeoffs, uncertainty, and verification tasks,
8. let the human make the decision,
9. persist the decision and outcome for later learning.

Routine collection and ranking should be automated. The user should spend time on judgment, exceptions, and consequences.

## Problem Spaces

- `/economics` — economic stories converted into decision problems.
- `/game` — a playable competitive logistics network. See [`docs/logistics-game/README.md`](docs/logistics-game/README.md).
- `/logistics` — research, maps, routes, scenarios, and publishable 3PL recommendations. See [`docs/logistics-planner/README.md`](docs/logistics-planner/README.md).
- `/leads` — verified and ranked B2B lead discovery, knowledge graphs, and outreach drafting. See [`docs/leads/README.md`](docs/leads/README.md).
- `/prop` — source-backed propositions for work projects, partnerships, sales pitches, investments, programs, products, and market decisions. See [`docs/prop/README.md`](docs/prop/README.md).
- `/legal` — CourtListener-backed dockets, filings, decision boards, and legal research. See [`docs/legal/README.md`](docs/legal/README.md).
- `/baseball` — professional, Minor League, and college baseball intelligence.
- `/food` — a location-first food decision planner. See [`docs/food/README.md`](docs/food/README.md).
- `/dropshipping` — product hypotheses, unit economics, advertising experiments, and measured results.
- `/life-sciences` — research questions, evidence, experiments, and translation.
- `/featured` — work selected by the global quality system.
- `/published` — public user analysis.
- `/problems` — the public directory and requests for future spaces.

## Workspace and publishing architecture

**Database first. Recovery always. Never database only.**

Every Problem Space uses the same private workspace, publishing API, sharing rules, public feed, profiles, comments, and recovery system. The full contract is documented in [`docs/WORKSPACE_ARCHITECTURE.md`](docs/WORKSPACE_ARCHITECTURE.md).

The required recovery order is:

1. the same-origin Atlas Harbor workspace API,
2. `workspace_notes`,
3. account metadata,
4. legacy and virtual records, including `legal_notes`,
5. a browser device copy as a last-resort safety net.

A previous “database-only” refactor removed the fallback layers and made the browser depend on a direct Supabase request. A `Failed to fetch` error then made existing Legal analysis and publications appear missing even though the records still existed. Do not remove recovery layers merely to simplify persistence code. New layers may be added only with a migration, rollback path, and regression coverage.

Supabase `sb_secret_...` keys are opaque API keys, not JWTs. Server code must use `src/supabase-server-key.js`; it must never send an opaque secret as `Authorization: Bearer`.

New Problem Spaces must reuse:

- `createProblemSpaceStorage()` for metadata-backed project records,
- `/api/workspaces/:resourceType/:resourceId` for private analysis,
- `workspace.js` for the editor and AI drafting,
- `workspace-scope-toggle.js` for optional underlying-research attachment,
- `/api/published-feed` for public articles,
- the shared profile, comment, discovery, and publication surfaces.

Do not create browser-direct Supabase dependencies or custom workspace tables for one Problem Space.

## Lead Discovery

Lead Discovery answers: **Who should we contact, why now, and what should we say?**

The intake captures the offer, objective, requested decision, constraints, exclusions, target roles, geography, known domains, knowledge-base context, and research questions. Perplexity verifies current company relevance, triggers, likely needs, fit, timing, risks, and sources.

Apollo is an optional candidate-discovery provider. Its key stays in the browser. Apollo search results are candidate records rather than proof of fit, and Atlas Harbor does not invent contact emails. Generated projects can include:

- ideal-customer profile and segments,
- ranked organizations and people,
- fit and timing scores,
- current triggers and evidence,
- disqualifiers and verification steps,
- a company/person/need/evidence knowledge graph,
- cold email, LinkedIn, follow-up, and meeting-request drafts,
- a path into `/prop` for a lead-specific proposition.

Projects persist without a new table:

```text
user_metadata.atlas_problem_spaces.lead_discovery.projects
```

## Logistics Planner

Logistics Planner complements the game with real-world 3PL decision support. It captures shipments, facilities, modes, capacities, rates, coordinates, time windows, service levels, risks, and routing constraints. It can use Perplexity for current research and the user’s OpenRouter-compatible model for analysis in the shared workspace.

Outputs can include:

- mapped facilities and customer nodes,
- route and lane comparisons,
- baseline, lowest-cost, fastest, and resilient scenarios,
- bottlenecks, capacity risks, KPIs, and assumptions,
- implementation phases and verification tasks,
- publishable recommendations linked to the logistics game’s concepts.

Projects persist without a new table:

```text
user_metadata.atlas_problem_spaces.logistics_planner.projects
```

Coordinates, rates, transit times, regulations, capacity, and service availability must be sourced or clearly marked for verification. The planner must preserve the game’s routing invariants and must not invent unsupported corridors.

## Propositions

Propositions begins with the decision being requested rather than assuming every idea is a market launch. It supports internal projects, company partnerships, sales pitches, investments, programs, policies, vendors, products, brands, and market entries.

The guided brief captures the current state, problem, audience, requested action, why now, scope, timeline, financial frame, constraints, available evidence, and research questions. Perplexity supplies current external research where relevant. The normalizer separates sourced evidence, user context, calculations, assumptions, recommendations, and verification tasks.

`/go-to-market` redirects to `/prop`; existing metadata and workspace records remain compatible.

## Persistence standard

New Problem Spaces must work after deployment without requiring an ordinary user to open the Supabase SQL editor.

1. The browser talks to an Atlas Harbor API route rather than a table name.
2. The API authenticates Supabase bearer tokens for private reads and writes.
3. Shared bootstrap-scale data uses host-account metadata.
4. User projects, preferences, drafts, and saved decisions use the user’s metadata.
5. Local storage provides immediate resilience where appropriate.
6. Collections are bounded and shared writes are serialized.
7. A dedicated table may replace metadata later without changing the public API.
8. Missing optional tables must never produce instructions telling an ordinary user to run SQL.

## Provider keys

Ordinary-user OpenRouter, Perplexity, and Apollo keys remain browser-local and are sent only when the user explicitly starts or tests the corresponding request. Keys are not written to account metadata or the repository.

## Supabase and provider setup

```bash
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=YOUR_SUPABASE_SECRET_KEY
SUPABASE_JWKS_URL=https://YOUR_PROJECT_REF.supabase.co/auth/v1/.well-known/jwks.json
PUBLIC_APP_URL=http://localhost:3000
ADMIN_ENCRYPTION_KEY=YOUR_LONG_STABLE_RANDOM_SECRET
COURTLISTENER_API_TOKEN=OPTIONAL_COURTLISTENER_TOKEN
PERPLEXITY_API_KEY=OPTIONAL_SERVER_PERPLEXITY_KEY
GOOGLE_PLACES_API_KEY=OPTIONAL_SERVER_SIDE_GOOGLE_PLACES_KEY
MAP_PROVIDER=openstreetmap
MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
```

## Run locally

Requires Node.js 20 or later.

```bash
cp .env.example .env
npm install
npm run check
npm test
npm start
```

Open `http://localhost:3000/`.

## Responsible use

Atlas Harbor is experimental decision support. Provider data, lead identities, roles, contact status, logistics routes, rates, legal records, proposition research, food data, scientific evidence, model output, and projections may be incomplete, stale, biased, manipulated, or wrong. Verify consequential information with primary sources and the relevant provider, authority, or professional. Follow privacy, anti-spam, consent, provider terms, transportation, safety, and regulatory requirements. User publications and comments are personal views, not official records or professional advice.

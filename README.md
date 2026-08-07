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

- `/economics` — economic stories converted into decision problems and publishable user analysis.
- `/game` — a playable competitive logistics network. See [`docs/logistics-game/README.md`](docs/logistics-game/README.md).
- `/logistics` — research, maps, routes, scenarios, and publishable 3PL recommendations. See [`docs/logistics-planner/README.md`](docs/logistics-planner/README.md).
- `/leads` — verified and ranked B2B lead discovery, knowledge graphs, and outreach drafting. See [`docs/leads/README.md`](docs/leads/README.md).
- `/prop` — source-backed propositions for work projects, partnerships, sales pitches, investments, programs, products, and market decisions. See [`docs/prop/README.md`](docs/prop/README.md).
- `/legal` — CourtListener-backed dockets, filings, decision boards, and legal research. See [`docs/legal/README.md`](docs/legal/README.md).
- `/baseball` — professional, Minor League, and college baseball intelligence.
- `/food` — a location-first food decision planner. See [`docs/food/README.md`](docs/food/README.md).
- `/dropshipping` — product hypotheses, unit economics, advertising experiments, and measured results.
- `/life-sciences` — public scientific problems with evidence maps, hypotheses, AI-assisted solution workspaces, publishing, and discussion.
- `/featured` — work selected by the global quality system.
- `/published` — public user analysis.
- `/problems` — the public directory and requests for future spaces.

## Workspace and publishing architecture

**One writable source of truth: the Supabase-backed account workspace. Never create a device-only workspace.**

Every Problem Space uses the same private workspace, sharing rules, public feed, and profile/discovery surfaces. The full contract and incident history are documented in [`docs/WORKSPACE_ARCHITECTURE.md`](docs/WORKSPACE_ARCHITECTURE.md).

The canonical record is stored in the signed-in user's account metadata:

```text
user_metadata.atlas_problem_spaces.publishing_workspace.notes
```

There are two allowed ways to reach that **same** database record:

1. preferred: `/api/workspaces/:resourceType/:resourceId`,
2. recovery transport: direct authenticated Supabase Auth user-metadata access with the existing browser session and publishable key.

The second path is not a local copy and not a second persistence layer. It exists so a temporary Atlas Harbor API routing/deployment failure does not make a user's existing database-backed analysis disappear. If both database transports fail, the UI shows a retry state and does not create a local draft.

Older `workspace_notes`, `legal_notes`, and virtual account-metadata records are read-only recovery inputs. They may be copied into the canonical account workspace, but new workspace writes must not create new virtual/device records.

Two historical regressions are specifically prohibited:

1. treating the direct account-database transport as if it were a conflicting persistence source and removing it; this caused `Failed to fetch` on `/api/workspaces` to make valid database records appear unavailable,
2. calling browser `rest('workspace_notes')` for publishing; when the optional table was unavailable, an old virtual fallback encoded the entire article into `share_token`, creating huge URLs and sometimes `/published/undefined`.

New share tokens are compact random database/server tokens. The public feed may expose short `pub-...` aliases for old malformed tokens so existing publications remain recoverable. The publication-link UI consumes the workspace record returned by Save/Publish instead of doing a second storage lookup.

The “attach full underlying research” option is part of the same workspace record (`share_scope`) and is persisted in the same Save/Publish operation. It must not perform a second independent write after publishing.

Supabase `sb_secret_...` keys are opaque API keys, not JWTs. Server code must use `src/supabase-server-key.js`; it must never send an opaque secret as `Authorization: Bearer`.

New Problem Spaces must reuse:

- `createProblemSpaceStorage()` for metadata-backed domain/project records,
- the shared canonical account workspace and its two database transports,
- `workspace.js` for the editor and AI drafting,
- `workspace-scope-toggle.js` for optional underlying-research attachment state,
- `/api/published-feed` for public articles,
- the shared profile, discovery, and publication surfaces.

Do not create localStorage workspace persistence, browser-direct optional-table publishing, or custom persistence paths for one Problem Space.

## Life Sciences

Life Sciences is a collaborative Problem Space rather than a static landing page. Any signed-in user can add a public scientific problem with a research question, domain, population/system, mechanism or hypothesis, measurable outcomes, existing evidence, contradictions, constraints and safety boundaries, translation path, uncertainties, and source links.

The public problem remains separate from each user's private analysis. Signed-in users can mount the shared database workspace on a problem, use their configured AI to help draft or critique an analysis, publish a shareable solution, and optionally attach the full underlying Life Sciences problem beneath the article. This is research collaboration only and is not a clinical, medical, biosafety, or regulatory decision tool.

## Research-credential gates

Research-heavy builders must validate required credentials **before the user spends time completing the intake**.

- Propositions require a signed-in account and a validated browser-local Perplexity key before the proposition form is interactive.
- Lead Discovery requires a signed-in account and a validated browser-local Perplexity key before the lead intake is interactive. Apollo remains optional.
- A missing or invalid required key produces a blocking credential card with a link to Account settings rather than allowing the user to complete the form and fail at submission time.

## Lead Discovery

Lead Discovery answers: **Who should we contact, why now, and what should we say?**

The intake captures the offer, objective, requested decision, constraints, exclusions, target roles, geography, known domains, knowledge-base context, and research questions. Perplexity verifies current company relevance, triggers, likely needs, fit, timing, risks, and sources.

Apollo is an optional candidate-discovery provider. Its key stays in the browser. Apollo search results are candidate records rather than proof of fit, and Atlas Harbor does not invent contact emails. Generated projects can include ideal-customer profiles, ranked organizations and people, fit/timing scores, evidence and triggers, verification steps, a knowledge graph, and outreach drafts.

Projects persist without a new table:

```text
user_metadata.atlas_problem_spaces.lead_discovery.projects
```

## Logistics Planner

Logistics Planner complements the game with real-world 3PL decision support. It captures shipments, facilities, modes, capacities, rates, coordinates, time windows, service levels, risks, and routing constraints. It can use Perplexity for current research and the user’s OpenRouter-compatible model for analysis in the shared workspace.

Projects persist without a new table:

```text
user_metadata.atlas_problem_spaces.logistics_planner.projects
```

Coordinates, rates, transit times, regulations, capacity, and service availability must be sourced or clearly marked for verification.

## Propositions

Propositions begins with the decision being requested rather than assuming every idea is a market launch. It supports internal projects, company partnerships, sales pitches, investments, programs, policies, vendors, products, brands, and market entries.

The guided brief captures the current state, problem, audience, requested action, why now, scope, timeline, financial frame, constraints, available evidence, and research questions. Perplexity supplies current external research where relevant. `/go-to-market` redirects to `/prop`; existing metadata and workspace records remain compatible.

## Persistence standard

New Problem Spaces must work after deployment without requiring an ordinary user to open the Supabase SQL editor.

1. Workspace content has one writable canonical database record in account metadata.
2. `/api/workspaces` is the preferred transport for private reads and writes.
3. Direct authenticated Supabase Auth metadata access is the allowed recovery transport to the same record if `/api/workspaces` is temporarily unreachable.
4. Shared bootstrap-scale data uses host-account metadata.
5. User projects, preferences, drafts, and saved decisions use database-backed account metadata.
6. Workspace content never falls back to a device-only local copy.
7. Optional legacy/virtual records are recovery inputs, not new write targets.
8. Collections are bounded and shared writes are serialized.
9. A dedicated table may replace metadata later without changing the public API.
10. Missing optional tables must never produce instructions telling an ordinary user to run SQL.

## CI dependency rule

CI uses `npm ci`, so `package.json` and `package-lock.json` must stay synchronized. If a dependency is truly needed, update the lockfile in the same change. If code does not import/use a dependency, do not leave it in `package.json`. `test/package-lock-sync.test.js` guards this invariant.

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

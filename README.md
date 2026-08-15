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

# Persistence and database handoff

Read this section **before changing storage, authentication, workspace bootstrap, publishing, or the logistics career**. Atlas Harbor intentionally has two different persistence contracts. They must not be merged into one generic fallback strategy.

## Contract A — analytical workspaces and publishing

Legal analysis, Baseball analysis, Economics analysis and other publishable Problem Space workspaces use **one writable database source of truth**.

Canonical private workspace record (one top-level key per resource):

```text
user_metadata.atlas_workspace_record_v2_<resource-key>
```

Older `user_metadata.atlas_problem_spaces.publishing_workspace.notes` arrays remain readable migration inputs. New saves update only the one resource record being edited, so a Baseball note never resends unrelated account projects, game progress, or every prior publication.

Rules:

- The editable analysis is database-backed account state.
- Do **not** create a `localStorage` analysis/workspace fallback.
- Do **not** create a device-only draft when the database cannot be reached.
- Do **not** create a second browser virtual table or optional-table write path.
- Multiple transports are allowed only when they reach the **same canonical account record**.
- Public publishing is derived from the saved workspace record; publishing must not invent a second persistence model.

The complete contract is in [`docs/WORKSPACE_ARCHITECTURE.md`](docs/WORKSPACE_ARCHITECTURE.md).

### Workspace transport order

A signed-in analytical workspace may reach the same canonical account record through these recovery layers:

1. preferred: `GET/PUT /api/workspaces/:resourceType/:resourceId`,
2. read-only recovery: the last server-confirmed account metadata already present in the signed-in session,
3. write transport recovery: XHR and then same-origin form navigation to the Atlas Harbor workspace API.

These are transports, not separate stores.

Workspace recovery does not depend on `fetch('/api/config')` and does not call Supabase persistence endpoints from the browser. Authentication may still use the public Supabase URL and publishable key; analysis persistence remains behind Atlas Harbor's same-origin API.

Baseball additionally installs `workspace-transport-fallback.js`. It first retries a failed browser `fetch()` to `/api/workspaces/...` using `XMLHttpRequest`. If both scripted transports fail during an authenticated `PUT`, it submits the same payload and access token through a hidden same-origin form to `/api/workspaces-form/...`. Every path invokes the same server save function and writes the same canonical account record; none creates a Baseball-specific or device-only store. This matters for a player's **first** analysis, because there may be no matching session-metadata row to recover yet.

If every database transport fails and no matching authenticated account record is already available, show a retryable database error. Do not fabricate an editable local copy.

## Contract B — logistics game career

The `/game` career intentionally supports offline play, so it has a synchronized local representation and account representation:

```text
localStorage["atlas-game-state"]
user_metadata.atlas_problem_spaces.logistics_game.progress
```

`public/progress-v2.js` uses newest-copy-wins plus account ownership isolation:

- a newer offline career can sync up after sign-in,
- a newer account career can refresh the device copy,
- one account's local career must not overwrite another account on a shared browser,
- game time, finance, staffing, fleet, tutorial state and operations all belong to the same career object.

**Never copy this offline-game rule into Legal/Baseball/Economics publishing workspaces.** Offline game continuity and database-only analytical workspaces are deliberately different product requirements.

## Incident history — do not regress these fixes

Several failures looked like “lost analysis” even though the underlying data had not necessarily been deleted. These are now architectural regression cases.

### 1. `/api/workspaces` failed and the browser tried to bypass it

Symptom:

```text
PRIVATE DATABASE WORKSPACE
Analysis could not load
Database workspace unavailable: Failed to fetch
```

A temporary API transport failure made valid account analysis appear unavailable. A later recovery attempt added browser-direct Supabase Auth metadata reads and writes. That bypass made the failure harder to diagnose and exposed an internal persistence transport in the browser.

**Fix:** keep one database source of truth and one same-origin workspace API boundary. Browser transport recovery may retry that API with fetch, XHR, or same-origin form navigation, but workspace code never reads or writes Supabase Auth metadata directly.

### 2. The recovery path depended on `/api/config` through the same failing fetch stack

Symptom included two network failures, such as:

```text
Database workspace unavailable: Failed to fetch. Workspace service: Failed to fetch
```

The former direct-database fallback first tried to fetch configuration from the same origin using the same failing browser fetch mechanism.

**Fix:** use matching authenticated session metadata only as read-only display recovery while the API reconnects. Save and Publish still go through the same-origin workspace API.

### 3. Signed-out `/published` worked while signed-in `/published` showed zero stories

Cause: a logged-in bearer token changed the Supabase RLS role for what should have been a public publication query. Anonymous and authenticated roles could therefore return different public rows.

**Hard invariant:** `GET /api/published-feed` is a session-independent public list request. Viewer Authorization must not affect that list. The browser strips viewer auth for the list request and the server independently removes any Authorization header before the public feed router. Authentication may be used on publication **detail/owner-control** flows, but signing in must never reduce the public list.

### 4. Legacy browser publishing created giant share URLs or `/published/undefined`

An old browser-side virtual `workspace_notes` fallback could encode an entire publication into a share token when an optional table was unavailable.

**Fix:** new share tokens are compact random database/server tokens. Public-feed recovery can expose stable short `pub-...` aliases for malformed historical tokens. The publication-link UI consumes the canonical workspace returned by Save/Publish instead of performing another independent storage lookup.

### 5. Attachment scope performed a second write after publishing

The “attach full underlying research” switch used to perform another workspace request after the main Save/Publish. A successful publication could therefore be followed by a misleading failure.

**Fix:** `share_scope` is part of the same canonical workspace Save/Publish transaction. The scope control only changes workspace UI state until the next canonical save.

### 6. Baseball first-analysis bootstrap failed even after Legal recovery worked

Legal often had an existing account-metadata analysis that could be recovered immediately. A Baseball player with no prior analysis did not. The bootstrap treated “no saved row yet” plus a failed fetch as if the workspace itself could not exist.

**Fix:** a missing existing row is a valid empty workspace state for an authenticated user, and Baseball has a same-endpoint XHR transport fallback for `/api/workspaces/...`. Baseball uses the same `baseball_player` workspace and publishing architecture as Legal.

The empty first-analysis response is read-only bootstrap behavior. Save and Publish must reach the server. If fetch and XHR both raise browser network errors, the form-navigation transport posts to `/api/workspaces-form/:resourceType/:resourceId`, which delegates to the exact canonical save routine used by `PUT /api/workspaces/...`.

### 7. Save Draft timed out after redundant server and browser fallbacks

A workspace write used to load the record first, query optional legacy tables, read the authenticated Supabase user multiple times, serialize every user's write behind one global queue, update account metadata, and fire a second optional table mirror. When that chain stalled, the browser retried it through multiple transports and finally attempted a direct `/auth/v1/user` write. The form-navigation fallback then timed out.

**Fix:** one Save/Publish now performs one server-side authenticated user read and one canonical metadata update. Optional tables are read-only migration inputs, writes are queued per user, upstream calls have bounded timeouts, and the browser never calls Supabase Auth metadata as a workspace persistence fallback.

### 8. Baseball Save/Publish returned 413 and the form fallback reported a timeout

The JSON workspace route accepted only 64 KB, while the form-navigation route accepted 160 KB. URL encoding expands rich HTML and Unicode, so an otherwise valid analysis could fit the editor's 60,000-character body limit but exceed either transport limit. The form parser's default 413 HTML response could not post a result back to its parent iframe, which turned a concrete size rejection into a misleading 20-second database timeout.

The server also sent the user's entire `user_metadata` document to Supabase for every note change. Unrelated logistics state, research projects, and prior posts could therefore make even a tiny player edit exceed an upstream request limit.

**Fix:** JSON accepts 1 MB, form navigation accepts 3 MB, and a parser rejection returns an immediate structured result instead of timing out. Workspace updates send one bounded `atlas_workspace_record_v2_<resource-key>` patch only. The saved record contains the headline, sanitized editor HTML (up to 60,000 characters), AI prompt (up to 12,000 characters), projections, and sharing/publication fields—not the Baseball page payload or unrelated account data.

### 9. The account badge said Logged in while Save Draft returned Sign in required

The badge previously trusted any cached `user` object, even when its bearer token had expired. At the same time, multiple authenticated requests could independently refresh Supabase's rotating refresh token. A late failed refresh could erase the newer session created by a successful request, leaving the workspace retry without a valid bearer token.

**Fix:** access tokens are refreshed before expiry, refresh work is shared by all callers in a page, and a stale refresh may not overwrite or clear a newer session. Workspace requests use that centralized authenticated transport. The account badge is informational and does not run a second blocking API preflight; the workspace request itself verifies authorization.

### 10. Valid signed-in sessions were rejected by the workspace API

The first workspace implementation wrote through the authenticated browser client. The August 6 server-API migration correctly moved persistence behind Atlas Harbor, but it made Supabase's remote `/auth/v1/user` endpoint the mandatory first step for every workspace load and save. Subsequent fetch, XHR, form, refresh, payload-size, and API-key fixes all still depended on that same call, so a valid browser session could continue receiving `401` before any player record was read.

**Fix:** the Atlas Harbor server now validates asymmetric Supabase access tokens against the project's cached JWKS, checks the issuer, audience, authenticated role, expiry, and subject, then loads that exact account with the server-only credential. Saves use Supabase Auth's partial user-metadata merge to write only `atlas_workspace_record_v2_<resource-key>`. The remote user endpoint remains only a compatibility fallback for legacy token formats or temporary JWKS discovery failures. A forged, expired, wrong-project, or wrong-role token is rejected before account storage is accessed.

## Public-feed invariant

**Logging in must never make `/published` show fewer public stories.**

Public `workspace_notes` and legacy publication rows are queried with the anonymous/publishable Supabase role whether or not the viewer is signed in. The public list request itself must not carry viewer Authorization. Viewer identity is reserved for ownership controls and account recovery where needed.

Older `workspace_notes`, `legal_notes`, and virtual account-metadata records are read-only recovery inputs. They may be copied into the canonical account workspace, but new workspace writes must not create new virtual/device records.

Supabase `sb_secret_...` keys are opaque API keys, not JWTs. Server code must use `src/supabase-server-key.js`; it must never send an opaque secret as `Authorization: Bearer`.

## Shared workspace/publishing components

New Problem Spaces must reuse:

- `createProblemSpaceStorage()` for metadata-backed domain/project records,
- the shared canonical account workspace and its resilient database transports,
- `workspace.js` for the editor and AI drafting,
- `workspace-scope-toggle.js` for optional underlying-research attachment state,
- `/api/published-feed` for public articles,
- the shared profile, discovery, and publication surfaces.

Do not create localStorage workspace persistence, browser-direct optional-table publishing, auth-dependent public-feed visibility, or a custom persistence path for one Problem Space.

## Logistics game handoff

The logistics game is a worldwide 3PL management simulation. Its current objective is:

> **Fill customer orders. Protect promises. Stay solvent. Build the most resilient global 3PL.**

At 1×, **15 real minutes = 1 game hour**. The game clock, physical network, staffing/procurement lead times and working capital use the same saved career time. On load, a synchronized approximately **10-second** replay visualizes the prior operating window moving toward the authoritative current state; it does not create separate visual progress.

The game walkthrough is versioned in `state.onboarding.dashboardTourVersion`. The current walkthrough scrolls each mobile target into a usable viewport position before drawing a dedicated spotlight and curved white SVG arrow. It has explicit Exit/× controls and must never elevate a live dashboard element above the tour overlay. `decisions waiting` and Alerts counters are actionable navigation controls, and decision/exception surfaces must always be closable without committing an action.

See [`docs/logistics-game/README.md`](docs/logistics-game/README.md) for the complete mechanics.

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

1. Analytical workspace content has one writable canonical database record in account metadata.
2. `/api/workspaces` is the preferred analytical-workspace transport.
3. Authenticated session metadata is allowed only for immediate read recovery of the last server-confirmed account record.
4. Workspace Save and Publish always cross the same-origin Atlas Harbor API boundary; workspace browser code never reads or writes `/auth/v1/user` metadata directly.
5. Browser transport fallbacks may retry that same API with fetch, XHR, or form navigation, but may not reach a database endpoint or create another store.
6. Public publication-list requests remain anonymous/session-independent regardless of viewer login state.
7. Shared bootstrap-scale data uses host-account metadata.
8. User projects, preferences, drafts and saved decisions use database-backed account metadata unless the product explicitly requires offline behavior.
9. Analytical workspace content never falls back to a device-only editable copy.
10. The logistics **game career is the explicit offline exception** and synchronizes local + account copies using newest-copy-wins.
11. Optional legacy/virtual records are recovery inputs, not new write targets.
12. Collections are bounded and shared writes are serialized.
13. A dedicated table may replace metadata later without changing the public API.
14. Missing optional tables must never produce instructions telling an ordinary user to run SQL.

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

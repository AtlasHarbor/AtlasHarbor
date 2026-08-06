# Atlas Harbor

Atlas Harbor is a decision platform organized around inspectable **Problem Spaces**. Each space turns a difficult real-world question into structured evidence, constraints, objectives, explicit tradeoffs, user notes, AI-assisted analysis, collaboration, and optional public publishing.

## Core Problem Space loop

Every Problem Space should make the decision structure visible:

1. define the problem,
2. identify the people and stakeholders,
3. collect structured evidence,
4. separate hard constraints from preferences,
5. state the objective,
6. rank feasible actions,
7. expose tradeoffs, uncertainty, and verification tasks,
8. let the human make the decision,
9. persist the decision and outcome for later learning.

The interface should not become a data-entry job. Routine collection and ranking should be automated; the user should spend time on judgment, exceptions, and consequences.

## Problem Spaces

- `/economics` — current economic headlines converted into decision problems and discussion surfaces.
- `/game` — an exception-driven logistics control-tower game. See [`docs/logistics-game/README.md`](docs/logistics-game/README.md).
- `/baseball` — professional, Minor League, and college baseball intelligence.
- `/legal` — CourtListener-backed dockets, filings, decision boards, and legal research. See [`docs/legal/README.md`](docs/legal/README.md).
- `/food` — a location-first food decision planner for breakfast through late night, solo or together, with dine-in, quick-service, takeaway, and delivery constraints. See [`docs/food/README.md`](docs/food/README.md).
- `/prop` — source-backed propositions for work projects, company partnerships, sales pitches, investments, programs, products, and market decisions. See [`docs/prop/README.md`](docs/prop/README.md).
- `/dropshipping` — product hypotheses, unit economics, advertising experiments, and measured results.
- `/life-sciences` — research questions, evidence, experiments, and translation.
- `/featured` — work selected by the global quality system.
- `/published` — public user analysis.
- `/problems` — directory and public requests for future spaces.

## Propositions

Propositions starts with the decision being requested rather than assuming every idea is a market launch. A proposition can support:

- an internal work project seeking approval, budget, staffing, or a pilot,
- a partnership proposal between companies,
- a sales pitch that needs a buyer-specific value and implementation case,
- an investment, program, policy, vendor, or operating-change decision,
- a product, brand, or market-entry proposal.

The guided brief captures the current state, problem, decision audience, requested action, why now, scope, timeline, financial frame, constraints, available evidence, and research questions. Perplexity supplies current external research where relevant. The normalizer separates sourced evidence, user-provided context, calculations, assumptions, recommendations, and verification tasks.

The resulting proposition can include stakeholder maps, evidence claims, alternatives, expected outcomes, success metrics, costs, implementation phases, objections, risks, experiments, sources, and optional market, partnership, sales, or unit-economic modules. The user then writes and publishes a separate rich-text pitch through the existing workspace.

`/go-to-market` redirects to `/prop`, while existing `go_to_market` metadata and `go_to_market_report` workspace records remain compatible.

## Food decision planner

Food Discovery is treated as a meal logistics problem rather than a generic restaurant list.

The user first confirms the starting location by searching, using browser geolocation, or clicking the map. The planner then considers:

- whether the decision is for one diner or several,
- breakfast, brunch, lunch, dinner, late night, or coffee/snack,
- solo meal, meal for two, date, friends, family, business, celebration, group outing, or travel meal,
- quick or counter service, sit-down dining, takeaway/to-go, delivery, or any service style,
- each diner’s likes, dislikes, dietary requirements, allergy questions, noise preference, price ceiling, spice comfort, and adventurousness,
- road travel distance from the confirmed origin,
- opening status and closing risk,
- rating confidence and review volume,
- freshness, seasonality, sourcing, and raw-shellfish verification questions.

For a solo meal, the objective maximizes that diner’s fit while respecting timing, service format, travel, budget, hours, evidence, and freshness constraints. For multiple diners, it protects the least-satisfied person before improving the average.

Breakfast and other meal periods use Google Places service fields when available. Delivery, takeaway, and dine-in are actual feasibility constraints when the provider explicitly reports that a format is unavailable. Unknown meal or service information becomes a verification task rather than an unsupported assumption.

When available, road distance is calculated with OSRM/OpenStreetMap. Google Places supplies restaurant identity, hours, ratings, review excerpts, price level, meal-service fields, and service-format attributes when `GOOGLE_PLACES_API_KEY` is configured. OpenStreetMap remains the fallback provider.

Profiles and recent decisions persist without a food-specific Supabase table:

```text
localStorage["atlas-food-planner-profile-v2"]
user_metadata.atlas_problem_spaces.food_planner
```

The full decision model, scoring weights, API, persistence rules, freshness guidance, meal periods, service modes, and logistics mapping are documented in [`docs/food/README.md`](docs/food/README.md).

## Logistics game

The logistics game uses management by exception: routine production and safe dispatch can be delegated, while the player handles breakdowns, congestion, customer changes, quality holds, routing choices, and capital allocation.

Truck routes use OSRM/OpenStreetMap road geometry; rail uses curated intermodal corridors; air uses flight arcs; ocean uses water corridors between ports. Vehicle position, journey percentage, and ETA are calculated from the same route geometry.

### Hard routing invariant

Every logistics location declares a facility type and landmass. The routing layer enforces these rules:

- trucks and rail cannot connect different landmasses,
- ocean movements must begin and end at ports,
- only ocean or air may bridge different landmasses,
- truck, rail, and ocean fallbacks never invent a straight-line route when no verified corridor exists.

Signed-in progress is stored under:

```text
user_metadata.atlas_problem_spaces.logistics_game.progress
```

Local storage remains the immediate fallback, with optional import from the legacy `game_progress` table. See [`docs/logistics-game/README.md`](docs/logistics-game/README.md).

## Problem Space persistence standard

New Problem Spaces must work after deployment without asking an ordinary user to open the Supabase SQL editor.

1. The browser talks to an Atlas Harbor API route rather than a Supabase table name.
2. The API authenticates Supabase bearer tokens for private reads and writes.
3. Shared bootstrap-scale data uses `src/problem-space-storage.js` and host-account metadata.
4. User-only preferences, drafts, filters, profiles, and saved decisions use that user’s metadata.
5. Local storage provides immediate resilience where appropriate.
6. Shared writes are serialized and collections are bounded.
7. A dedicated table can replace metadata when volume or query complexity requires it without changing the public API.
8. Missing optional tables must never produce instructions telling an ordinary user to run SQL.

## Economics publication feed

Economics is headline-first. Feed titles, URLs, summaries, and dates are saved before AI enrichment so provider latency or malformed model output cannot prevent new stories from appearing.

```text
GET  /api/economics/problems
GET  /api/economics/status
POST /api/economics/run
```

The public trigger is asynchronous, limited to one accepted run per minute, and returns a `runId`. Admin configures source, cadence, model, and optional Perplexity enrichment.

## Legal tracker

Legal is database-first with this persistence order:

1. optional `legal_cases` table,
2. shared Supabase account metadata under `atlas_problem_spaces.legal_tracker`,
3. repository JSON only as bootstrap seeds and a read-only fallback.

CourtListener/RECAP synchronization is non-AI and saves docket metadata, entries, parties, document metadata, direct filing links, and available extracted text. Perplexity and user-selected AI are optional analysis layers over the synchronized record and selected filings.

See [`docs/legal/README.md`](docs/legal/README.md).

## Dropshipping & Advertising

Dropshipping uses an application API and metadata-backed storage rather than requiring browser access to legacy Supabase tables. Shared decision briefs use host-account metadata. Personal categories and filters use the individual user’s metadata.

## Global AI and administration

The first signed-in Supabase user to initialize `/admin` becomes `master_admin`. Administrators can configure primary and backup OpenAI-compatible providers, Economics ingestion, Perplexity research, Legal CourtListener synchronization, quality review, and case recommendations.

Ordinary-user OpenRouter and Perplexity keys remain browser-local and are sent only when the user explicitly starts or tests an AI request.

## Comments and publishing

Comments are off by default. Canonical legal, proposition, baseball, Economics, Food, and other source pages remain separate from user publications.

```text
/published/<share-token>
```

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

Atlas Harbor is experimental decision support. Restaurant data, food-safety context, meal-service attributes, delivery availability, map routes, legal records, proposition research, internal context, sports data, news-derived problems, scientific evidence, model output, quality scores, and projections may be incomplete, stale, biased, manipulated, or wrong. Verify consequential information with primary sources and the relevant professional or provider. User publications and comments are personal views, not official records, legal advice, medical advice, investment advice, food-safety certification, or guaranteed recommendations.

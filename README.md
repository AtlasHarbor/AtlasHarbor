# Atlas Harbor

Atlas Harbor is a decision platform organized around inspectable **Problem Spaces**. Each space turns a difficult real-world question into structured data, explicit tradeoffs, user notes, AI-assisted analysis, collaboration, and optional public publishing.

## Problem Spaces

- `/economics` — economics: converts current publication stories into decision problems, stakeholders, constraints, tradeoffs, and open questions.
- `/game` — logistics control tower.
- `/baseball` — baseball intelligence.
- `/legal` — legal systems tracker.
- `/food` — restaurant and food discovery.
- `/dropshipping` — product and advertising strategy.
- `/life-sciences` — research questions, evidence, experiments, and translation.
- `/featured` — work selected by the global quality system.
- `/published` — public user analysis.
- `/problems` — directory and public requests for future spaces.

The shared **Problem Spaces** navigation is loaded on desktop and mobile. The label links to `/problems`; the adjacent arrow opens the complete menu. On desktop the menu also supports hover.

## Economics publication feed

Economics introduces a live-feed pattern that can later be reused by other Problem Spaces.

The default operating model is:

1. An administrator selects a publication or feed URL.
2. The source is checked every 12 hours by default.
3. Up to 20 recent headlines are selected.
4. The global AI converts each headline into a separate structured problem.
5. The source headline, publication name, date, and link remain attached for attribution.
6. Users and their AIs can work through the resulting decision problem without Atlas Harbor copying or republishing the full article.

The conversion instruction should identify:

- the actual decision,
- stakeholders,
- constraints,
- competing objectives,
- uncertainty,
- questions that need evidence,
- relevant economic topics.

The administrator can change the source name, URL, feed type, cadence, item limit, instruction, and enabled state from `/admin`.

Until an automated source is enabled, `/economics` includes a dated manual seed for August 3, 2026 covering digital-economic fragmentation, coordinated yen intervention, and recession risk from an energy shock. These are summaries framed as problems and link back to their publications.

Run:

```text
supabase/economics-feed.sql
```

This creates `economics_feed_settings` and `economic_problems`.

A publication feed must be used in accordance with its terms. Atlas Harbor should retain attribution and links, ingest only metadata or permitted summaries, and avoid storing or reproducing paywalled article text. A publication homepage or licensed feed can be used when an official RSS endpoint is unavailable.

## Global AI and administration

The first signed-in Supabase user to initialize `/admin` becomes `master_admin`. The master administrator can grant admin roles, transfer master ownership, and configure:

- primary and backup OpenAI-compatible providers,
- encrypted provider keys,
- quality-review instructions,
- review cadence,
- monthly budget,
- Economics feed settings.

Provider keys stored by the admin control plane are encrypted using:

```bash
ADMIN_ENCRYPTION_KEY=YOUR_LONG_STABLE_RANDOM_SECRET
```

The global quality AI scores novelty, evidence, clarity, collaboration, quality, and spam probability. Strong work can appear at `/featured`.

## Direct messaging

Dropshipping funding interest can open private threads between signed-in users. The account page lists the user’s conversations and supports replies.

After installing `supabase/dropshipping-space.sql`, also run:

```text
supabase/direct-messaging-fix.sql
```

The second migration replaces recursive membership policies with security-definer membership checks. This allows thread members to list their threads, read messages, and reply while keeping non-members out.

## Comments and publishing

Comments are off by default. A creator must explicitly enable them for a dropshipping strategy or shared publication. Canonical legal, baseball, and other source pages remain separate from user publications.

Public analysis uses separate links:

```text
/published/<share-token>
```

## Food Discovery

Food Discovery uses Nominatim and OpenStreetMap/Overpass without credentials. Optional Google Places enrichment can add ratings, review counts, hours, excerpts, and maps links:

```bash
GOOGLE_PLACES_API_KEY=YOUR_SERVER_SIDE_GOOGLE_PLACES_KEY
```

## Required Supabase migrations

Run the applicable files in the Supabase SQL editor:

```text
supabase/schema.sql
supabase/ai-settings.sql
supabase/problem-spaces.sql
supabase/published-analysis.sql
supabase/workspace-projections-placement.sql
supabase/food-discovery.sql
supabase/dropshipping-space.sql
supabase/direct-messaging-fix.sql
supabase/admin-ai-featured.sql
supabase/economics-feed.sql
```

## Environment

Copy `.env.example` to `.env` and keep real values out of Git:

```bash
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=YOUR_SUPABASE_SECRET_KEY
SUPABASE_JWKS_URL=https://YOUR_PROJECT_REF.supabase.co/auth/v1/.well-known/jwks.json
PUBLIC_APP_URL=http://localhost:3000
ADMIN_ENCRYPTION_KEY=YOUR_LONG_STABLE_RANDOM_SECRET
```

Optional mapping and restaurant settings are documented in `.env.example`.

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

Atlas Harbor is experimental decision support. News-derived problems, restaurant data, sports data, legal records, product claims, scientific evidence, model output, quality scores, and projections may be incomplete, stale, biased, manipulated, or wrong. Verify consequential information with primary sources. User publications and comments are personal views, not official records, legal advice, medical advice, investment advice, or guaranteed recommendations.

# Atlas Harbor

Atlas Harbor is a decision platform built around inspectable **Problem Spaces**. Each space turns a difficult real-world question into structured data, explicit tradeoffs, user notes, AI-assisted analysis, projections, collaboration, and optional public publishing.

## Problem Spaces

- `/game` — logistics control tower: coordinate purchase orders, plants, packaging, inventory, transport, exceptions, and customer satisfaction.
- `/baseball` — baseball intelligence: explore games, teams, players, injuries, lineups, statistics, projections, and fantasy/betting-oriented analysis.
- `/legal` — legal systems tracker: follow litigation, procedural events, sources, likely outcomes, and independent analysis.
- `/food` — food discovery: identify the best place to eat for a specific location, group, time, mood, budget, and set of constraints.
- `/dropshipping` — product and advertising strategy: publish products, keywords, audiences, geographies, bids, budgets, campaign plans, results, comments, funding interest, and private collaboration.
- `/problems` — directory of available spaces plus publicly visible requests for future spaces.
- `/published` — newest public user analyses across spaces.
- `/account` — authentication, AI endpoint/model settings, sharing defaults, connection health, and direct messages.

## Dropshipping & Advertising

This space asks:

> Which product, offer, audience, geography, platform, creative approach, bid strategy, and test plan should be used—and what evidence would justify scaling or stopping it?

Any signed-in user can create a strategy without administrator approval. A strategy can include:

- product and supplier URL,
- product evidence, fulfillment risk, margin, and differentiation,
- search or interest keywords,
- platform such as Meta, TikTok, Google Ads, Pinterest, or Snapchat,
- geography and audience interests,
- bid strategy and test budget,
- offer, creative, funnel, landing page, kill criteria, and scaling rules,
- AI-assisted critique or test-plan drafting,
- reported campaign results,
- optional comments,
- optional funding interest.

Comments are **off by default**. The creator must explicitly enable them. Signed-in commenters may write directly or ask their configured AI model to draft a constructive response. AI-assisted comments remain labeled.

When funding interest is enabled, another signed-in user can register interest and start a private message thread with the strategy creator. The account page contains the initial direct-message inbox. This feature is intended to connect people; it is not a securities offering, escrow service, payment processor, or verification system.

Install the database objects with:

```text
supabase/dropshipping-space.sql
```

This migration adds:

- `dropship_strategies`
- `strategy_comments`
- `strategy_funding_interest`
- `direct_threads`
- `direct_thread_members`
- `direct_messages`
- `publication_comments`
- `workspace_notes.comments_enabled`

The same opt-in comment setting is available for shared legal and baseball publications. Publication comments are also off by default.

## Food Discovery

Food Discovery is deliberately qualitative. Baseball asks questions such as “who is most likely to win?” and legal asks “what outcome or strategy is most likely?” Food asks:

> What is the best restaurant for this particular person or group, in this place, at this time, under these constraints?

The default discovery path uses Nominatim and OpenStreetMap/Overpass without an API key. Optional `GOOGLE_PLACES_API_KEY` enrichment adds ratings, review counts, hours, excerpts, summaries, and Google Maps links where available. Signed-in users can add Atlas Harbor community notes after running `supabase/food-discovery.sql`.

## Publishing workspaces

Legal and baseball detail pages include a reusable rich editor. Signed-in users can write analysis, add optional projection scenarios, run their selected AI model with an explicit prompt, save drafts, publish, and create separate public links. Canonical pages remain unchanged for other visitors.

Published analysis lives at `/published/<share-token>`. The creator may separately enable comments for that publication. Commenting never turns on automatically when something is published.

## Accounts and AI

Atlas Harbor uses Supabase Auth and Row Level Security. User API keys remain in browser local storage and are sent only when an AI action is requested. The account page supports manually entered model IDs, OpenRouter model search and pricing, custom OpenAI-compatible endpoints, save-time connection testing, sharing preferences, and direct-message threads.

## Supabase setup

Run the applicable SQL files in the Supabase SQL editor:

```text
supabase/schema.sql
supabase/ai-settings.sql
supabase/problem-spaces.sql
supabase/published-analysis.sql
supabase/workspace-projections-placement.sql
supabase/food-discovery.sql
supabase/dropshipping-space.sql
```

Then configure a local `.env` or deployment secrets:

```bash
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=YOUR_SUPABASE_SECRET_KEY
SUPABASE_JWKS_URL=https://YOUR_PROJECT_REF.supabase.co/auth/v1/.well-known/jwks.json
PUBLIC_APP_URL=http://localhost:3000
ADMIN_PASSWORD=SET_A_PRIVATE_ADMIN_PASSWORD
```

Never commit real credentials.

## Maps

The logistics game uses OpenStreetMap by default and can optionally use Google Maps. Food Discovery uses Nominatim and Overpass for keyless global place discovery; Google Places is optional for review enrichment.

## Run locally

Requires Node.js 20 or later.

```bash
cp .env.example .env
npm install
npm start
npm test
```

Open `http://localhost:3000/`.

## Architecture

- `src/app.js` wires APIs and page routes.
- `public/dropshipping.html`, `public/dropshipping.js`, and `public/dropshipping.css` implement product and advertising strategies.
- `public/messages.js` implements the first account-based direct-message inbox.
- `src/food.js` performs location resolution, OpenStreetMap restaurant discovery, and optional Google Places enrichment.
- `src/problem-spaces.js` defines built-in spaces and public space requests.
- `public/workspace.js` provides analysis, projections, AI drafting, publishing, and sharing.
- `public/publishing-links.js` controls separate publication links and opt-in comments.
- `public/published.js` renders public publications and enabled comment threads.
- `src/mlb.js` normalizes MLB data.
- `src/legal.js` loads canonical cases and legal update proposals.
- `supabase/*.sql` defines persistence and Row Level Security.

## Responsible use

Atlas Harbor is experimental decision support. Advertising platforms, product demand, supplier quality, shipping performance, unit economics, campaign results, restaurant data, sports data, case records, model output, and projections can be incomplete, stale, manipulated, or wrong. Verify suppliers, intellectual-property rights, platform rules, consumer-protection obligations, taxes, privacy requirements, and financial claims. Funding-interest and messaging features only connect users; Atlas Harbor does not verify identity, suitability, ownership, returns, or legal compliance. User publications and comments are personal views, not official records, legal advice, investment advice, or guaranteed recommendations.

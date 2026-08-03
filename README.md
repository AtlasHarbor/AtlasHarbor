# Atlas Harbor

Atlas Harbor is a decision platform built around inspectable **Problem Spaces**. Each space turns a difficult real-world question into structured data, explicit tradeoffs, user notes, AI-assisted analysis, projections, and optional public publishing.

## Problem Spaces

- `/game` — logistics control tower: coordinate purchase orders, plants, packaging, inventory, transport, exceptions, and customer satisfaction.
- `/baseball` — baseball intelligence: explore games, teams, players, injuries, lineups, statistics, projections, and fantasy/betting-oriented analysis.
- `/legal` — legal systems tracker: follow litigation, procedural events, sources, likely outcomes, and independent analysis.
- `/food` — food discovery: identify the best place to eat for a specific location, group, time, mood, budget, and set of constraints.
- `/problems` — directory of available spaces plus publicly visible requests for future spaces.
- `/published` — newest public user analyses across spaces.
- `/account` — authentication, AI endpoint/model settings, sharing defaults, and connection health.

## Food Discovery

Food Discovery is deliberately qualitative. Baseball asks questions such as “who is most likely to win?” and legal asks “what outcome or strategy is most likely?” Food asks:

> What is the best restaurant for this particular person or group, in this place, at this time, under these constraints?

The current decision model considers:

- location and travel effort,
- cuisine and dietary fit,
- time available and opening hours,
- atmosphere and occasion,
- price and availability,
- ratings and review themes,
- Atlas Harbor community notes,
- uncertainty and information that should be verified directly.

### Restaurant data providers

The default discovery path requires no API key:

1. **Nominatim** resolves a typed city, neighborhood, address, or coordinates.
2. **OpenStreetMap/Overpass** returns nearby restaurants and cafes with available names, cuisine tags, addresses, websites, phone numbers, and opening-hours tags.

OpenStreetMap is global and credential-free, but it does not provide a dependable cross-platform review corpus. Provider reviews are therefore optional enrichment rather than something Atlas Harbor pretends can be freely aggregated from every review site.

When `GOOGLE_PLACES_API_KEY` is configured server-side, Food Discovery can enrich results with Google Places ratings, review counts, hours, review excerpts, Google Maps links, and review summaries where available. Google attribution and source links must remain visible, and Google Places storage and display policies must be followed.

```bash
# Optional server-side restaurant review enrichment
GOOGLE_PLACES_API_KEY=YOUR_SERVER_SIDE_GOOGLE_PLACES_KEY
```

Signed-in users can add Atlas Harbor community notes and optional 1–5 ratings after running:

```text
supabase/food-discovery.sql
```

The Food Discovery endpoint is:

```text
GET /api/food/search?location=Tokyo%2C%20Japan&q=ramen
```

## Publishing workspaces

Legal and baseball detail pages include a reusable rich editor. Signed-in users can write analysis, add optional projection scenarios, run their selected AI model with an explicit prompt, save drafts, publish, and create separate public links. Canonical pages remain unchanged for other visitors.

Published analysis lives at:

```text
/published/<share-token>
```

The feed is available at `/published`.

## Accounts and AI

Atlas Harbor uses Supabase Auth and Row Level Security. User API keys remain in browser local storage and are sent only when an AI action is requested. The account page supports:

- any manually entered model ID,
- OpenRouter model search and pricing where supported,
- custom OpenAI-compatible endpoints,
- a save-time `hello` connection test,
- saved provider/model/test status in Supabase.

## Supabase setup

Run the applicable SQL files in the Supabase SQL editor:

```text
supabase/schema.sql
supabase/ai-settings.sql
supabase/problem-spaces.sql
supabase/published-analysis.sql
supabase/workspace-projections-placement.sql
supabase/food-discovery.sql
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

```bash
MAP_PROVIDER=openstreetmap
MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png

MAP_PROVIDER=google
GOOGLE_MAPS_BROWSER_API_KEY=YOUR_BROWSER_RESTRICTED_GOOGLE_MAPS_KEY
```

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
- `src/food.js` performs location resolution, OpenStreetMap restaurant discovery, and optional Google Places enrichment.
- `public/food.html`, `public/food.js`, and `public/food.css` implement Food Discovery.
- `src/problem-spaces.js` defines built-in spaces and public space requests.
- `public/workspace.js` provides analysis, projections, AI drafting, publishing, and sharing.
- `src/mlb.js` normalizes MLB data.
- `src/legal.js` loads canonical cases and legal update proposals.
- `supabase/*.sql` defines persistence and Row Level Security.

## Responsible use

Atlas Harbor is experimental decision support. Restaurant data, hours, menus, prices, accessibility, dietary information, reviews, ratings, sports data, case records, model output, and projections can be incomplete, stale, or wrong. Verify consequential information with primary sources. User publications and community comments are personal views, not official records, legal advice, medical advice, or guaranteed recommendations.

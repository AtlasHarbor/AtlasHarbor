# Atlas Harbor

Atlas Harbor is a logistics simulation and decision platform. It turns complicated real-world choices into systems people can operate, inspect, and improve.

## The premise

Many hard problems share the same shape: limited resources, incomplete information, sequencing, bottlenecks, deadlines, competing authorities, and uncertain downstream effects. Atlas Harbor maps those structures onto a playable third-party-logistics network of clients, routes, cargo, trucks, drivers, outside carriers, capacity, risk, cash, and service levels.

The goal is not to claim that litigation or baseball is literally logistics. The logistics layer is a legible model for examining how a person allocates resources, protects optionality, reacts to new evidence, and chooses among constrained routes.

## Application surfaces

- `/` explains Atlas Harbor with an animated logistics-to-domain transfer sequence.
- `/game` is the playable ten-day 3PL operating scenario.
- `/game/docs` explains objectives, resources, routes, providers, economics, and strategy.
- `/blog` discusses recent research and limitations around AI-assisted analogical transfer.
- `/baseball` provides MLB players, teams, games, lineups, weather, injuries, and scouting-oriented statistics.
- `/legal` tracks lawsuits, procedural events, party positions, source provenance, uncertainties, and logistics-system translations.

## Logistics game

The game begins with an operating map rather than an empty construction grid. Roads, shipping lanes, suppliers, a port, the Atlas Harbor cross-dock, and client locations are already visible. Trucks, ships, forklifts, cargo, weather, and facility activity animate so the network can be understood by looking at it.

The operating loop is:

1. Select a client contract.
2. Choose a route with an explicit time, cost, and risk profile.
3. Assign owned trucks or buy capacity from a third-party provider.
4. Dispatch freight and commit operating cash.
5. Advance the day, receive delivery results, release resources, and respond to disruptions.

Owned fleet protects margin but is constrained by trucks and drivers. Third-party carriers cost more but can protect deadlines, diversify route risk, and preserve internal resources. Contract values and balances use six-figure operating amounts rather than arcade-scale money.

A guided overlay tutorial opens on first play and remains available from the help control. Capacity shortages, insufficient cash, missing route assignments, disruptions, deliveries, and end-of-cycle results appear in prominent lightboxes that explain the constraint and available next actions.

The interaction model uses established transport-management conventions: visible vehicles and cargo flow, fixed locations and infrastructure, route assignment, vehicle capacity, cargo chains, operating economics, and escalating scenario objectives. Atlas Harbor adds a translation layer that explains reusable strategy principles beneath those mechanics.

## Legal tracker architecture

Canonical lawsuit records live in `data/legal/cases/*.json`. Each record contains stable identifiers, parties, court, filing date, procedural timeline, requested relief, party positions, related cases, watch items, analysis, logistics translation, and a source list.

The first record is **The People of the State of New York v. KalshiEX LLC**, filed July 31, 2026. The record deliberately leaves the New York index number `null` until a primary source confirms it. Preliminary rulings, allegations, and final holdings are labeled separately.

### Source and review policy

1. Primary sources control: court dockets, filed pleadings and orders, statutes, agency publications, and official releases.
2. Secondary reporting can identify leads but should not by itself establish a procedural fact.
3. Every update records URLs, source type, verification time, confidence, and warnings.
4. AI output never silently overwrites a canonical case file.
5. An OpenRouter refresh creates `data/legal/proposals/<slug>.json`, which remains a review proposal until a human validates and promotes the changes.
6. The tracker is informational and is not legal advice.

### OpenRouter refresh

```text
POST /api/legal/cases/:slug/refresh
Authorization: Bearer $LEGAL_ADMIN_TOKEN
```

Configure:

```bash
OPENROUTER_API_KEY=...
LEGAL_ADMIN_TOKEN=use-a-long-random-secret
OPENROUTER_LEGAL_MODEL=openai/gpt-5.2
PUBLIC_APP_URL=https://your-deployment.example
```

The service calls OpenRouter with web search and a strict JSON Schema response. The prompt prioritizes primary sources, distinguishes allegations from holdings, and returns no change when nothing material is verified.

## Run locally

Requires Node.js 20 or later.

```bash
npm install
npm start
npm test
```

Open `http://localhost:3000/`.

## Architecture

- `src/server.js` starts Express.
- `src/app.js` defines APIs and page routing.
- `src/mlb.js` normalizes MLB data.
- `src/legal.js` reads canonical cases and creates reviewable OpenRouter proposals.
- `public/game.js` runs the logistics operating simulation.
- `public/landing.js` controls the homepage transfer sequence.

## Responsible use

Atlas Harbor is experimental decision support. Its scenarios, data normalization, summaries, and translations can be incomplete or wrong. Check important facts against primary sources and qualified experts. Do not submit confidential, privileged, sealed, or personally sensitive material to third-party model or search providers without appropriate authorization and controls.

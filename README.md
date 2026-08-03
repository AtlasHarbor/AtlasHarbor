# Atlas Harbor

Atlas Harbor is a decision platform built around a calm logistics game. It turns complicated real-world choices into systems people can see, play, and improve.

## The premise

Many hard problems share the same shape: limited resources, incomplete information, sequencing, bottlenecks, deadlines, competing authorities, and uncertain downstream effects. Atlas Harbor maps those structures onto a playable third-party-logistics network of clients, warehouses, routes, cargo, capacity, risk, and service levels.

The goal is not to claim that litigation or baseball is literally logistics. The logistics layer is a legible model for examining how a person allocates attention, protects optionality, reacts to new evidence, and chooses among constrained routes.

## Application surfaces

- `/` explains Atlas Harbor and the logistics translation model.
- `/game` is the playable 3PL scenario.
- `/baseball` provides MLB players, teams, games, lineups, weather, injuries, and scouting-oriented statistics.
- `/legal` tracks lawsuits, procedural events, party positions, source provenance, uncertainties, and logistics-system translations.

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

The protected endpoint is:

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

The service calls OpenRouter's Chat Completions API with the `openrouter:web_search` server tool, domain filters derived from the case's approved sources, and a strict JSON Schema response. The prompt instructs the model to search only for developments after `lastVerifiedAt`, prefer primary sources, distinguish allegations from holdings, avoid outcome predictions, and return no change when nothing material is verified.

To add a lawsuit, copy the existing case JSON structure, use a unique lowercase slug, add at least one primary source, and set uncertain identifiers to `null` rather than guessing. After reviewing an AI proposal, manually update the canonical case record and its `lastVerifiedAt` timestamp in a normal pull request so the history remains auditable.

## How legal analysis maps to logistics

- **Cargo** is the claim, right, or legal characterization moving through the system.
- **Routes** are procedural and substantive strategies.
- **Ports** are courts, agencies, and appellate forums with authority to receive or redirect the dispute.
- **Capacity** is research time, briefing space, evidence, and institutional attention.
- **Bottlenecks** are threshold issues that control everything downstream, such as jurisdiction or preemption.
- **Disruptions** are stays, removal, new precedent, factual revelations, or conflicting rulings.
- **Service level** is the quality, timeliness, and reliability of the resulting legal decision process.

This translation is a thinking aid, not a substitute for legal judgment or counsel.

## Run locally

Requires Node.js 20 or later.

```bash
npm install
npm start
```

Open `http://localhost:3000/`, `http://localhost:3000/game`, `http://localhost:3000/baseball`, or `http://localhost:3000/legal`.

```bash
npm test
```

## Architecture

- `src/server.js` starts Express.
- `src/app.js` defines baseball and legal APIs plus page routing.
- `src/mlb.js` normalizes MLB data.
- `src/legal.js` reads canonical cases and creates reviewable OpenRouter proposals.
- `data/legal/cases/` contains approved case records.
- `data/legal/proposals/` contains generated update proposals and should be reviewed before promotion.
- `public/` contains the landing page, game, baseball dashboard, and legal tracker.

## Responsible use

Atlas Harbor is experimental decision support. Its scenarios, data normalization, summaries, and translations can be incomplete or wrong. Check important facts against primary sources and qualified experts. Do not submit confidential, privileged, sealed, or personally sensitive material to third-party model or search providers without appropriate authorization and controls.

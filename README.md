# Atlas Harbor

Atlas Harbor is a decision platform built around inspectable **Problem Spaces**. Each space turns a difficult real-world question into structured data, explicit tradeoffs, user notes, AI-assisted analysis, projections, collaboration, and optional public publishing.

## Problem Spaces

- `/game` — logistics control tower: coordinate purchase orders, plants, packaging, inventory, transport, exceptions, and customer satisfaction.
- `/baseball` — baseball intelligence: explore games, teams, players, injuries, lineups, statistics, projections, and fantasy/betting-oriented analysis.
- `/legal` — legal systems tracker: follow litigation, procedural events, sources, likely outcomes, and independent analysis.
- `/food` — food discovery: identify the best place to eat for a specific location, group, time, mood, budget, and set of constraints.
- `/dropshipping` — product and advertising strategy: publish products, keywords, audiences, geographies, bids, budgets, campaign plans, results, comments, funding interest, and private collaboration.
- `/life-sciences` — research questions, evidence maps, experimental plans, translational hypotheses, reproducibility, uncertainty, and safety constraints.
- `/featured` — public work promoted by the global quality system.
- `/problems` — directory of available spaces plus publicly visible requests for future spaces.
- `/published` — newest public user analyses across spaces.
- `/account` — authentication, personal AI endpoint/model settings, sharing defaults, connection health, and direct messages.
- `/admin` — first-admin bootstrap, user roles, master-admin transfer, global AI providers, quality instructions, cadence, and budget.

## Global in-house AI and featured work

Atlas Harbor has a separate administrator-controlled AI layer in addition to each user’s personal AI settings. Its initial purpose is quality moderation and discovery rather than silently rewriting user content.

The first signed-in Supabase user who visits `/admin` may initialize administration when no administrator exists. That user:

1. chooses and repeats an administrator password,
2. becomes `master_admin`,
3. can grant or remove ordinary `admin` roles,
4. can transfer master ownership to another user.

The admin password is salted and hashed in Supabase. It is not committed to the repository. A valid Supabase user session is also required, so possession of the password alone is insufficient.

The master administrator or another administrator can configure:

- a primary OpenAI-compatible endpoint, model, and provider key,
- a backup endpoint, model, and provider key,
- a repeatable quality-review instruction set,
- a review cadence, defaulting to every 10 minutes,
- a monthly AI budget,
- whether scheduled review is enabled.

Provider keys entered in `/admin` are encrypted by the Node server before being stored in Supabase. Set a stable, private `ADMIN_ENCRYPTION_KEY` in the deployment environment. Changing that value makes previously stored provider keys unreadable.

The worker scores public submissions for:

- overall quality,
- novelty,
- evidence,
- clarity,
- meaningful human–AI collaboration,
- spam probability.

The default instructions penalize copied boilerplate, unsupported certainty, low-effort repetition, and generic output that an AI could produce without meaningful human contribution. The score is a ranking and anti-spam aid, not proof that the content is true, safe, lawful, or scientifically valid.

High-scoring, low-spam work can appear at `/featured`. The system stores the rationale and component scores so promotion remains inspectable. The scheduler uses the backup provider when the primary fails and stops running when the configured monthly budget is reached. Provider-reported cost data is used when available; deployments should still monitor billing directly because not every compatible endpoint reports cost consistently.

The schema also includes view events for future non-AI recommendations based on recently viewed spaces and topics. Personalized recommendation logic is intentionally not enabled yet.

Install this system with:

```text
supabase/admin-ai-featured.sql
```

and configure:

```bash
ADMIN_ENCRYPTION_KEY=GENERATE_A_LONG_RANDOM_ENCRYPTION_SECRET
```

## Life Sciences

The Life Sciences space begins with a structured model for:

- defining a mechanism, population, intervention, comparator, outcome, and time horizon,
- separating primary data, replicated findings, preprints, reviews, assumptions, and contradictions,
- planning controls, assays, sample-size assumptions, sequencing, bottlenecks, stop criteria, and safety constraints,
- mapping the path from an interesting result to a diagnostic, therapy, platform, or operational change.

This initial page establishes the scope and shared problem model. Future iterations can add protocol templates, literature and dataset connectors, reproducibility checklists, structured evidence ingestion, and reviewable AI critique. It is not a clinical decision system and does not replace qualified scientific, medical, biosafety, ethics, or regulatory review.

## Dropshipping & Advertising

This space asks:

> Which product, offer, audience, geography, platform, creative approach, bid strategy, and test plan should be used—and what evidence would justify scaling or stopping it?

Any signed-in user can create a strategy without administrator approval. A strategy can include product and supplier information, keywords, platform, geography, audience interests, bids, budget, creative and funnel plans, AI-assisted critique, reported results, optional comments, optional funding interest, and private messages.

Comments are **off by default**. The creator must explicitly enable them. Funding-interest and messaging features only connect users; Atlas Harbor does not process payments, investments, securities, or escrow.

Install the database objects with:

```text
supabase/dropshipping-space.sql
```

## Food Discovery

Food Discovery asks what restaurant is best for a particular person or group, place, time, mood, budget, and set of constraints. The default discovery path uses Nominatim and OpenStreetMap/Overpass without an API key. Optional `GOOGLE_PLACES_API_KEY` enrichment adds ratings, review counts, hours, excerpts, summaries, and Google Maps links where available. Signed-in users can add Atlas Harbor community notes after running `supabase/food-discovery.sql`.

## Publishing workspaces

Legal and baseball detail pages include a reusable rich editor. Signed-in users can write analysis, add optional projection scenarios, run their selected AI model with an explicit prompt, save drafts, publish, and create separate public links. Canonical pages remain unchanged for other visitors.

Published analysis lives at `/published/<share-token>`. The creator may separately enable comments for that publication. Commenting never turns on automatically when something is published.

## Accounts and personal AI

Atlas Harbor uses Supabase Auth and Row Level Security. User API keys remain in browser local storage and are sent only when an AI action is requested. The account page supports manually entered model IDs, OpenRouter model search and pricing, custom OpenAI-compatible endpoints, save-time connection testing, sharing preferences, and direct-message threads.

Personal AI and global administrator AI are separate:

- personal AI acts only when the user explicitly requests it,
- global AI runs the administrator’s repeatable quality-review workflow on public content.

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
supabase/admin-ai-featured.sql
```

Then configure a local `.env` or deployment secrets:

```bash
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=YOUR_SUPABASE_SECRET_KEY
SUPABASE_JWKS_URL=https://YOUR_PROJECT_REF.supabase.co/auth/v1/.well-known/jwks.json
PUBLIC_APP_URL=http://localhost:3000
ADMIN_ENCRYPTION_KEY=GENERATE_A_LONG_RANDOM_ENCRYPTION_SECRET
```

Never commit real credentials.

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
- `src/admin-control.js` implements first-admin bootstrap, role management, encrypted global AI settings, scheduled quality scoring, budgets, view events, and the featured API.
- `public/admin.html` and `public/admin.js` implement the administrator control plane.
- `public/featured.html` and `public/featured.js` render the featured feed.
- `public/life-sciences.html` establishes the Life Sciences problem model.
- `public/dropshipping.html`, `public/dropshipping.js`, and `public/dropshipping.css` implement product and advertising strategies.
- `public/messages.js` implements the first account-based direct-message inbox.
- `src/food.js` performs location resolution, OpenStreetMap restaurant discovery, and optional Google Places enrichment.
- `src/problem-spaces.js` defines built-in spaces and public space requests.
- `public/workspace.js` provides analysis, projections, AI drafting, publishing, and sharing.
- `src/mlb.js` normalizes MLB data.
- `src/legal.js` loads canonical cases and legal update proposals.
- `supabase/*.sql` defines persistence and Row Level Security.

## Responsible use

Atlas Harbor is experimental decision support. AI quality scores can be biased, incomplete, gamed, or wrong. Featured status does not establish factual accuracy, scientific validity, legal merit, investment quality, safety, originality, or endorsement. Administrators should periodically audit scores, instructions, budgets, and provider behavior. Verify suppliers, claims, experiments, protocols, rights, platform rules, legal records, sports data, and consequential decisions with qualified humans and primary sources.

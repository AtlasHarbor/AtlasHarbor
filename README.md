# Atlas Harbor

Atlas Harbor is a logistics simulation and decision platform. It turns complicated real-world choices into systems people can operate, inspect, and improve.

## Application surfaces

- `/` explains Atlas Harbor with an animated logistics-to-domain transfer sequence.
- `/game` is an hourly multimodal logistics control-tower simulation.
- `/account` provides Supabase sign-up/sign-in plus per-user AI and sharing settings.
- `/baseball` provides MLB players, teams, games, lineups, weather, injuries, notes, projections, and scouting-oriented statistics.
- `/legal` is a compact lawsuit index. Each case opens on a dedicated `/legal/<case-slug>` page with the full record, projections, sources, and publishing workspace.
- `/blog` discusses research and limitations around AI-assisted analogical transfer.

## Publishing workspaces

Legal case pages and standalone baseball game/player pages include a reusable publishing workspace. It is designed to feel closer to a lightweight Ghost or WordPress editor than a plain note field.

Signed-in users can:

- write a headline and long-form analysis,
- use bold, italic, heading, list, link, unlink, undo, and redo controls,
- place the published analysis directly below the page header or after the official information,
- add dated projection scenarios and estimated probabilities,
- save a private draft,
- publish a reviewed version,
- make that publication available through an unguessable share link,
- decide whether AI-generated text is included in the shared version,
- supply a custom prompt before running AI.

AI never runs automatically. The user enters instructions, clicks **Generate AI draft**, reviews the returned text, edits it, and then chooses whether to publish. Failures are shown explicitly. Typical messages identify a missing OpenRouter key, missing login, rejected model, invalid credential, or empty provider response. The account page controls the default model and sharing preferences.

A legal projection might cover likely motion dates, procedural paths, probabilities, and evidence that would change the view. A baseball projection might cover the expected game outcome, pitcher risk, lineup assumptions, weather effects, and reasons for the forecast. User analysis is kept separate from canonical legal facts and official MLB data.

After pulling schema changes, rerun `supabase/schema.sql`. It is safe to rerun and adds the publishing fields to `workspace_notes`, including `title`, `ai_prompt`, `projections`, `placement`, and `is_published`.

## Logistics control-tower game

The player is the dispatcher inside a third-party logistics control tower. The objective is customer satisfaction: keep purchase orders supplied, packaged correctly, compliant, moving, and delivered within the current promise.

The simulated network includes:

- brand-owner merchandise programs as the primary clients,
- retailers and e-commerce fulfillment partners as consignees,
- contract manufacturers,
- print and media plants,
- packaging and localization facilities,
- ocean ports and customs gateways,
- air-cargo hubs,
- retailer distribution centers,
- third-party fulfillment centers,
- owned transportation and partner-carrier capacity.

The initial shift opens with ten major purchase orders. Each order identifies the client, consignee, product, quantity, available inventory, production origin, packaging or localization stop, final destination, compliance requirement, value, and promised delivery time.

### Operating loop

1. Inspect the purchase order and its path on the map.
2. Confirm whether enough finished inventory exists.
3. Release production through the plant scheduler when a shortage exists.
4. Route work through packaging, labeling, localization, or compliance when required.
5. Book truck, rail/intermodal, air, or ocean capacity.
6. Watch shipments move between real geographic nodes.
7. Respond to driver breakdowns, port holds, reduced air capacity, labor gaps, and missed appointments.
8. Expedite, reroute, add partner capacity, or request a revised delivery promise.
9. Communicate the current ETA and recovery plan to the buyer or consignee.

The simulation advances in one-hour blocks. One game hour passes automatically every 15 real minutes while the game is open. The player can pause the clock or choose **Next hour** after completing the current work queue.

Most actions are explicit buttons. An exception-planning text box supports unusual instructions. It parses the request into a proposed plan, displays the operational steps, and requires confirmation before execution. The signed-in AI workspace can additionally use the player's selected OpenRouter model and saved notes as context.

### Facilities and capacity

Plants and facilities expose plausible operating information such as people on shift, daily production rate, utilization, throughput, and role in the order chain. Capacity recommendations are treated as requests to operations planning. The game generally approves reasonable temporary-capacity requests while charging the associated cost or increasing operational risk.

### Map providers

The game works without map credentials by default using Leaflet with OpenStreetMap tiles. Visible OpenStreetMap attribution is retained. Production deployments should respect the tile service usage policy or configure a suitable hosted or self-managed provider.

Google Maps is optional. Google Maps JavaScript API production use requires a browser API key and billing-enabled Google Cloud project. Restrict the browser key by HTTP referrer and enable only the Maps JavaScript API.

```bash
MAP_PROVIDER=openstreetmap
MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png

MAP_PROVIDER=google
GOOGLE_MAPS_BROWSER_API_KEY=YOUR_BROWSER_RESTRICTED_GOOGLE_MAPS_KEY
```

Restart the Node server after changing map environment variables. `/api/status` reports the selected provider and whether a Google Maps key is configured.

## Accounts and persistence

Atlas Harbor uses Supabase Auth and Row Level Security. Signed-in users can save game progress, retain AI preferences, create private drafts on game/baseball/legal pages, publish selected analyses, and create share links.

The OpenRouter API key is deliberately **not** stored in Supabase, committed to GitHub, or written to server logs. It stays in browser local storage and is supplied to the server only for the request that needs it.

## Supabase setup

1. Create a Supabase project.
2. Open the Supabase SQL editor and run `supabase/schema.sql`.
3. Copy `.env.example` to `.env` for local development.
4. Add real values only to the local `.env` or deployment environment.
5. Restart the Node process.

```bash
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=YOUR_SUPABASE_SECRET_KEY
SUPABASE_JWKS_URL=https://YOUR_PROJECT_REF.supabase.co/auth/v1/.well-known/jwks.json
```

`SUPABASE_PUBLISHABLE_KEY` is exposed to the browser through `/api/config` and must be paired with correctly configured Row Level Security. `SUPABASE_SECRET_KEY` must remain server-only.

### GitHub deployment configuration

Open **Repository → Settings → Secrets and variables → Actions** and add sensitive values as repository or environment secrets. Add non-sensitive settings, such as `MAP_PROVIDER`, as variables when appropriate. Never paste real keys into `.env.example`, workflow YAML, issues, pull requests, or committed source files.

## OpenRouter workflow

1. Sign up or sign in at `/account`.
2. Paste a personal OpenRouter API key.
3. Select a model.
4. Open a publishing workspace.
5. Write the exact prompt for the analysis you want.
6. Generate a draft, review it, revise it, and publish only when satisfied.

The server validates the Supabase session and forwards the request using the browser-supplied OpenRouter key. Model output is advisory and does not silently change canonical legal records, official sports data, or operational state.

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

- `src/server.js` loads `.env` and starts Express.
- `src/app.js` defines APIs, safe browser configuration, authentication checks, map-provider configuration, AI proxying, and page routing.
- `public/game.js` runs the hourly purchase-order, inventory, production, transport, exception, and customer-service simulation.
- `public/workspace.js` provides the reusable rich editor, projections, AI prompt, publishing, placement, and sharing workflow.
- `public/legal.js` renders the lawsuit index and dedicated case pages.
- `src/mlb.js` normalizes MLB data.
- `src/legal.js` reads canonical cases and creates administrator review proposals.
- `supabase/schema.sql` defines user settings, progress, publishing workspaces, sharing, indexes, and Row Level Security policies.
- `public/supabase-client.js` performs browser authentication and protected REST calls.

## Responsible use

Atlas Harbor is experimental decision support. Its scenarios, ETAs, capacities, costs, model output, data normalization, summaries, projections, and analogies can be incomplete or wrong. User publications are not official case records, legal advice, betting advice, or verified forecasts. Do not submit confidential, privileged, sealed, export-controlled, or personally sensitive information to third-party model or map providers without appropriate authorization and controls.

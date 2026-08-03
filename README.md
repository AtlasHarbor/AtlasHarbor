# Atlas Harbor

Atlas Harbor is a logistics simulation and decision platform. It turns complicated real-world choices into systems people can operate, inspect, and improve.

## Application surfaces

- `/` explains Atlas Harbor with an animated logistics-to-domain transfer sequence.
- `/game` is an hourly multimodal logistics control-tower simulation.
- `/account` provides Supabase sign-up/sign-in plus per-user AI and sharing settings.
- `/baseball` provides MLB players, teams, games, lineups, weather, injuries, notes, and scouting-oriented statistics.
- `/legal` tracks lawsuits, procedural events, sources, logistics translations, private notes, shared notes, and user-requested AI analysis.
- `/blog` discusses research and limitations around AI-assisted analogical transfer.

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

The game works without map credentials by default using Leaflet with OpenStreetMap tiles. Visible OpenStreetMap attribution is retained. The standard OpenStreetMap tile service is suitable for modest interactive development use; production deployments should respect its usage policy or configure a suitable hosted/self-managed tile provider.

Google Maps is optional. Google Maps JavaScript API production use requires a browser API key and billing-enabled Google Cloud project. Restrict the browser key by HTTP referrer and enable only the Maps JavaScript API.

```bash
# Credential-free development default
MAP_PROVIDER=openstreetmap
MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png

# Optional Google Maps provider
MAP_PROVIDER=google
GOOGLE_MAPS_BROWSER_API_KEY=YOUR_BROWSER_RESTRICTED_GOOGLE_MAPS_KEY
```

Restart the Node server after changing map environment variables. `/api/status` reports the selected provider and whether a Google Maps key is configured.

## Accounts and persistence

Atlas Harbor uses Supabase Auth and Row Level Security. Signed-in users can save game progress, retain AI preferences, create notes on game/baseball/legal pages, and selectively publish workspace material through share links.

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
4. Use AI from the game or a supported workspace page.
5. Review generated actions or analysis before applying or saving them.

The server validates the Supabase session and forwards the request using the browser-supplied OpenRouter key. Model output is advisory and does not silently change canonical legal records or operational state.

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
- `public/game.html` and `public/game.css` provide the control-tower interface and interactive map.
- `src/mlb.js` normalizes MLB data.
- `src/legal.js` reads canonical cases and creates administrator review proposals.
- `supabase/schema.sql` defines user settings, progress, notes, sharing, indexes, and Row Level Security policies.
- `public/supabase-client.js` performs browser authentication and protected REST calls.

## Responsible use

Atlas Harbor is experimental decision support. Its scenarios, ETAs, capacities, costs, model output, data normalization, summaries, and analogies can be incomplete or wrong. The named-company examples are fictional customer archetypes and do not imply affiliation. Do not submit confidential, privileged, sealed, export-controlled, or personally sensitive information to third-party model or map providers without appropriate authorization and controls.

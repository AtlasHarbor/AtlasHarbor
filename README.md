# Atlas Harbor

Atlas Harbor is a logistics simulation and decision platform. It turns complicated real-world choices into systems people can operate, inspect, and improve.

## Application surfaces

- `/` explains Atlas Harbor with an animated logistics-to-domain transfer sequence.
- `/game` is the playable competitive trade-lane simulation.
- `/account` provides Supabase sign-up/sign-in plus per-user AI model settings.
- `/baseball` provides MLB players, teams, games, lineups, weather, injuries, and scouting-oriented statistics.
- `/legal` tracks lawsuits, procedural events, sources, logistics translations, private notes, shared notes, and user-requested AI analysis.
- `/blog` discusses research and limitations around AI-assisted analogical transfer.

## Accounts and persistence

Atlas Harbor uses Supabase Auth and Row Level Security. Signed-in users can:

- save game progress summaries,
- retain their selected OpenRouter model,
- create private notes on legal cases,
- selectively publish a note through an unguessable share URL,
- send case context to their own OpenRouter account for analysis.

The OpenRouter API key is deliberately **not** stored in Supabase, committed to GitHub, or written to server logs. It stays in browser local storage and is supplied to the server only for the request that needs it. The selected model is stored in both local storage and the user's protected `user_settings` row.

## Supabase setup

1. Create a Supabase project.
2. Open the Supabase SQL editor and run `supabase/schema.sql`.
3. Copy `.env.example` to `.env` for local development.
4. Add the real values only to your local `.env` or deployment environment.
5. Never commit `.env`.

Required variables:

```bash
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=YOUR_SUPABASE_SECRET_KEY
SUPABASE_JWKS_URL=https://YOUR_PROJECT_REF.supabase.co/auth/v1/.well-known/jwks.json
```

`SUPABASE_PUBLISHABLE_KEY` is exposed to the browser through `/api/config` and is safe only in combination with correctly configured Row Level Security. `SUPABASE_SECRET_KEY` must remain server-only. The current implementation does not send the secret key to the browser.

### GitHub deployment configuration

For GitHub Actions, repository environments, or a connected hosting platform:

1. Open the repository on GitHub.
2. Go to **Settings → Secrets and variables → Actions**.
3. Add each sensitive value as a repository or environment secret.
4. Add non-sensitive deployment settings as variables when appropriate.
5. Configure the hosting workflow or platform to expose those values to the Node process.

Never paste real keys into `.env.example`, workflow YAML, issue comments, pull requests, or committed source files. Rotate any credential that has been shared in chat, logs, screenshots, or a public repository.

## OpenRouter user workflow

1. Sign up or sign in at `/account`.
2. Paste a personal OpenRouter API key.
3. Select a model.
4. Open a legal case and choose **Ask AI to analyze this case**.
5. Review the generated text before saving it into a note.

The server validates the Supabase session, then forwards the request to OpenRouter using the user-supplied key. The key is never written to the database. Model output is user-requested analysis, not a verified update to the canonical legal record.

## Legal notes and sharing

Canonical lawsuit records remain in `data/legal/cases/*.json`. Personal notes live in Supabase and are separate from canonical case facts.

- Notes are private by default.
- A signed-in user can mark a note shareable.
- Shared notes are readable through `/legal?note=<share-token>`.
- Disabling sharing removes public access under the database policy.
- AI-generated text is added to the editable note and must be reviewed before saving.

The tracker is informational and is not legal advice. Primary filings and official sources control over user notes or model output.

## Game progress

The game continues to run entirely in the browser. When a user is signed in, `public/progress.js` observes the visible game state and saves a compact progress snapshot containing week, cash, market share, reputation, network scores, and the latest event. This provides cross-session history without exposing internal game implementation details to the database.

## Environment template

`.env.example` contains placeholders only. `.gitignore` excludes `.env` and all `.env.*` files except `.env.example`.

Additional optional variables:

```bash
PUBLIC_APP_URL=http://localhost:3000
OPENROUTER_LEGAL_MODEL=openai/gpt-5.2
LEGAL_ADMIN_TOKEN=GENERATE_A_LONG_RANDOM_SECRET
OPENROUTER_API_KEY=OPTIONAL_SERVER_MANAGED_KEY
```

The server-managed OpenRouter key remains available for the administrator-only legal refresh workflow. User-initiated AI calls use the user's browser-held OpenRouter key instead.

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

- `src/server.js` starts Express.
- `src/app.js` defines APIs, Supabase-safe configuration, authentication checks, AI proxying, and page routing.
- `src/mlb.js` normalizes MLB data.
- `src/legal.js` reads canonical cases and creates administrator review proposals.
- `supabase/schema.sql` defines user settings, game progress, legal notes, indexes, and Row Level Security policies.
- `public/supabase-client.js` performs browser authentication and RLS-protected REST calls.
- `public/account.js` manages sign-up, sign-in, OpenRouter key storage, and model selection.
- `public/progress.js` persists signed-in game progress summaries.
- `public/legal.js` renders cases and manages private/shared notes and user-requested AI analysis.

## Responsible use

Atlas Harbor is experimental decision support. Its scenarios, data normalization, summaries, and translations can be incomplete or wrong. Check important facts against primary sources and qualified experts. Do not submit confidential, privileged, sealed, or personally sensitive material to third-party model or search providers without appropriate authorization and controls.

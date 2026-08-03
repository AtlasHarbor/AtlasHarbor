# Legal database

Atlas Harbor keeps the version-controlled canonical seed records in `data/legal/cases/*.json` and mirrors them into Supabase for queryable production use.

## Install or upgrade the schema

Run the complete `supabase/schema.sql` file in the Supabase SQL editor. It creates:

- `legal_cases` — canonical case metadata plus the complete forward-compatible JSON record
- `legal_case_events` — procedural timeline events
- `legal_case_sources` — primary and secondary sources
- `legal_case_tags` — jurisdiction, law-topic, and keyword taxonomy
- `legal_case_update_proposals` — reviewable AI/docket update proposals

Canonical records, events, sources, and tags are publicly readable. Browser roles cannot write them. Imports and update-proposal writes require the server-side Supabase secret key.

## Seed the original cases

Ensure `.env` contains `SUPABASE_URL` and `SUPABASE_SECRET_KEY`, then run:

```bash
npm run seed:legal
```

The importer is idempotent. It upserts every JSON seed case and its events, sources, and tags. Running it again updates existing rows rather than creating duplicates.

## Runtime behavior

`src/legal.js` reads Supabase first. If Supabase is unavailable, the expected table has not been installed, or a database request fails, it falls back to `data/legal/cases/*.json`. This keeps `/legal` available during migrations or outages.

OpenRouter-generated case updates remain proposals. They are saved to `legal_case_update_proposals` with `status = pending` and also retained under `data/legal/proposals/` when the filesystem is writable. A proposal must be reviewed before the canonical case record is changed.

## Adding a case

1. Add a validated JSON record under `data/legal/cases/` using the existing Kalshi case structure.
2. Include `jurisdictionTags`, `lawTopics`, at least four `keywords`, `proceduralStage`, `allegationStatus`, `dataQuality`, `timeline`, and `sources`.
3. Run `npm run seed:legal`.
4. Confirm the case appears under `/legal` and that its tags are queryable in `legal_case_tags`.

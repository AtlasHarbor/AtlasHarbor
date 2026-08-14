# Baseball player database and fantasy foundation

Atlas Harbor's Baseball player pages already normalize professional statistics across MLB, Triple-A, Double-A, High-A and Low-A. This feature persists that same normalized player object so downstream products such as fantasy tools can use one consistent dataset instead of re-scraping every player for every request.

## Storage model

The canonical shared cache is `public.baseball_player_snapshots`.

Each row is keyed by MLB person ID and stores searchable columns (team, sport/level, position, refresh timestamps) plus the complete normalized Atlas Harbor player JSON in `snapshot`.

The JSON includes, when available:

- player identity, age, position, handedness and current team,
- current level and parent organization,
- MLB / AAA / AA / High-A / Low-A stat blocks,
- current-season, career and year-by-year lines,
- recent game logs,
- hitting and pitching data for two-way players,
- transactions,
- verified MLB Pipeline prospect information when available,
- legacy summary fields used by the existing player UI.

This is shared public-source Baseball data. It is not duplicated once per Atlas Harbor user account.

Private notes remain separate in the canonical account workspace:

```text
user_metadata.atlas_problem_spaces.publishing_workspace.notes
```

A note with `resource_type: baseball_player` and the matching MLB person ID can be joined onto an export for that signed-in user. The private analysis is **not copied into the shared player snapshot table**.

`public.baseball_refresh_jobs` stores progress for administrator-triggered refreshes.

Both Baseball snapshot/job tables are server-only. RLS is enabled with no anon/authenticated policies. Atlas Harbor accesses them through the configured server secret/service key.

Apply `supabase/baseball-player-database.sql` once to the production Supabase project before using bulk refresh. Ordinary player pages continue to work if the table is unavailable; bulk refresh refuses to start rather than burning MLB API traffic without a persistence target.

## Refresh behavior

### Player page visit

`/api/baseball/prospect-players/:id` remains the source that creates the normalized player object. A middleware mounted before the player router captures a successful response and upserts it into `baseball_player_snapshots`.

Therefore visiting/loading a player profile refreshes that player's stored snapshot without introducing a second player-normalization implementation.

Snapshot persistence failure must never make a working player page fail.

### Admin bulk refresh

The `/admin` control plane contains Baseball refresh controls for:

- MLB,
- Triple-A,
- Double-A,
- High-A,
- Low-A,
- all five levels.

A refresh request returns immediately with HTTP 202. The Node process then:

1. discovers teams for the requested sport ID(s),
2. reads each team's roster,
3. deduplicates MLB person IDs,
4. refreshes one player through Atlas Harbor's existing normalized player endpoint,
5. persists that player immediately,
6. updates the refresh-job counters,
7. waits a short configurable delay before the next player.

The default delay is 450 ms and can be adjusted with `BASEBALL_REFRESH_DELAY_MS`. It is intentionally incremental rather than one giant `Promise.all()` call.

A process restart interrupts an in-process job. The persisted job row remains an audit/status record; rerun the requested scope after a restart. A later iteration can add durable queue resumption if this becomes necessary.

## Export

Each player profile has **Export player JSON**. The button refreshes the normalized player endpoint first. When the viewer is signed in, it also resolves that account's matching `baseball_player` workspace and includes it as `analysis` in the downloaded JSON.

Account Settings has **Baseball player data exports**. A signed-in user can download:

- MLB,
- Triple-A,
- Double-A,
- High-A,
- Low-A,
- or all professional levels.

`GET /api/baseball/account-export?sportId=...` reads the shared snapshot database and joins only the requesting user's matching Baseball analysis records. The response reports both the player count and `analysisCount` and returns records shaped as:

```json
{
  "player": { "id": 695491, "...": "normalized player snapshot" },
  "analysis": { "resource_type": "baseball_player", "...": "signed-in user's workspace" }
}
```

`analysis` is `null` when that user has not written about the player.

Admin has **Export stored player JSON**, which exports the shared stored snapshots without attaching a specific user's private notes. This is intended for database inspection, model development and fantasy experimentation.

## Fantasy recent-form model v1

`src/baseball-fantasy.js` is deliberately transparent and configurable. It is a starting ranking model, not a claim that recent form alone predicts future performance.

Default window: **8 recent games**.

Recency weights from newest to oldest:

```text
1.00, 0.92, 0.85, 0.79, 0.73, 0.68, 0.63, 0.58
```

The current score is:

```text
80% weighted recent-game form
20% current-season per-game baseline
```

### Hitter game points

The first transparent scoring frame values:

- single: 1
- double: 2
- triple: 3
- home run: 4
- run: +1
- RBI: +1
- walk: +1
- hit by pitch: +1
- stolen base: +2
- caught stealing: -1
- strikeout: -0.25

### Pitcher game points

- inning pitched: +3
- strikeout: +2
- win: +5
- save: +5
- earned run: -2
- hit allowed: -0.5
- walk allowed: -0.5
- home run allowed: -1.5

These weights are not tied to ESPN, Yahoo, FanDuel, DraftKings or another platform. Once the fantasy product's roster and scoring rules are chosen, make the weights a league configuration rather than hard-coding a provider's assumptions.

### Initial ideal lineup

The first lineup builder fills:

```text
C, 1B, 2B, 3B, SS, OF, OF, OF, UTIL
```

using the highest recent-form eligible hitters without duplicating a player. It also returns bench candidates and a separate recent-form pitcher ranking.

This is only the first layer. A stronger future lineup optimizer should add:

- confirmed starting lineup / active status,
- probable pitcher and opponent quality,
- handedness/platoon splits,
- park and weather context,
- rest / recent workload,
- injuries,
- salary or auction budget,
- league-specific roster eligibility,
- league-specific scoring,
- projected playing time,
- uncertainty and confidence intervals.

Those additions should build on the stored snapshot database rather than replacing it.

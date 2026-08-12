# Atlas Harbor Baseball Intelligence

Baseball player, game, and team reports use the same private analysis and publishing architecture as the other Atlas Harbor Problem Spaces.

## Team report contract

A professional team page should answer the basic competitive questions before lower-level statistics:

- current wins-losses record near the hero,
- current division position during the regular season when the MLB Stats API publishes standings for that league,
- postseason/series context instead of division-race framing when the team has entered postseason play,
- lineup and active roster,
- a verified injured list rather than echoing the entire roster,
- direct links from every roster/lineup/IL player to `/baseball/players/:id/:slug`.

`src/mlb.js` derives team sport/league metadata first, then uses that sport for schedules and the team league for standings. This is intentionally not hard-coded to MLB sport ID 1 so affiliated Triple-A, Double-A, High-A and Low-A team pages can use the same model.

The injured-list UI must not trust a broad roster payload merely because it came from a route named `injuredList`. Entries are shown only when their roster/person status actually indicates an injury or IL placement. If no verified IL statuses are returned, the page says so instead of showing healthy players.

## Player report contract

Player age belongs near the identity block at the top, not only in a lower Bio section.

Professional statistics must make the competition level and season year visible. Enhanced prospect data retains MLB/AAA/AA/High-A/Low-A `yearByYear` splits, and the player renderer surfaces those as year + level lines rather than blending minor-league seasons together.

Recent activity is intended to describe roster/availability events that matter to understanding the player. Cosmetic jersey/uniform-number changes are filtered out both in the core MLB client and again in the page renderer so items such as “changed number to 42” do not crowd the timeline.

## Baseball navigation

`public/baseball-navigation.js` may show a route loader while moving from the Baseball dashboard into a dedicated team/player/game page, but it must clear that loader on `pageshow` so browser Back/Forward Cache restores never leave the Baseball page covered by a spinner.

Do not add document-wide `MutationObserver` behavior to Baseball navigation. Dedicated result routing works through event delegation and explicit render events.

## Private analysis workspace

Signed-in Baseball report pages mount the shared `workspace.js` editor with resource types such as:

```text
baseball_player
baseball_game
baseball_team
```

A Baseball analysis can be saved, AI-assisted, published, and shared through the same canonical account workspace used elsewhere:

```text
user_metadata.atlas_problem_spaces.publishing_workspace.notes
```

There is no device-only Baseball workspace.

### Browser transport resilience

Baseball reports are server-rendered and then mount the shared workspace from `account-indicator.js`. A regression exposed a browser-specific failure where `fetch('/api/workspaces/...')` could throw on these report pages even while the report itself rendered correctly.

`workspace-transport-fallback.js` therefore gives the same-origin workspace API a second browser transport:

1. use the normal native `fetch` path first,
2. if that network call throws, retry the **same `/api/workspaces/...` endpoint** through `XMLHttpRequest`,
3. preserve the same Authorization header, request body, HTTP method, and server-side database persistence,
4. never create a local workspace record or browser-side alternate database.

This is transport redundancy, not a second source of truth.

A new player analysis is allowed to begin with an empty workspace record returned by the server. Existing analyses continue to load from the canonical account record and publish through the shared publication feed.

## Baseball stat explainers

Baseball reports display compact standard abbreviations. `baseball-stat-help.js` adds a reusable glossary affordance to the stat grids.

Desktop users can hover the stat label or info circle. Touch/mobile users can tap the info circle to open an accessible explanation dialog.

Definitions currently include common hitting, pitching, and fielding terms such as ERA, WHIP, IP, K/9, BB/9, AVG, OBP, SLG, OPS, BABIP, ISO, PA, RBI and FLD%.

The glossary explains the meaning of the statistic; it does not change or reinterpret the MLB Stats API values shown on the report.

## Regression rules

1. Baseball player/game/team pages must mount the shared database workspace for signed-in users.
2. Workspace transport failure must retry the same workspace API through XHR before showing a database error.
3. The transport fallback must not use `localStorage` or virtual `workspace_notes` records.
4. Baseball stat abbreviations must remain discoverable by hover and tap.
5. Publishing remains on the shared `/published` architecture rather than a Baseball-specific publication store.
6. Team pages keep wins-losses and season/standings context near the top.
7. Injured-list sections show only verified injury/IL statuses.
8. Active roster players link to dedicated player profiles.
9. Player age remains near the top identity block, and minor-league history remains year-labeled.
10. Cosmetic jersey-number activity stays out of recent player activity.
11. Baseball route loaders are cleared on `pageshow` and Baseball navigation does not install document-wide mutation observers.

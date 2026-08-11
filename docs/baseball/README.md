# Atlas Harbor Baseball Intelligence

Baseball player, game, and team reports use the same private analysis and publishing architecture as the other Atlas Harbor Problem Spaces.

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

Definitions currently include common hitting, pitching, and fielding terms such as:

- ERA — Earned Run Average
- WHIP — Walks + Hits per Inning Pitched
- IP — Innings Pitched
- K/9 — Strikeouts per 9 Innings
- BB/9 — Walks per 9 Innings
- AVG — Batting Average
- OBP — On-Base Percentage
- SLG — Slugging Percentage
- OPS — On-Base Plus Slugging
- BABIP — Batting Average on Balls in Play
- ISO — Isolated Power
- PA — Plate Appearances
- RBI — Runs Batted In
- FLD% — Fielding Percentage

The glossary explains the meaning of the statistic; it does not change or reinterpret the MLB Stats API values shown on the report.

## Regression rules

1. Baseball player/game/team pages must mount the shared database workspace for signed-in users.
2. Workspace transport failure must retry the same workspace API through XHR before showing a database error.
3. The transport fallback must not use `localStorage` or virtual `workspace_notes` records.
4. Baseball stat abbreviations must remain discoverable by hover and tap.
5. Publishing remains on the shared `/published` architecture rather than a Baseball-specific publication store.

# Baseball workspace and publication integration testing

This exists because Baseball has had repeated regressions where a player page still rendered but the signed-in workspace or a published article became unavailable. These flows must be tested as one system.

## Invariants

1. A signed-in user can open a Baseball player and get either the saved `baseball_player` workspace or a valid empty workspace for a player with no saved analysis yet.
2. Workspace reads and writes target the canonical account metadata record at `user_metadata.atlas_problem_spaces.publishing_workspace.notes`.
3. No local/device-only editable workspace is created.
4. A public publication must resolve identically whether the viewer is signed out or signed in. Viewer identity can affect owner controls, never publication existence.
5. Per-player JSON export includes the normalized player record plus the current user's saved analysis for that player.
6. Admin Baseball database export includes stored normalized player snapshots plus the admin account's own Baseball-player analyses, keyed by player ID.

## Safe integration-test account

Atlas Harbor can ensure a dedicated test account exists at startup, but only when explicitly enabled. Credentials are deployment secrets and are never committed.

Set:

```text
ATLAS_E2E_TEST_ENABLED=true
ATLAS_E2E_TEST_EMAIL=<test account email>
ATLAS_E2E_TEST_PASSWORD=<test account password>
```

Production additionally requires:

```text
ATLAS_E2E_ALLOW_PRODUCTION=true
```

The seeder marks the account with `user_metadata.atlas_e2e_test=true`. It does not grant Atlas Harbor administrator privileges. If admin-only Baseball endpoints must be exercised, use an explicitly configured admin test account rather than hard-coding a privileged password in the repository.

## REST smoke test

Run against a deployed or local Atlas Harbor instance:

```bash
ATLAS_TEST_BASE_URL=https://YOUR_ATLAS_HOST \
ATLAS_E2E_TEST_EMAIL=... \
ATLAS_E2E_TEST_PASSWORD=... \
npm run test:baseball-smoke
```

Optional:

```text
ATLAS_E2E_PLAYER_ID=695491
```

The smoke test performs the real HTTP sequence:

1. reads `/api/config`,
2. signs into Supabase with the test account,
3. fetches the normalized player endpoint,
4. checks `/api/workspaces/status`,
5. reads the player's canonical workspace,
6. saves and publishes a hidden (`featured:false`) test analysis,
7. reads the resulting `/api/published-feed/:token` anonymously,
8. reads the same publication with Authorization,
9. verifies both reads resolve the same publication and saved body.

A failure in any step is a release blocker for Baseball workspace/publication changes.

## Export shape

Per-player browser export:

```json
{
  "schemaVersion": 2,
  "player": { "id": 695491 },
  "myAnalysis": { "resource_type": "baseball_player", "resource_id": "695491" }
}
```

Admin database export retains the `players` array and adds:

```json
{
  "myPlayerAnalyses": [],
  "analysisByPlayerId": {
    "695491": {}
  }
}
```

This keeps public-source player statistics separate from private account analysis while packaging both for downstream AI/fantasy work.

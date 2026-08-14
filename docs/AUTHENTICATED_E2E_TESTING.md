# Authenticated end-to-end API testing

Atlas Harbor has a repeatable REST smoke test for the account-backed workspace and public-publication invariants that are easy to regress.

## Why this exists

The critical contract is:

1. a signed-in user can open a Baseball player they have never analyzed and create the first database-backed workspace;
2. saving writes the canonical account record in `user_metadata.atlas_problem_spaces.publishing_workspace.notes`;
3. publishing creates a stable public share token;
4. a public publication exists identically whether the viewer is signed out or signed in;
5. no local/device-only analytical workspace is created;
6. Baseball player JSON export may include the signed-in user's matching analysis, but the analysis remains stored in the canonical account workspace rather than duplicated into the public player snapshot.

## Test-account provisioning

Never hard-code a known production credential into the repository. Configure the account through deployment secrets:

```text
ATLAS_E2E_TEST_BOOTSTRAP=true
ATLAS_E2E_TEST_EMAIL=<test account email>
ATLAS_E2E_TEST_PASSWORD=<long test password>
ATLAS_E2E_BASEBALL_PLAYER_ID=695491
```

At startup, `src/test-account-bootstrap.js` uses the server-side Supabase Admin API to create the account if it is missing or refresh its password to the configured secret. The account is marked with `user_metadata.atlas_e2e_test=true` and otherwise behaves like an ordinary signed-in user. The bootstrap is completely disabled unless `ATLAS_E2E_TEST_BOOTSTRAP` is explicitly enabled.

The password must live only in `.env` / Render secrets / another secret manager. Do not commit it.

## Run the REST smoke test

With the app deployed (or running locally) and the test credentials available in the environment:

```bash
npm run test:auth
```

`scripts/test-auth-api.js` performs these real HTTP operations:

1. reads `/api/config`;
2. logs in through Supabase Auth using the configured test user;
3. confirms `/api/workspaces/status` recognizes the session;
4. `PUT`s a Baseball player analysis through `/api/workspaces/baseball_player/:id`;
5. immediately `GET`s the same canonical workspace and confirms the saved ID;
6. publishes that test workspace with a direct share token;
7. requests `/api/published-feed/:token` anonymously;
8. requests the same publication while authenticated;
9. fails if the anonymous and authenticated reads do not resolve the same publication.

A successful run prints a JSON result containing the workspace ID, storage path, share token, publication title, and workspace service status.

## First-analysis browser recovery

A player with an existing note can be rendered from authenticated session metadata during a temporary read-transport outage. Historically, a player with **no prior note** instead showed `Analysis could not load`, which made it impossible to start the first analysis.

`public/workspace-first-note-recovery.js` fixes that narrow case. For an authenticated Baseball player with no matching workspace in session metadata, a failed **GET** may be treated as an empty workspace so the editor can mount. The module never fabricates a `PUT`, save, publication, or local draft. Saving still has to reach the canonical account database.

## Public-publication browser rule

`public/published-public-feed.js` strips viewer Authorization from both the public feed list and public publication-detail GETs. Publication existence is public data. Authentication is allowed only for separate owner controls and write actions.

This means logging in must never turn a working public URL into `Publication unavailable`.

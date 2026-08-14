# Authenticated end-to-end API testing

Atlas Harbor has a repeatable REST smoke test for the account-backed workspace and public-publication invariants that are easy to regress.

## Why this exists

The critical contract is:

1. a signed-in user can open a Baseball player they have never analyzed and create the first database-backed workspace;
2. saving writes the canonical account record in `user_metadata.atlas_problem_spaces.publishing_workspace.notes`;
3. publishing creates a stable public share token;
4. a public publication exists identically whether the viewer is signed out or signed in;
5. no local/device-only analytical workspace is created;
6. Baseball player JSON export may include the signed-in user's matching analysis, but the analysis remains stored in the canonical account workspace rather than duplicated into the public player snapshot;
7. Account can still display drafts/publications and Space Block indexes from the authenticated session metadata if the same-origin account API is temporarily unreachable.

## Test-account provisioning

Never hard-code a known production credential into the repository. Configure the account through deployment secrets:

```text
ATLAS_E2E_TEST_BOOTSTRAP=true
ATLAS_E2E_TEST_EMAIL=<test account email>
ATLAS_E2E_TEST_PASSWORD=<long test password>
ATLAS_E2E_BASEBALL_PLAYER_ID=695491
```

At startup, `src/test-account-bootstrap.js` uses the server-side Supabase Admin API to create the account if it is missing or refresh its password to the configured secret. The account is marked with `user_metadata.atlas_e2e_test=true` and otherwise behaves like an ordinary signed-in user. The bootstrap is completely disabled unless `ATLAS_E2E_TEST_BOOTSTRAP` is explicitly enabled.

The password must live only in `.env` / Render secrets / another secret manager. Do not commit it. The test account is intentionally not granted administrator privileges by default; ordinary-user auth is what these workspace/publication regressions need to exercise.

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

The recovery lives inside `public/workspace-transport-fallback.js`. For the first **read**, the order is:

1. normal authenticated `fetch()` to `/api/workspaces/baseball_player/:id`;
2. the same authenticated endpoint over XHR;
3. only if both transports fail, the user is signed in, and the signed-in session contains no existing record for that player, return an **empty first-analysis UI state**.

That empty state is not a saved draft. A first **write** must still reach the canonical account record. Workspace writes therefore use this transport order:

1. normal authenticated `PUT /api/workspaces/:resourceType/:resourceId` over fetch;
2. the exact same request over XHR;
3. if both JavaScript request transports fail, a same-origin hidden form/iframe POST to `/api/workspaces-form/:resourceType/:resourceId`.

The form-navigation route authenticates the same Supabase access token and calls the same server `saveWorkspace()` function used by the normal PUT route. It writes only `user_metadata.atlas_problem_spaces.publishing_workspace.notes`; it does not create a local draft, browser table, or alternate database record. After the server confirms the write, the returned canonical workspace is copied into the signed-in session metadata cache so the just-created note remains readable during the same transport outage.

This fallback exists because some browser/network environments can fail both fetch and XHR while ordinary HTML navigation still reaches the application server. It is a third transport to the same database record, not a third storage system.

## Account-page recovery

`public/account-posts.js` loads drafts/publications and Space Blocks independently. If `/api/workspaces/account` or `/api/prop/manual/mine` cannot be reached, it can render the same canonical records already present in the authenticated session metadata. This is read recovery only; it is not a device-only analytical store.

A failure in Messages or Space Blocks must not blank the publication list. Missing optional messaging tables also must not instruct an ordinary user to run SQL.

## Public-publication browser rule

`public/published-public-feed.js` strips viewer Authorization from both the public feed list and public publication-detail GETs. Publication existence is public data. Authentication is allowed only for separate owner controls and write actions.

This means logging in must never turn a working public URL into `Publication unavailable`.

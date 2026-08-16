# Workspace and publishing architecture

Atlas Harbor uses one workspace and publishing system for every Problem Space. Legal, Propositions, Economics, Lead Discovery, Logistics Planner, Life Sciences, Baseball, and future spaces must extend this system rather than create their own persistence path.

## Core rule

**One writable database source of truth. One same-origin API boundary. No browser-direct database writes and no local workspace copies.**

The canonical workspace record lives in Supabase account metadata as one top-level record per resource:

```text
user_metadata.atlas_workspace_record_v2_<resource-key>
```

`<resource-key>` is a deterministic hash of `resource_type + resource_id`. A save patches only that key. The legacy `user_metadata.atlas_problem_spaces.publishing_workspace.notes` array is still read so existing work remains available, but new writes do not resend or grow that aggregate array.

The browser must never create a second device-only copy of the workspace body, projections, publication state, or share token in `localStorage`.

## Allowed browser transport order

Atlas Harbor uses these browser paths:

1. Same-origin Atlas Harbor workspace API: `/api/workspaces/:resourceType/:resourceId`.
2. The already-authenticated user metadata carried in the signed-in session, only to display the last server-confirmed record while a read request is unavailable.

On Baseball report pages, browser transport recovery for the same-origin API is `fetch` → XHR → form navigation. The final transport applies only to authenticated workspace `PUT` requests and posts to `/api/workspaces-form/:resourceType/:resourceId`; the server delegates both routes to the same canonical save function. It is not another persistence layer.

The session snapshot is not writable workspace storage. A successful API save refreshes it only as a last-confirmed read cache. Workspace browser code must never call Supabase `/auth/v1/user` to load or save workspace metadata. Password sign-in, sign-up, and refresh call the same-origin `/api/account/session/...` endpoints; the server talks to Supabase Auth and sets a signed, short-lived HttpOnly session cookie. Persistence stays behind the Atlas Harbor API.

Authenticated API calls share one refresh operation per page and refresh access tokens before they expire. A request that receives `401` retries once with the newest session token. A stale or failed concurrent refresh must never clear a newer session written by another caller. The account indicator is informational and must not add a second blocking session preflight; the same-origin workspace request is authoritative for workspace access.

The preferred browser identity is the signed Atlas Harbor server-session cookie established by sign-in or refresh. It is HttpOnly, SameSite=Lax, expires with the Supabase access session, and contains only a signed account subject and expiry—not a workspace record or provider credential. Workspace responses are private, non-cacheable, and vary on Cookie as well as the compatibility credential headers.

Existing sessions and non-browser clients may also carry the user JWT in standard `Authorization: Bearer ...` and in `X-Atlas-Session`. The second header is a transport mirror, not another credential or persistence path: the server extracts one token and performs the exact same signature, claims, subject, and account verification. It is sent only to Atlas Harbor's own origin, never to Supabase or an external provider. Fetch, XHR, and form-navigation recovery preserve it. If fetch or XHR explicitly returns `AUTH_TOKEN_MISSING`, Baseball treats that as a credential-transport failure and continues through the existing recovery order; a save can therefore reach the canonical API through the token-bearing form body.

Account settings expose a prominent session card. It verifies the same workspace status endpoint and always offers **Log out and sign in again**, so a stale browser session can be deliberately replaced instead of leaving the user trapped behind a locally cached “logged in” indicator.

For current asymmetric Supabase sessions, the server validates the browser JWT against `SUPABASE_JWKS_URL` (falling back to the canonical discovery URL under `SUPABASE_URL`). If a session uses another Supabase-supported signing format or a key outside the discoverable set, the server asks the project's PostgREST gateway to validate the bearer against a deliberately nonexistent relation. Its authenticated missing-relation result (`404` / `PGRST205`) is accepted only when the same request with a tampered signature is rejected (`PGRST301`), proving that the bearer was enforced instead of discarded. The server then independently checks the issuer, `authenticated` audience and role, expiry, and UUID subject before using the backend secret to load that exact account. Account updates use the verified subject and a partial `user_metadata` merge, so a workspace save sends only its segmented record. The remote `/auth/v1/user` endpoint is a last compatibility path when both verification mechanisms are unavailable, not a mandatory hop. Opaque `sb_secret_...` values never appear in the bearer header.

If the API transports fail and the signed-in session contains no matching account record, the UI shows a retryable database error and does not open a device draft.

## Public runtime configuration

Atlas Harbor exposes the Supabase URL and publishable key as public runtime configuration for authentication and other explicitly client-side services. Workspace persistence does not consume those values and does not use `/runtime-config.js` to bypass the workspace API.

Critical account/workspace requests use the preserved native fetch transport when available rather than relying on UI loading wrappers.

## Public publication-feed invariant

**Being signed in must never change, reduce, filter, or otherwise alter the public publication list.**

The list endpoint `GET /api/published-feed` is deliberately session-independent. The browser removes `Authorization` from that exact list request and sends it with omitted credentials. The server independently removes Authorization, the mirrored session header, and the Atlas Harbor session cookie before the published-feed router handles the list. This defense-in-depth rule makes the public list request the same whether a session exists or not.

Public `workspace_notes` and legacy public rows are queried with the anonymous/publishable Supabase role. Do not forward the viewer's bearer token into the list request or into public table reads. Supabase RLS policies can differ between `anon` and `authenticated`; doing so previously caused signed-out users to see the correct feed while signed-in users saw an empty feed.

Publication detail is different: `GET /api/published-feed/:token` may use viewer authentication so the server can identify the owner and expose owner-only controls such as discovery visibility. Authentication on a detail request must not alter whether the shared publication itself is readable.

## Legacy recovery

Older Atlas Harbor versions may have records in:

- `workspace_notes`
- `legal_notes`
- `user_metadata.atlas_problem_spaces.publishing_workspace.notes`
- `user_metadata.atlas_virtual_tables.workspace_notes`
- `user_metadata.atlas_virtual_tables.legal_notes`

These are recovery inputs only. When one is found, Atlas Harbor may copy the newest valid record into the canonical account-metadata workspace. The original recovery record must not be deleted during the read/migration request.

New workspace writes must not create new virtual or device-local records.

## What went wrong previously

Several regressions caused the repeated Legal/Published failures.

### Regression 1: bypassing the workspace API

The workspace initially used `/api/workspaces`, then added browser-direct Supabase account-metadata access when that route was temporarily unreachable.

That bypass exposed internal Auth metadata requests in DevTools, duplicated persistence logic, and turned a server failure into a longer client retry chain.

The fix is **not** to create a local draft or a direct database fallback. The browser retries the same-origin API using alternate transports; the server alone owns canonical persistence.

### Regression 2: read recovery depended on another network request

A former recovery path began by fetching `/api/config`. If the page's fetch transport was failing, both `/api/workspaces` and the supposed fallback immediately failed with `Failed to fetch`.

The repair is to use the last server-confirmed record already present in the signed-in session for read-only display recovery. Writes never use that snapshot and never bypass the API.

### Regression 3: signed-in public feed changed request identity

The publication page continued attaching the viewer bearer token to the public list request. Earlier server behavior could then use authenticated Supabase visibility for public rows. Because RLS policies can differ by role, signed-out users could see the correct feed while signed-in users received zero rows.

Changing only the downstream table headers was not a strong enough invariant because the browser was still making a different request for signed-in users. The final rule is stricter: the list request itself is anonymous in the browser and the server strips Authorization again before list processing. Login state cannot participate in public-list discovery.

### Regression 4: virtual publication tokens

An older browser `rest('workspace_notes')` fallback could create a virtual record when the optional table was unavailable. Its share-token implementation encoded the entire publication record into the URL. That produced enormous `/published/eyJ...` links and could also produce `/published/undefined` when a later update returned no record.

New publishing code must never call browser `workspace_notes` REST as its write path and must never encode publication content into `share_token`.

Canonical new share tokens are compact random server/database tokens. The public feed may expose short deterministic `pub-...` aliases for malformed legacy tokens so old publications remain readable without rewriting or deleting their stored records.

### Regression 5: redundant writes exhausted the form fallback window

Save/Publish previously loaded the record, queried optional tables, repeated authenticated-user reads, waited behind a process-wide write queue, updated metadata, and attempted a legacy table mirror. The fallback form could exceed its 20-second response window.

The server write path now performs one authenticated-user read and one metadata update, skips optional table reads and mirrors, isolates write queues per user, and bounds upstream requests with timeouts.

### Regression 6: valid editor content exceeded transport and metadata-update limits

The shared editor permits 60,000 characters of sanitized HTML and a 12,000-character AI prompt. The API previously parsed only 64 KB of JSON, and the form fallback parsed only 160 KB even though URL encoding can expand Unicode and HTML substantially. A parser-generated 413 response also bypassed the iframe result message, so the browser waited and reported a form timeout.

In addition, changing one workspace rebuilt and uploaded the user's entire metadata document. Unrelated Problem Spaces and every prior post therefore participated in the size of a Baseball save.

The JSON parser now accepts 1 MB and the form parser accepts 3 MB. Form parser failures return a structured same-origin result immediately. The server sends only the single bounded workspace record being changed; legacy aggregate records remain read inputs and are shadowed by the newer per-resource record.

### Regression 7: a locally signed-in player page reached the API without a bearer

The browser still had a user and access token, but the workspace server returned `AUTH_TOKEN_MISSING`. Refreshing the JWT could not help because the failing boundary was browser-to-Atlas-Harbor transport, not Supabase token validity. Error responses also acquired `no-store` only after successful authentication, leaving missing-token responses without the protected cache policy.

Same-origin authenticated requests now mirror the JWT in `X-Atlas-Session`; the server accepts that header only as input to the existing verifier. All workspace responses receive the private no-store and credential-vary policy before authentication begins. Request headers are merged consistently when fetch falls back to XHR or form navigation, and an explicit `AUTH_TOKEN_MISSING` response advances to the next transport just like a network failure.

### Regression 8: repeated bearer verification blocked every save before persistence

After workspace persistence moved behind Atlas Harbor, a browser could retain valid account data while the server rejected the bearer verification path. Each save then repeated the same authentication failure through all transports and refresh, even though the payload never reached the record update.

Sign-in, sign-up, and refresh now establish a signed HttpOnly Atlas Harbor server session from the successful server-side Supabase Auth response. Workspace authorization resolves that signed subject with the backend account API and performs the same bounded per-resource metadata patch. Legacy bearer verification remains available for existing sessions and API clients, but it is no longer the mandatory hop for a newly authenticated browser. Logout clears both session representations, and form-navigation errors preserve their structured authentication code.

## Attachment scope

`share_scope` is part of the workspace record itself.

The “Attach the full underlying analysis/research” checkbox changes the in-memory workspace form state. The value is persisted in the same Save/Publish transaction as the analysis body. The attachment control must not perform a second independent database write after publishing.

This prevents a successful publication from being followed by a failing scope-write request that makes the UI look broken.

## Publication-link UI

The workspace Save/Publish operation returns the saved canonical record, including `share_token`.

The publication-link UI consumes that returned record through `atlas-publication-updated`; it does not refetch `workspace_notes` and it does not manufacture a token.

Hard invariants:

- never render `/published/undefined`
- never encode the entire publication/article into the share token
- never write workspace publication state through a browser-direct optional table
- never require a second publication write merely to update the link panel
- never let authentication change rows in `/published`
- never send viewer Authorization on `GET /api/published-feed`

## Supabase server keys

Supabase `sb_secret_...` keys are opaque API keys, not JWTs. Server code must use `supabaseSecretKey()` and `supabaseServiceHeaders()` from `src/supabase-server-key.js`.

Never send an opaque `sb_secret_...` key as `Authorization: Bearer ...`.

## Shared lifecycle

Every Problem Space follows the same lifecycle:

1. Define objective, decision, constraints, evidence, and open questions.
2. Generate or collect domain research.
3. Render domain-specific visualizations.
4. Mount the shared private database workspace.
5. Load/save the canonical account record through the same-origin workspace API.
6. Publish a separate article with a compact share token.
7. Optionally attach the full underlying research using `share_scope: "everything"` in the same workspace save.
8. Recover old legacy/virtual records into the canonical per-resource account-metadata workspace when needed.

## Requirements for a new Problem Space

A new space must reuse:

- `createProblemSpaceStorage()` for metadata-backed project records
- `/api/workspaces` and read-only signed-in session recovery for private analysis and publishing
- `workspace.js` for the editor, AI draft, projections, and sharing
- `workspace-scope-toggle.js` for optional full-research attachment state
- `/api/published-feed` and the shared public publication renderer
- account-local provider keys; provider secrets are never stored in the repository
- profile, discovery, comments, and publication links

A new space may add only its domain intake, provider adapters, normalization, visualizations, and domain prompts.

## Prohibited patterns

Do not:

- create a local/device workspace copy
- use localStorage as workspace-body or projection persistence
- call Supabase `/auth/v1/user` from workspace browser code to load or save account metadata
- implement a transport fallback that leaves the same-origin workspace API boundary
- use authenticated session metadata as an editable or writable workspace copy
- send a viewer bearer token on the public publication-list request
- forward a viewer bearer token into public publication table reads
- create a custom workspace or publication table for one Problem Space
- write new virtual `workspace_notes` or `legal_notes` records
- encode an entire publication into a share token
- render `/published/undefined`
- send `sb_secret_...` as a bearer token
- delete legacy data during a read or opportunistic migration
- let an optional provider failure erase already loaded public or private content

## CI dependency invariant

`package.json` and `package-lock.json` must remain synchronized. CI uses `npm ci`, which intentionally fails if a dependency is added to `package.json` without updating the lockfile.

Do not add a package speculatively. If code does not import/use a package, remove the declaration. If a new dependency is actually required, regenerate and commit the lockfile in the same change.

The regression test `test/package-lock-sync.test.js` verifies that root dependencies match.

## Testing contract

Regression tests must verify:

- the session metadata read path and same-origin workspace API remain represented
- no localStorage workspace persistence exists
- workspace browser code contains no direct `/auth/v1/user` metadata read or write
- fetch, XHR, and form-navigation fallbacks target only the same-origin workspace API
- one server workspace write performs one authenticated-user read and one canonical metadata update
- concurrent access-token refreshes collapse into one request and cannot erase a newer session
- sign-in and refresh stay behind the same-origin Atlas Harbor account-session API
- signed HttpOnly server sessions reject tampering, expire with the access session, and can save without a bearer header
- same-origin authenticated requests send both credential transports while cross-origin Supabase/provider requests never receive `X-Atlas-Session`
- workspace authentication errors are private, non-cacheable, and vary on both accepted credential headers
- the Account page exposes session verification and a prominent logout/re-authentication control
- the account indicator remains informational and does not add a second blocking workspace-status request
- asymmetric user JWTs are verified against cached project JWKS before server-only account access
- other valid Supabase session formats are verified by the PostgREST JWT gateway without reading or writing a table
- forged, expired, wrong-project, and wrong-role JWTs cannot reach account storage
- metadata updates use a partial server-side merge and do not resend unrelated account state
- payloads that exceed the former 64 KB JSON and 160 KB form limits save successfully
- unrelated large account metadata is not resent with a single workspace update
- public runtime config has a script-based fallback independent of patched `window.fetch`
- signed-in and signed-out public feeds return the same public rows
- `GET /api/published-feed` is stripped of viewer Authorization in both browser and server layers
- public table reads never inherit the viewer bearer token
- publication detail may retain authentication for owner controls
- attachment scope is saved as part of the workspace transaction
- publication links consume the returned workspace record instead of refetching an optional table
- opaque Supabase keys are not bearer JWTs
- public feeds recover database and legacy account sources
- compact publication-token behavior
- `package.json` and `package-lock.json` dependency synchronization
- each new Problem Space mounts the shared workspace
- provider keys remain browser-local when appropriate

## Current shared Problem Spaces

- Legal Systems Tracker
- Economics
- Propositions
- Lead Discovery
- Logistics Planner
- Life Sciences
- Baseball Intelligence

The persistence and publishing rules above apply equally to all of them.

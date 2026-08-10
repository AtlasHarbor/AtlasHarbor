# Workspace and publishing architecture

Atlas Harbor uses one workspace and publishing system for every Problem Space. Legal, Propositions, Economics, Lead Discovery, Logistics Planner, Life Sciences, Baseball, and future spaces must extend this system rather than create their own persistence path.

## Core rule

**One writable database source of truth. Multiple database transports are allowed. No local workspace copies.**

The canonical workspace record lives in Supabase account metadata at:

```text
user_metadata.atlas_problem_spaces.publishing_workspace.notes
```

The browser must never create a second device-only copy of the workspace body, projections, publication state, or share token in `localStorage`.

## Allowed transport order

Atlas Harbor may use these views/transports to reach the same canonical account-database record:

1. Same-origin Atlas Harbor workspace API: `/api/workspaces/:resourceType/:resourceId`.
2. The already-authenticated Supabase user metadata carried in the signed-in session, for immediate read recovery when the API route itself is unreachable.
3. Direct authenticated Supabase Auth user-metadata access using the browser session and public/publishable Supabase key, for a fresh database read/write when the same-origin API is unavailable.

The second item is not a separately writable workspace and the third item is not a second persistence layer. They represent the same Supabase account record and exist so a temporary Atlas Harbor API routing/deployment problem does not make a user's existing analysis disappear.

If both network database transports fail and the signed-in session contains no matching account record, the UI shows a retryable database error and does not open a device draft.

## Public runtime configuration

Direct Supabase recovery must not secretly depend on the same `fetch('/api/config')` transport that may already be failing.

Atlas Harbor therefore preserves the public Supabase URL and publishable key as public runtime configuration and exposes `/runtime-config.js` as a script-tag fallback. Loading a script element does not depend on the application's patched `window.fetch` stack. The public config may be cached in the browser because both values are public client configuration; workspace content, publication bodies, projections, and share tokens are never stored in that config cache.

Critical account/workspace requests use the preserved native fetch transport when available rather than relying on UI loading wrappers.

## Public publication-feed invariant

**Being signed in must never reduce the public publication feed.**

`/api/published-feed` queries public `workspace_notes` and legacy public rows with the anonymous/publishable Supabase role regardless of whether the viewer supplies a bearer token. The bearer token is used only to identify the current viewer and enrich owner-specific controls or recover that viewer's already-shared account-metadata records.

Do not forward the viewer's bearer token into public table reads. Supabase RLS policies can differ between `anon` and `authenticated`; doing so previously caused signed-out users to see the correct feed while signed-in users saw an empty feed.

Authenticated feed responses vary by `Authorization` and are not publicly cached as interchangeable with anonymous responses.

## Legacy recovery

Older Atlas Harbor versions may have records in:

- `workspace_notes`
- `legal_notes`
- `user_metadata.atlas_virtual_tables.workspace_notes`
- `user_metadata.atlas_virtual_tables.legal_notes`

These are recovery inputs only. When one is found, Atlas Harbor may copy the newest valid record into the canonical account-metadata workspace. The original recovery record must not be deleted during the read/migration request.

New workspace writes must not create new virtual or device-local records.

## What went wrong previously

Several regressions caused the repeated Legal/Published failures.

### Regression 1: removing the database transport fallback

The workspace initially used `/api/workspaces` and could still reach the same Supabase account metadata directly if that route was temporarily unreachable. A later cleanup treated that direct account-database path as if it were a conflicting persistence layer and removed it.

When the same-origin workspace route then returned `Failed to fetch`, the UI could no longer reach the existing database record even though the record still existed in Supabase.

The fix is **not** to create a local draft. The fix is to retain multiple transports to the same canonical database record.

### Regression 2: direct recovery still depended on `/api/config`

A later recovery restored direct Supabase access but began that path by fetching `/api/config`. If the page's fetch transport was the thing failing, both `/api/workspaces` and the supposed fallback immediately failed with `Failed to fetch`.

The repair is to check the authenticated account metadata already present in the signed-in session first, preserve a native fetch function before UI wrappers are installed, and provide `/runtime-config.js` as a non-fetch fallback for the public Supabase connection values.

### Regression 3: signed-in public feed changed Supabase RLS role

The publication feed previously forwarded the viewer's bearer token when no server secret was available. That made public table reads run as `authenticated` instead of `anon`. Because RLS policies can differ by role, signed-out users could see the correct feed while signed-in users received zero rows.

Public feed table reads are now always anonymous/publishable. Authentication may enrich the result but may never hide public rows.

### Regression 4: virtual publication tokens

An older browser `rest('workspace_notes')` fallback could create a virtual record when the optional table was unavailable. Its share-token implementation encoded the entire publication record into the URL. That produced enormous `/published/eyJ...` links and could also produce `/published/undefined` when a later update returned no record.

New publishing code must never call browser `workspace_notes` REST as its write path and must never encode publication content into `share_token`.

Canonical new share tokens are compact random server/database tokens. The public feed may expose short deterministic `pub-...` aliases for malformed legacy tokens so old publications remain readable without rewriting or deleting their stored records.

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
- never let authentication reduce rows in `/published`

## Supabase server keys

Supabase `sb_secret_...` keys are opaque API keys, not JWTs. Server code must use `supabaseSecretKey()` and `supabaseServiceHeaders()` from `src/supabase-server-key.js`.

Never send an opaque `sb_secret_...` key as `Authorization: Bearer ...`.

## Shared lifecycle

Every Problem Space follows the same lifecycle:

1. Define objective, decision, constraints, evidence, and open questions.
2. Generate or collect domain research.
3. Render domain-specific visualizations.
4. Mount the shared private database workspace.
5. Load/save the canonical account record through the allowed database recovery chain.
6. Publish a separate article with a compact share token.
7. Optionally attach the full underlying research using `share_scope: "everything"` in the same workspace save.
8. Recover old legacy/virtual records into the canonical account-metadata workspace when needed.

## Requirements for a new Problem Space

A new space must reuse:

- `createProblemSpaceStorage()` for metadata-backed project records
- `/api/workspaces`, authenticated account metadata, and the direct account-database transport for private analysis and publishing recovery
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
- remove the direct account-database transport merely because `/api/workspaces` is preferred
- make direct database recovery depend exclusively on `fetch('/api/config')`
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

- the session metadata read path, workspace API, and direct database transport remain represented
- no localStorage workspace persistence exists
- direct-account fallback writes the same `atlas_problem_spaces.publishing_workspace.notes` record
- public runtime config has a script-based fallback independent of patched `window.fetch`
- signed-in and signed-out public feeds return the same public rows even when authenticated RLS would differ
- public table reads never inherit the viewer bearer token
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

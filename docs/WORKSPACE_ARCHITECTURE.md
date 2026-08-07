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

Atlas Harbor may use two transports to reach the same canonical account-database record:

1. Same-origin Atlas Harbor workspace API: `/api/workspaces/:resourceType/:resourceId`
2. Direct authenticated Supabase Auth user-metadata access using the browser's existing session and the public/publishable Supabase key

The second transport is a database transport, not a local fallback. It reads and writes the same `atlas_problem_spaces.publishing_workspace.notes` record and exists so a temporary Atlas Harbor API routing/deployment problem does not make a user's database-backed analysis disappear.

If both database transports fail, the UI shows a retryable database error and does not open a device draft.

## Legacy recovery

Older Atlas Harbor versions may have records in:

- `workspace_notes`
- `legal_notes`
- `user_metadata.atlas_virtual_tables.workspace_notes`
- `user_metadata.atlas_virtual_tables.legal_notes`

These are recovery inputs only. When one is found, Atlas Harbor may copy the newest valid record into the canonical account-metadata workspace. The original recovery record must not be deleted during the read/migration request.

New workspace writes must not create new virtual or device-local records.

## What went wrong previously

Two regressions caused the repeated Legal/Published failures.

### Regression 1: removing the database transport fallback

The workspace initially used `/api/workspaces` and could still reach the same Supabase account metadata directly if that route was temporarily unreachable. A later cleanup treated that direct account-database path as if it were a conflicting persistence layer and removed it.

When the same-origin workspace route then returned `Failed to fetch`, the UI could no longer reach the existing database record even though the record still existed in Supabase.

The fix is **not** to create a local draft. The fix is to retain both transports to the same canonical database record.

### Regression 2: virtual publication tokens

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

## Supabase server keys

Supabase `sb_secret_...` keys are opaque API keys, not JWTs. Server code must use `supabaseSecretKey()` and `supabaseServiceHeaders()` from `src/supabase-server-key.js`.

Never send an opaque `sb_secret_...` key as `Authorization: Bearer ...`.

## Shared lifecycle

Every Problem Space follows the same lifecycle:

1. Define objective, decision, constraints, evidence, and open questions.
2. Generate or collect domain research.
3. Render domain-specific visualizations.
4. Mount the shared private database workspace.
5. Load/save the canonical account record through one of the allowed database transports.
6. Publish a separate article with a compact share token.
7. Optionally attach the full underlying research using `share_scope: "everything"` in the same workspace save.
8. Recover old legacy/virtual records into the canonical account-metadata workspace when needed.

## Requirements for a new Problem Space

A new space must reuse:

- `createProblemSpaceStorage()` for metadata-backed project records
- `/api/workspaces` and the direct account-database transport for private analysis and publishing
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

- both allowed database transports remain represented
- no localStorage workspace persistence exists
- direct-account fallback writes the same `atlas_problem_spaces.publishing_workspace.notes` record
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

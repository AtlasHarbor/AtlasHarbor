# Workspace and publishing architecture

Atlas Harbor uses one workspace and publishing system for every Problem Space. Legal, Propositions, Lead Discovery, Logistics Planner, and future spaces must extend this system rather than create their own persistence path.

## Core rule

**Database first. Recovery always. Never database only.**

A network, CORS, deployment, Supabase, or browser failure must not make existing work appear deleted. New persistence layers may be added, but an existing recovery layer must not be removed without a proved migration and rollback plan.

## Recovery order

The supported recovery order is:

1. Same-origin Atlas Harbor workspace API (`/api/workspaces/:resourceType/:resourceId`)
2. `workspace_notes`
3. Account metadata (`atlas_problem_spaces.publishing_workspace`)
4. Legacy or virtual records, including `legal_notes`
5. Browser device copy as a last-resort safety net

The newest valid record wins. Migrating a legacy record must copy it forward without deleting the original during the request.

## The regression this prevents

A previous “database-only” refactor made the browser call Supabase directly and removed account-metadata, legacy Legal, and device recovery. When that direct request returned `Failed to fetch`, the UI stopped and showed an empty/error workspace even though the user’s analysis still existed.

A second issue involved Supabase’s opaque `sb_secret_...` server keys. They are API keys, not JWTs. Sending one as `Authorization: Bearer` produces an invalid-JWT response. Server code must use `supabaseSecretKey()` and `supabaseServiceHeaders()` from `src/supabase-server-key.js`.

## Shared lifecycle

Every Problem Space follows the same lifecycle:

1. Define objective, decision, constraints, evidence, and open questions.
2. Generate or collect domain research.
3. Render domain-specific visualizations.
4. Mount the shared private publishing workspace.
5. Save through the same-origin workspace API.
6. Publish a separate article.
7. Optionally attach the full underlying research using `share_scope: "everything"`.
8. Recover from all supported persistence sources if the primary path is unavailable.

## Requirements for a new Problem Space

A new space must reuse:

- `createProblemSpaceStorage()` for metadata-backed project records
- `/api/workspaces` for private analysis and publishing
- `workspace.js` for the editor, AI draft, projections, and sharing
- `workspace-scope-toggle.js` for optional full-research attachment
- `/api/published-feed` and the shared public publication renderer
- account-local provider keys; secret provider keys are never stored in the repository or account metadata
- profile, discovery, comments, and publication links

A new space may add only its domain intake, provider adapters, normalization, visualizations, and domain prompts.

## Prohibited patterns

Do not:

- make a Problem Space depend on browser-direct Supabase access
- remove account metadata, legacy, or device recovery to simplify code
- send `sb_secret_...` as a bearer token
- create a custom workspace or publication table for one Problem Space
- delete legacy data during a read or opportunistic migration
- let an optional provider failure erase already loaded public or private content

## Testing contract

Regression tests must verify:

- same-origin workspace API use
- all recovery sources remain represented
- opaque Supabase keys are not bearer JWTs
- public feeds aggregate database and recoverable account sources
- each new Problem Space mounts the shared workspace
- no schema migration is required for metadata-backed project records
- provider keys remain browser-local

## Current shared Problem Spaces

- Legal Systems Tracker
- Propositions
- Lead Discovery
- Logistics Planner

Lead Discovery uses Perplexity for current-source research and may use Apollo for candidate company/person search. Apollo candidates are not treated as verified fit and contact emails must not be invented. Logistics Planner uses the same research and workspace architecture while adding nodes, routes, shipments, scenarios, coordinates, maps, and game-compatible logistics concepts.

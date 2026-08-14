# Publication authentication and Baseball workspace recovery

This note records two related regressions that can make Atlas Harbor look as though analysis disappeared even when the canonical account/publication record still exists.

## Public publication existence must be session-independent

A shared publication's existence is public state. Viewer authentication may be used only to determine owner-only controls such as visibility editing.

The published-feed server therefore keeps two concepts separate:

- **public account dataset** — the canonical rows/accounts used to discover public publications;
- **current viewer** — the authenticated user, used only to compute ownership.

Do not insert the `/auth/v1/user` session snapshot ahead of the admin account dataset and then skip the matching admin user. Supabase session user metadata can lag newer account metadata. That failure caused a publication to work while signed out but return 404 while its owner was signed in.

When a server secret is available, the admin account list is canonical for account-metadata publication discovery. The signed-in `/auth/v1/user` response does not replace that record. In secretless installations, the current user's metadata may enrich what the signed-in user can recover, but it must never hide public table rows.

## Baseball workspace still has one database source of truth

Baseball player/team/game analysis uses the same canonical workspace as Legal and other Problem Spaces:

```text
user_metadata.atlas_workspace_record_v2_<resource-key>
```

Legacy aggregate `publishing_workspace.notes` entries remain readable, but a new save sends only the matching per-resource metadata patch.

There is no device-only analysis store.

The preferred browser transport is:

```text
/api/workspaces/:resourceType/:resourceId
```

If browser `fetch()` fails, Baseball can retry that same endpoint with XHR. For Save/Publish, a final same-origin form-navigation request posts to `/api/workspaces-form/...`, which delegates to the same server save routine.

Workspace browser code never retries against Supabase `/auth/v1/user` and never writes account metadata directly. Supabase Auth requests belong to authentication; canonical workspace persistence belongs to the Atlas Harbor server API.

The XHR fallback must be limited to:

1. same-origin `/api/workspaces/...` only.

Do not broaden it into a generic cross-origin retry mechanism.

## Regression examples

### Ohtani/new Baseball analysis

If a player has no prior workspace row, session metadata may legitimately contain no matching record. The same-origin API returns an empty canonical workspace that can later be saved. A transport error must not create a device-only draft or trigger a browser-direct database write.

### Joshua Báez/existing Baseball analysis

If an existing Baseball analysis is newer than the session snapshot, the workspace API retrieves it. A stale session object is a read-only recovery hint, not the authority for whether newer account data exists and never a write target.

### Signed-in public article 404

A signed-out request may discover an account-metadata publication through the admin account dataset. If a signed-in request substitutes an older `/auth/v1/user` snapshot for that admin record, the same token can incorrectly return 404. Public discovery must therefore remain based on the public/admin dataset; viewer identity is layered on afterward only for ownership.

## Hard invariants

- Logging in must never make a shared publication disappear.
- Viewer auth may add owner controls; it may not change public existence/content.
- Session `user_metadata` is not allowed to replace a fresher canonical admin account during public discovery.
- Baseball analysis never falls back to localStorage/device workspace persistence.
- Multiple browser transports are allowed only when they retry the same-origin workspace API.
- XHR and form-navigation fallbacks may not leave the same-origin workspace API boundary or write `workspace_notes`, virtual tables, or any second persistence representation.

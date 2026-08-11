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
user_metadata.atlas_problem_spaces.publishing_workspace.notes
```

There is no device-only analysis store.

The preferred browser transport is:

```text
/api/workspaces/:resourceType/:resourceId
```

If browser `fetch()` fails, Baseball can retry that same endpoint with XHR. If the workspace API remains unreachable, the shared workspace attempts the same account record directly through Supabase Auth metadata.

Because the browser failure can affect `fetch()` generally, Baseball's transport helper also permits an XHR retry for the configured Supabase origin's exact `/auth/v1/user` endpoint. This is not another database or workspace. It is another transport to the same authenticated account metadata used by `freshAccount()` and `updateUserMetadata()`.

The XHR fallback must be limited to:

1. same-origin `/api/workspaces/...`, and
2. the configured Supabase origin's exact `/auth/v1/user` endpoint.

Do not broaden it into a generic cross-origin retry mechanism.

## Regression examples

### Ohtani/new Baseball analysis

If a player has no prior workspace row, session metadata may legitimately contain no matching record. The system still needs a fresh account read so an empty canonical workspace can open and later be saved. A fetch-only direct account path can incorrectly turn this into `Analysis could not load`.

### Joshua Báez/existing Baseball analysis

If an existing Baseball analysis is newer than the session snapshot, the fresh account metadata transport must be able to retrieve it. A stale session object is a recovery hint, not the authority for whether newer account data exists.

### Signed-in public article 404

A signed-out request may discover an account-metadata publication through the admin account dataset. If a signed-in request substitutes an older `/auth/v1/user` snapshot for that admin record, the same token can incorrectly return 404. Public discovery must therefore remain based on the public/admin dataset; viewer identity is layered on afterward only for ownership.

## Hard invariants

- Logging in must never make a shared publication disappear.
- Viewer auth may add owner controls; it may not change public existence/content.
- Session `user_metadata` is not allowed to replace a fresher canonical admin account during public discovery.
- Baseball analysis never falls back to localStorage/device workspace persistence.
- Multiple browser transports are allowed only when they reach the same workspace/account database record.
- The XHR fallback may not write `workspace_notes`, virtual tables, or any second persistence representation.

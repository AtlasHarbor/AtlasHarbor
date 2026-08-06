# Legal private workspaces and publications

Legal case analysis uses the shared Atlas Harbor workspace system. The court record and the user's analysis are intentionally separate:

- CourtListener and RECAP provide the canonical case record.
- The private workspace contains the signed-in user's draft, projections, and AI-assisted text.
- Publishing creates a separate public article and never modifies the synchronized court facts.

## Canonical persistence

The canonical private copy is stored in the signed-in account at:

```text
user_metadata.atlas_problem_spaces.publishing_workspace.notes
```

Each note is identified by the user, resource type, and resource ID. A Legal note uses:

```text
resource_type = legal_case
resource_id   = the case slug
```

The browser also writes an immediate device copy under `atlas-workspace:<user>:<type>:<id>`. The device copy is a safety net, not the canonical publication database.

## Server API

Signed-in pages use same-origin routes rather than making ordinary browser-to-PostgREST table calls:

```text
GET /api/workspaces/:resourceType/:resourceId
PUT /api/workspaces/:resourceType/:resourceId
GET /api/workspaces/status
```

The GET route searches all known historical stores, selects the newest record, and migrates it into account metadata. The PUT route saves the canonical account copy and makes a best-effort mirror to the optional `workspace_notes` table.

## Historical migration order

A workspace load considers:

1. `atlas_problem_spaces.publishing_workspace.notes`
2. older `atlas_virtual_tables.workspace_notes` account metadata
3. the optional `workspace_notes` table
4. for Legal only, the legacy `legal_notes` table
5. the local device copy when the account services cannot be reached

The newest record wins. Reading an older adapter automatically migrates the selected record into the canonical account-metadata store.

Legacy Legal notes whose body begins with `ATLAS_WORKSPACE_V1` are decoded before migration. Existing publication state, sharing state, projections, title, body, dates, and share token are preserved. A deterministic legacy share token is generated only when an old published record has no token.

## Deployment-gap behavior

Render can briefly serve a new browser asset while the corresponding server process is still replacing an older deployment. During that window, `fetch('/api/workspaces/...')` can fail even though the user remains signed in.

The workspace therefore follows this fallback sequence:

1. Try the same-origin workspace API.
2. Read the cached account-metadata copy already present in the authenticated user object.
3. On save, update Supabase Auth user metadata directly with the user's JWT.
4. Keep the device copy if both account paths fail.

A deployment gap must not replace the workspace with a false sign-in prompt. The UI reports which fallback is active and retains the draft.

## Publication feed recovery

`GET /api/published-feed` merges discoverable publications from:

- account metadata in `publishing_workspace.notes`,
- older virtual workspace metadata,
- the optional `workspace_notes` table,
- legacy Legal publications in `legal_notes`.

Records are deduplicated by share token or record ID, and the newest copy wins. The feed uses the authenticated user's account when available and, with a configured server secret key, enumerates all accounts for global discovery.

## Supabase key compatibility

Supabase supports both legacy JWT `service_role` keys and newer opaque `sb_secret_...` keys.

- A legacy service-role JWT is sent in both `apikey` and `Authorization: Bearer`.
- An opaque `sb_secret_...` key is sent only in `apikey`.

Sending an opaque secret key as a bearer token causes an `Invalid JWT` response and can make global account enumeration or server-side metadata recovery appear empty. Atlas Harbor centralizes this distinction in `src/supabase-server-key.js`.

Accepted environment names are:

```text
SUPABASE_SECRET_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_SERVICE_KEY
```

`SUPABASE_SECRET_KEY` is preferred.

## Verification checklist

After deployment:

1. Open `/api/workspaces/status` and confirm `ok: true`.
2. Sign in and open a Legal case with a previous draft.
3. Confirm the draft appears without a sign-in prompt.
4. Save a change, reload, and confirm it persists.
5. Publish with sharing enabled and follow the returned article link.
6. Open `/api/published-feed` while signed in and confirm the article appears.
7. Open `/published` in a private browser window and confirm global publications appear when a server secret key is configured.
8. Temporarily make the optional SQL tables unavailable in a test environment and confirm account-metadata drafts and publications still work.
9. Run `npm run check` and `npm test`.

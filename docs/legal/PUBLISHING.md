# Legal private workspaces and publications

Legal case analysis uses the shared Atlas Harbor publishing database. The court record and the user's analysis remain separate:

- CourtListener and RECAP provide the canonical case record.
- The same-origin Atlas Harbor workspace API stores the signed-in user's draft, projections, and AI-assisted text in a per-resource account-metadata record.
- Publishing creates a separate public article and never modifies synchronized court facts.

## Canonical persistence

The canonical private workspace record is:

```text
user_metadata.atlas_workspace_record_v2_<resource-key>
```

Each row is identified by:

```text
user_id + resource_type + resource_id
```

For the New York v. KalshiEX workspace:

```text
resource_type = legal_case
resource_id   = ny-kalshi-enforcement-2026
```

The browser reads and saves only through `/api/workspaces/:resourceType/:resourceId`. The Atlas Harbor server authenticates the user's access token and patches only the matching per-resource metadata key. Browser workspace code does not call Supabase persistence endpoints directly.

There is no device-only or `localStorage` persistence path for analysis content. A failed database request is displayed as a database error and does not create a second private copy.

## Why the August 2026 regression happened

Older workspace versions wrote an optional `workspace_notes` table or compatibility metadata. The deployed table is not assumed to exist, so those sources are now read-only recovery inputs behind the same-origin `/api/workspaces` service.

The deployed browser could load the new JavaScript while the workspace service returned `Failed to fetch`. The interface therefore showed and edited a fallback copy. At the same time, `/published` and the private workspace were no longer guaranteed to read the same source.

That behavior was misleading: a user could see a draft or copy a share link even though the canonical database write had not succeeded.

The repaired invariant is:

> A successful save means the server confirmed the canonical per-resource account record.

## Database access paths

The browser uses only the same-origin workspace endpoints:

```text
GET /api/workspaces/:resourceType/:resourceId
PUT /api/workspaces/:resourceType/:resourceId
GET /api/workspaces/status
```

The per-resource metadata key is derived from:

```text
resource_type + resource_id
```

The normal JSON route accepts 1 MB. Baseball's URL-encoded form-navigation recovery accepts 3 MB and returns structured parser errors immediately. The saved record itself remains bounded to a 60,000-character sanitized body and 12,000-character AI prompt.

## One-time legacy migration

Older Legal analysis may exist in `workspace_notes`, `legal_notes`, the aggregate `publishing_workspace.notes` array, or virtual metadata created during earlier regressions. On load, Atlas Harbor compares timestamps from:

1. the current per-resource account record,
2. optional `workspace_notes`,
3. the user's older `legal_notes`,
4. legacy and virtual publishing metadata attached to the account.

When a newer legacy copy exists, it may be copied into the per-resource account record. Original recovery data is not deleted during that read/migration request.

No browser device copy is read or written.

## Published feed

`/published` merges the newest shared, published record from the canonical account dataset and read-only legacy/table adapters. A newer per-resource record shadows an older aggregate copy.

A row appears in discovery when:

```text
is_shared = true
is_published = true
share_token is present
featured is not false
```

Direct publication pages resolve the database row by `share_token`.

## Supabase key handling

Authentication may use the public publishable key in the browser. Workspace persistence remains server mediated. Server adapters support both legacy JWT service-role keys and newer opaque `sb_secret_...` keys. Opaque secret keys are API keys and are not sent as bearer JWTs.

Accepted server environment names are:

```text
SUPABASE_SECRET_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_SERVICE_KEY
```

`SUPABASE_SECRET_KEY` is preferred.

## Legal page presentation

The public Legal page does not display implementation details such as account-storage mode, service-key status, or CourtListener-token configuration. Those diagnostics belong in Admin and operational logs.

The shared Problem Spaces menu remains available on the Legal index and focused case pages.

## Verification checklist

After deployment:

1. Sign in and open `/legal/ny-kalshi-enforcement-2026`.
2. Confirm the workspace says it is saved in the account database and shows no device-copy or reconnect warning.
3. Edit the analysis and press **Save draft**.
4. Reload and confirm the edit remains.
5. Enable sharing and press **Publish**.
6. Open the returned `/published/<share-token>` URL.
7. Open `/published` and confirm the article is listed.
8. Sign in on another browser or device and confirm the same private draft loads.
9. Confirm the Legal index does not display internal storage or CourtListener-token diagnostics.
10. Run `npm run check` and `npm test` before deployment.

When the server or upstream account database is unavailable, the workspace reports a database error. It does not claim that a local or device-only copy was saved.

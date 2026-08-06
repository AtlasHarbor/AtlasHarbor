# Legal private workspaces and publications

Legal case analysis uses the shared Atlas Harbor publishing database. The court record and the user's analysis remain separate:

- CourtListener and RECAP provide the canonical case record.
- `workspace_notes` stores the signed-in user's draft, projections, and AI-assisted text.
- Publishing creates a separate public article and never modifies synchronized court facts.

## Canonical persistence

The only canonical private workspace store is:

```text
public.workspace_notes
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

The browser reads and upserts the signed-in user's row using the Supabase publishable key and that user's access-token JWT. Row Level Security permits users to read and modify their own rows.

There is no device-only or `localStorage` persistence path for analysis content. A failed database request is displayed as a database error and does not create a second private copy.

## Why the August 2026 regression happened

The original workspace used authenticated database requests to `workspace_notes`. A later compatibility change routed it through a new same-origin `/api/workspaces` service and added account-metadata and device fallbacks.

The deployed browser could load the new JavaScript while the workspace service returned `Failed to fetch`. The interface therefore showed and edited a fallback copy. At the same time, `/published` and the private workspace were no longer guaranteed to read the same source.

That behavior was misleading: a user could see a draft or copy a share link even though the canonical database write had not succeeded.

The repaired invariant is:

> A successful save means the `workspace_notes` database row was written.

## Database access paths

The browser writes `workspace_notes` directly with the authenticated user's JWT. The same-origin workspace API also uses `workspace_notes`, so it remains available for server-side clients and diagnostics without creating another storage model.

```text
GET /api/workspaces/:resourceType/:resourceId
PUT /api/workspaces/:resourceType/:resourceId
GET /api/workspaces/status
```

Both browser and server paths use the same unique constraint:

```text
on_conflict = user_id, resource_type, resource_id
```

## One-time legacy migration

Older Legal analysis may exist in `legal_notes`, or in temporary account metadata created during the regression. On the first successful database load, Atlas Harbor compares timestamps from:

1. the current `workspace_notes` row,
2. the user's older `legal_notes` row,
3. temporary publishing metadata attached to the account.

When a newer legacy copy exists, it is upserted into `workspace_notes`. Matching temporary account-metadata copies are then removed. This is a one-time migration into the database, not an ongoing fallback.

No browser device copy is read or written.

## Published feed

`/published` reads shared, published rows directly from `workspace_notes` and merges the server-side publication index when available. Both refer to the same database records.

A row appears in discovery when:

```text
is_shared = true
is_published = true
share_token is present
featured is not false
```

Direct publication pages resolve the database row by `share_token`.

## Supabase key handling

Browser database calls use:

- `apikey: SUPABASE_PUBLISHABLE_KEY`
- `Authorization: Bearer <signed-in user JWT>`

Server adapters support both legacy JWT service-role keys and newer opaque `sb_secret_...` keys. Opaque secret keys are API keys and are not sent as bearer JWTs.

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

When the table, network, or RLS policy is unavailable, the workspace reports a database error. It does not claim that a local or account-metadata fallback was saved.

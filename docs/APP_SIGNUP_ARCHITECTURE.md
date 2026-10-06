# App signup architecture

This document explains the TWP Ventures launch-signup path hosted by Atlas Harbor.

## Why this is isolated

Atlas Harbor has a deliberately fragile but well-documented persistence boundary for analytical workspaces. The signup system does not touch that boundary. It does not change `workspace_notes`, segmented workspace metadata, the logistics game, publishing, or any existing Problem Space table.

The public website talks only to Atlas Harbor:

```
TWP Ventures landing page
  -> POST https://atlasharborship.com/api/app-signups
  -> Atlas Harbor server
  -> existing Atlas Harbor Supabase project using server-side credentials
  -> master admin user_metadata.atlas_signup_registry
```

The browser never receives the Supabase secret key and never writes to Supabase directly.

## Storage model

The initial implementation uses a dedicated logical collection in the existing master admin account metadata:

```
user_metadata.atlas_signup_registry
```

Shape:

```json
{
  "version": 1,
  "apps": {
    "decision-iq-improver": {
      "slug": "decision-iq-improver",
      "name": "Decision: IQ Improver & Mazes",
      "status": "prelaunch"
    }
  },
  "signups": [
    {
      "id": "uuid",
      "app_slug": "decision-iq-improver",
      "app_name": "Decision: IQ Improver & Mazes",
      "name": "Example",
      "email": "person@example.com",
      "source": "https://twpventures.com/Decision-IQ-Improver/1/",
      "consent": true,
      "createdAt": "ISO timestamp",
      "updatedAt": "ISO timestamp"
    }
  ]
}
```

This was chosen for the first launch because Atlas Harbor already treats the master admin account as the durable store for administrator configuration and inbound case recommendations. It avoids adding a migration dependency to a production system whose documentation explicitly warns against unnecessary persistence paths.

The collection is capped at 2,500 signups. If launch volume approaches that limit, migrate this exact API contract to a dedicated Postgres table before increasing the cap.

## Public endpoint

`POST /api/app-signups`

Accepted body:

```json
{
  "app": "decision-iq-improver",
  "name": "Optional name",
  "email": "required@example.com",
  "source": "https://twpventures.com/...",
  "consent": true,
  "website": ""
}
```

The `website` field is a honeypot and should remain empty.

The endpoint:

- validates the app slug
- normalizes email addresses to lowercase
- validates consent
- deduplicates on app plus email
- serializes writes in-process to reduce read-modify-write collisions
- applies a small in-memory rate limit
- accepts browser CORS requests only from the configured TWP origins
- writes with the existing Atlas Harbor server secret
- returns only success state, never the saved email or admin data

Configure additional browser origins with:

```
SIGNUP_ALLOWED_ORIGINS=https://twpventures.com,https://www.twpventures.com
```

CORS is not authentication. It reduces accidental browser misuse, but a public signup endpoint can still be called by non-browser clients. Validation, rate limiting, the honeypot, and server-side storage are the actual protections.

## Admin endpoint and page

`GET /api/admin/signups`

`/signups`

The API requires both:

1. a valid signed-in Atlas Harbor user access token
2. the existing Atlas Harbor admin password

The signed-in user must already have an admin role in `user_metadata.atlas_admin.roles`. This is the same identity model used by the current admin dashboard. The signup page reuses the existing browser session and `atlas-admin-password` session-storage value when the administrator has already unlocked the main admin dashboard.

The admin page groups signups by app, supports app filtering and name/email search, and exports the current filtered list as CSV in the browser.

## Why this does not use the connected Supabase integration

The repository's deployed environment contains the credentials for the production Atlas Harbor Supabase project. This feature intentionally uses those existing environment variables at runtime:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` or its accepted aliases

It uses `supabaseSecretKey()` and `supabaseServiceHeaders()` so opaque `sb_secret_...` keys are never incorrectly sent as bearer JWTs.

## Future dedicated-table migration

If the signup list grows beyond a few thousand contacts, move the backend storage to a dedicated private table, for example `app_signups`, while keeping both HTTP endpoints unchanged.

Recommended table fields:

- `id uuid primary key`
- `app_slug text`
- `name text`
- `email text`
- `source text`
- `consent boolean`
- `created_at timestamptz`
- `updated_at timestamptz`
- unique constraint on normalized `app_slug + email`

Keep RLS enabled and revoke direct `anon` and `authenticated` table access. The public website should continue posting to Atlas Harbor rather than PostgREST directly. The admin list should continue going through the Atlas Harbor admin endpoint. That preserves the API boundary even if the storage implementation changes.

## Decision launch pages

The signup dashboard registers the current TWP app portfolio, including released apps with zero signups, so the administrator can see one consolidated app list. The current registry includes Slip and Jump, Bible with Original Names, Decision: IQ Improver & Mazes, and Pitch Recognition.

The initial public signup client is TWP Ventures:

- `https://twpventures.com/Decision-IQ-Improver/`
- `https://twpventures.com/Decision-IQ-Improver/1/`

Both submit `app: "decision-iq-improver"` to the same endpoint. Additional landing-page experiments can reuse the endpoint and identify themselves through the `source` URL.

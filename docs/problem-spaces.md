# Problem Spaces

Atlas Harbor groups its applications under a shared **Problem Spaces** navigation control. The main link opens `/problems`; the adjacent arrow opens a menu on desktop hover or click and on mobile click.

Current spaces:

- Logistics Control Tower (`/game`)
- Baseball Intelligence (`/baseball`)
- Legal Systems Tracker (`/legal`)
- Published Analysis (`/published`)

## Public requests

`/problems` contains a request form with:

- requester name or organization,
- requested space title,
- optional proposed URL or reference URL,
- description of the users, decisions, and information the space should model.

New requests are created with `status = pending` and are publicly visible immediately. Approved requests remain visible as approved; rejected requests are hidden from the public directory but remain available to administrators.

Install the database table by running:

```text
supabase/problem-spaces.sql
```

The server uses `SUPABASE_SECRET_KEY` for request writes and approvals. Browser roles receive no direct table access.

## Admin portal

`/admin` is the initial approval portal. It supports pending, approved, and rejected states. Set the password only through environment configuration:

```text
ADMIN_PASSWORD=YOUR_PRIVATE_ADMIN_PASSWORD
```

The password must not be hard-coded into source control. The browser keeps it only in `sessionStorage` for the current tab and sends it in the `x-admin-password` header. Production deployments should use a long unique value and HTTPS.

## Planned admin evolution

The password gate is an interim control. A later admin portal should replace it with:

1. Supabase-authenticated administrator accounts.
2. A dedicated admin role or claims table.
3. Audit records for every approval decision.
4. Optional comments sent to the requester.
5. Editing approved titles, descriptions, slugs, and launch URLs.
6. Assignment and implementation status such as proposed, planned, building, beta, and launched.
7. Rate limiting and abuse review for public submissions.

The API is intentionally separated under `/api/admin/problem-spaces` so the current password check can be replaced without changing the public request model.

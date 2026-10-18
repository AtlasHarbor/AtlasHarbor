# Project Doesn't Work — feature prototype

This branch adds an independent public discussion and accountability service. No canonical Scripture changes, donations or payouts.

## Staged setup
1. Deploy this Atlas branch to its own HTTPS staging URL.
2. Verify the Atlas environment SUPABASE_URL and SUPABASE_SECRET_KEY are for the intended writable Supabase project.
3. Apply supabase/movement.sql to that Supabase project. The existing startup migration checks site_admin only and DOES NOT automatically apply movement.sql.
4. Set MOVEMENT_VISITOR_SALT to a private 24+ character random string and MOVEMENT_ADMIN_TOKEN to a separate secret.
5. In the Way website's Netlify feature-branch preview environment, set ATLAS_HARBOR_API_ORIGIN to the actual Atlas staging HTTPS origin (no trailing path).
6. Deploy the website feature branch and open /projects/doesnt-work/. Test its same-origin /projects/doesnt-work/api/health endpoint.
7. Submit a request with a verified TWV verse, submit a no-money idea, pray twice in one browser, and verify a single count; repeat from another browser profile and verify another possible count. Verify public GET response omits contact_email and decision_note.
8. Through a trusted operator client (never browser source), test the separate Atlas /api/movement/admin/requests route with x-movement-admin-token. The admin approval path cannot initiate payments.

## API
GET /api/movement/health, /verses, /requests, /requests/:id.
POST /api/movement/requests, /requests/:id/ideas, /requests/:id/prayers, /requests/:id/votes.
GET /api/movement/admin/requests, GET /api/movement/admin/requests/:id/history and PATCH /api/movement/admin/requests/:id require private token and cannot be relayed through the public Netlify function.

## Data
Browser → Netlify rewrite → movement-proxy serverless function → Atlas HTTPS API → server-only Supabase key → five RLS tables (movement_requests, movement_ideas, movement_prayers, movement_votes, movement_review_events). No browser Supabase secret, no metadata-workspace fallback, no fabricated sample posts.

## Principle
Every $100 spent should empower at least three distinct people who can go on to help others. Zero-dollar solutions may help one or more people. The current conservative validation minimum for any positive amount is max(3, ceil(3 × amount / 100)); define fractional thresholds formally before launch.

## Important limits
- The existing Atlas analysis workspaces are not the fundraising ledger.
- The Supabase schema must be installed before the API will work.
- Prayer de-duplication is per browser UUID in localStorage, hashed server-side and constrained in the database; browsers or profiles can still double-count people. A prayer count is not a verified count of real people or prayers.
- Public posting uses lightweight rate limiting and validation; this is not sufficient anti-spam, moderation, safety screening, or bot protection for a major launch.
- All monetary transfers, payment-provider checks, identity verification and mandatory Way Partners video interviews are manual, out of band. Nothing in the API moves funds.
- Use Node test runner with npm test in the Atlas repo. Do browser and database verification only after staging is configured.

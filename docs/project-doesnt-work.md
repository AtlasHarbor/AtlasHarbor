# Project Doesn't Work — Atlas Harbor implementation

## Purpose
People helping people. Help can be a referral, service, shared resource, skill, time, useful action or an appropriate funded intervention. The outward-facing site does not lead with a money target.

### What is implemented on this feature branch
- Atlas-hosted public page: `/movement/`.
- Public reads: `GET /api/movement/health`, `/verses`, `/requests`, `/requests/:id`.
- Public participation: `POST /api/movement/requests/:id/prayers`, `/votes`. One count per browser-generated UUID per request; visitor IDs are HMAC-hashed on the server. These counts are *not* verified distinct people.
- Atlas account actions: `POST /api/movement/requests`, `/requests/:id/ideas`; `GET /api/movement/mine`; `PATCH /api/movement/requests/:id` for the author's still-open draft.
- Reviewer actions: `GET /api/movement/admin/requests`, `/admin/requests/:id/history`, `PATCH /admin/requests/:id`. These routes require a private operator token, and are never exposed through the Way Version Netlify relay.
- Verified TWV verse-picker URLs. Faith is voluntary and is not an eligibility test.
- No payment collection, PayPal transfer, wallet, balance, self-disbursement, or automatic grant approval. Funding, if added, remains separate and requires real Way Partners video vetting and regulated providers.

## Identity
The existing Atlas Harbor sign-up route `POST /api/account/session/sign-up` immediately creates a usable session. When Supabase returns a new user without a session because email confirmation is enabled, the existing Atlas server confirms that newly created account and signs it in. No confirmation link is required before posting. **This creates account access, not proof that an email address or real-world identity has been verified.** Funding reviews require independent identity validation.

The new Movement frontend imports Atlas's existing `supabase-client.js` and reuses its sign-in / sign-up / session refresh functions. Sensitive Supabase service keys are never present in browser code. Posts and ideas get an `author_id` assigned server-side after validating the Atlas session. Anonymous posting is not enabled; anonymous viewing and low-friction prayer/vote counts are.

## Database
Apply `supabase/movement.sql` to the actual Atlas production/staging Supabase project. There are five independent RLS-protected tables: `movement_requests`, `movement_ideas`, `movement_prayers`, `movement_votes`, `movement_review_events`. Account-metadata workspaces are not modified. The migration uses server-only data access and a separate review audit.

The existing `AUTO_MIGRATE` startup logic only concerns `site_admin`; it does NOT install this Movement schema. Applying it to an unidentified database, or to the inactive Supabase project that was the only one visible to the connected account, would not establish that the live Atlas server uses it.

## Live activation checklist
1. Identify the actual Atlas Harbor production host/deployment provider and read its configured `SUPABASE_URL`; match that project's ID to an accessible writable Supabase project. Do not guess a URL or project.
2. Apply the reviewed SQL migration `supabase/movement.sql` to that project; verify all five tables, RLS, triggers, and PostgREST service-role reads/writes.
3. Configure server-only `MOVEMENT_VISITOR_SALT` (random, 24+ characters) and `MOVEMENT_ADMIN_TOKEN` (random, 32+ characters) on that host. The existing Atlas session and Supabase secrets must also be working. Never commit private values.
4. Deploy the current Atlas feature branch or merge the vetted PR `#32` to the production deployment branch, depending on hosting provider. Verify `GET /api/movement/health` returns `ok: true` (the endpoint queries the database, not just an environment flag).
5. Exercise the real signup → create → list → reply → pray twice from same browser → vote twice → owner edit → admin review → review-history read path. Confirm `contact_email` does not appear in public reads and requests without valid login cannot post.
6. Test a rejected/failing project outcome, not only success. Verify nothing can initiate a real transfer.
7. Put spam reporting, moderation and safe removal workflows in place before inviting the public at scale.

## Way Version preview
The Way website change remains on its separate feature branch. It keeps public browsing, prayers, and non-money feasibility voting possible through an allowlisted Netlify server relay. New posts, comments, and sign-in are directed to the ONE Atlas account experience, not to a duplicate cross-domain session.

Configure **Netlify** `ATLAS_HARBOR_API_ORIGIN` with the Atlas HTTPS origin *when known*. The relay's `GET /projects/doesnt-work/api/link` provides the connected community URL. Netlify preview deploys should not assume a specific domain or leak Atlas server credentials.

## Verification status (18 October 2026)
- `npm run check`: passed in GitHub Actions on Movement branch.
- Movement-specific Node tests (validation, HTTP mock PostgREST, SQL structure): passed in focused GitHub Actions workflow.
- Full Atlas test suite: 20 failures on branch, the same 20 failures already observed on existing main (unrelated baseball, game and legacy contract tests); these are existing repository test debt, not grounds to claim a clean full suite.
- Actual Supabase table migration/live hostname verification: **not completed**. The connected Supabase project available here reported **INACTIVE**, and its relationship to the live Atlas server was not established.
- Therefore **no verified live end-to-end backend or payment integration**; do not state that it is production ready or deployed.

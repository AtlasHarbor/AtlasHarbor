# Atlas Harbor Legal Problem Space

The Legal Problem Space is a case command center built around verifiable court records. It is designed to help a lawyer or researcher answer four questions:

1. What happened?
2. What is pending?
3. Which documents control the next decision?
4. What should be investigated, calendared, drafted, or monitored next?

It is an informational research and decision-support system, not a docketing system and not legal advice.

## Data architecture

Legal is database-first but does not require an ordinary user to initialize Supabase tables.

The service reads and writes in this order:

1. `legal_cases`, when the optional dedicated Supabase table exists.
2. The initialized Atlas Harbor host account at `user_metadata.atlas_problem_spaces.legal_tracker`.
3. Repository JSON records in `data/legal/cases` as bootstrap seeds and last-resort read-only data.

`POST /api/legal/seed` copies repository cases into the available persistent store only when the store is empty. The endpoint is rate-limited to one accepted request per minute.

## CourtListener and RECAP

`COURTLISTENER_API_TOKEN` enables authenticated calls to the CourtListener REST API. The non-AI synchronization process resolves each tracked case from its:

- CourtListener docket ID,
- CourtListener URL,
- court abbreviation,
- PACER case ID,
- docket number, or
- existing primary-source URL.

For a resolved case the service stores:

- docket identity and CourtListener link,
- case name and docket number,
- filing and termination dates,
- latest filing date,
- assigned and referred judges,
- cause, nature of suit, jury demand, and jurisdiction type,
- parties and roles,
- docket entries,
- RECAP document metadata,
- direct PDF links when a public RECAP copy exists,
- available extracted document text on demand,
- a merged procedural timeline,
- data-quality and synchronization timestamps.

The known X.AI property-damage matter is linked to the supplied primary filing:

```text
https://storage.courtlistener.com/recap/gov.uscourts.msnd.52569/gov.uscourts.msnd.52569.1.0.pdf
```

Its CourtListener hints are:

```text
court: msnd
PACER case ID: 52569
docket: 3:26-cv-00148
```

The application does not treat CourtListener coverage as guaranteed completeness. A missing RECAP PDF means the filing may be metadata-only, sealed, unavailable in RECAP, or not yet contributed. Deadlines must be verified from the operative court docket and orders.

## Non-AI update flow

CourtListener synchronization is independent of OpenRouter and Perplexity.

A synchronization:

1. Resolves the CourtListener docket.
2. Downloads structured docket metadata.
3. Downloads bounded sets of docket entries and parties.
4. Normalizes RECAP document records and direct PDF URLs.
5. Merges primary-source links and timeline events.
6. Rebuilds the case decision board.
7. Saves the updated case immediately.

Public case synchronization is limited to one request per IP and case per minute. CourtListener responses and completed case synchronizations are cached for five minutes.

When `COURTLISTENER_API_TOKEN` is configured, a background scheduler checks every 15 minutes and updates a small batch of cases whose last successful synchronization is more than 12 hours old. This avoids a burst of requests at startup or on every page view.

Admin provides:

- **Seed if empty**
- **Sync selected case · no AI**
- **Sync next 10 cases · no AI**
- CourtListener token, storage, document-count, and latest-sync status

Perplexity research is a separate optional step after the structured docket is current.

## Public and authenticated APIs

```text
GET  /api/legal/status
POST /api/legal/seed
GET  /api/legal/cases
GET  /api/legal/cases/:slug
GET  /api/legal/cases/:slug/docket
GET  /api/legal/cases/:slug/documents
GET  /api/legal/cases/:slug/documents/:id
POST /api/legal/cases/:slug/sync
```

Signed-in research endpoints:

```text
POST /api/legal/cases/:slug/analysis-context
POST /api/legal/cases/:slug/ask-perplexity
POST /api/legal/perplexity/test
```

Admin endpoints:

```text
GET  /api/admin/legal/status
POST /api/admin/legal/seed
POST /api/admin/legal/sync/:slug
POST /api/admin/legal/sync-all
POST /api/admin/research/run
```

## Case decision board

Each synchronized case is presented as a problem rather than an undifferentiated data dump.

The command center shows:

- the current procedural stage,
- the newest synchronized filing,
- an action queue,
- questions that remain unresolved,
- the assigned judge and latest filing date,
- parties and roles,
- a chronological docket table,
- a document workbench,
- primary-source links,
- private analysis and publication tools.

The action queue is deliberately operational. It asks the researcher to identify the operative pleading or order, determine what relief is pending, verify deadlines from primary documents, and separate allegations, evidence, procedural rulings, and holdings.

## Filing-aware AI

A user can select documents manually or ask Atlas Harbor to choose likely documents based on:

- document type,
- current question terms,
- document availability,
- filing recency.

The server retrieves available CourtListener text only for the bounded selected set. It does not send the complete docket archive to a model.

The user can then use:

- their OpenRouter or OpenAI-compatible model configured in Account, or
- their own Perplexity key stored only in browser local storage.

The prompt instructs models to distinguish:

- pleaded allegations,
- evidence,
- procedural events,
- orders and holdings,
- inference and uncertainty.

Identical Perplexity case questions are cached for five minutes. A signed-in user must wait 30 seconds before starting another Perplexity request for the same case.

Admin may use the encrypted Admin Perplexity key or the server `PERPLEXITY_API_KEY`. Admin research is saved as a reviewable run and does not silently rewrite verified court facts.

## Required deployment settings

```bash
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
COURTLISTENER_API_TOKEN=...
```

Optional server research:

```bash
PERPLEXITY_API_KEY=...
ADMIN_ENCRYPTION_KEY=...
```

A dedicated `legal_cases` table is optional. Without it, shared Legal records use the same Supabase account-metadata pattern as other bootstrap-scale Problem Spaces.

## Verification checklist

After deployment:

1. Open `/api/legal/status` and confirm a nonzero case count.
2. Call `POST /api/legal/seed` if storage is empty.
3. Open Admin and confirm the Legal docket-data panel appears.
4. Synchronize the X.AI case without AI.
5. Confirm its case page contains a CourtListener link and the supplied complaint PDF.
6. Confirm docket entries and document counts persist after a server restart.
7. Select the complaint and ask a narrow question with the user AI.
8. Verify the answer labels allegations and does not present them as findings.
9. Trigger the same Perplexity question twice and confirm the second result reports the five-minute cache.
10. Run `npm run check` and `npm test` before deployment.

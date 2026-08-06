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

- exact CourtListener docket ID or URL,
- court abbreviation and PACER case ID,
- court abbreviation and docket number,
- docket number, or
- a separately verified identity correction for a case whose bootstrap record was incomplete.

Exact docket identifiers take precedence over caption similarity. Cases with overlapping parties must not be merged merely because their names look related.

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

The application does not treat CourtListener coverage as guaranteed completeness. A missing RECAP PDF means the filing may be metadata-only, sealed, unavailable in RECAP, or not yet contributed. Deadlines must be verified from the operative court docket and orders.

## Verified case identities

### New York v. KalshiEX LLC

The New York enforcement action must remain separate from Kalshi's earlier preemption case and its appeal.

```text
Originating state action
Caption: New York v. KalshiEX LLC
Court: New York Supreme Court, New York County
Docket: 453272/2026

Federal removal action
Caption: People of the State of New York, by Letitia James,
         Attorney General of the State of New York v. KalshiEX LLC
Court: U.S. District Court for the Southern District of New York
Docket: 1:26-cv-06550
CourtListener docket ID: 73700030
CourtListener: https://www.courtlistener.com/docket/73700030/people-of-the-state-of-new-york-by-letitia-james-attorney-general-of-the/
```

The following are related matters, not alternate numbers for the enforcement action:

```text
KalshiEX LLC v. Williams
S.D.N.Y. docket: 1:25-cv-08846
CourtListener docket ID: 71766515

KalshiEX LLC v. Williams
Second Circuit docket: 26-1835
CourtListener docket ID: 73601450
```

Atlas Harbor hard-binds the enforcement action to CourtListener docket `73700030`. Before a public refresh, it saves the corrected identity to the persistent Legal store. The non-AI synchronization then retrieves that docket's entries, parties, and available RECAP documents. A startup task performs the same correction and refresh when `COURTLISTENER_API_TOKEN` is configured.

This prevents three common errors:

1. showing `Docket pending` after the federal number is known,
2. attaching filings from `KalshiEX LLC v. Williams` to the New York enforcement action,
3. treating the Second Circuit appeal number as the district-court docket.

### X.AI property-damage matter

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

## Non-AI update flow

CourtListener synchronization is independent of OpenRouter and Perplexity.

A synchronization:

1. Resolves or applies the verified CourtListener identity.
2. Downloads structured docket metadata.
3. Downloads bounded sets of docket entries and parties.
4. Normalizes RECAP document records and direct PDF URLs.
5. Merges primary-source links and timeline events.
6. Rebuilds the case decision board.
7. Saves the updated case immediately.

Public case synchronization is limited to one request per IP and case per minute. CourtListener responses and completed case synchronizations are cached for five minutes. A verified identity can force a fresh synchronization after the public rate-limit check so an earlier unresolved lookup does not keep the case empty.

When `COURTLISTENER_API_TOKEN` is configured, a background scheduler checks every 15 minutes and updates a small batch of cases whose last successful synchronization is more than 12 hours old. Verified incomplete identities are corrected shortly after startup before their first docket refresh.

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
POST /api/legal/cases/:slug/refresh
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

## Mobile card containment

Legal cards must remain readable at narrow phone widths. Provider and seed values can contain long captions, docket strings, court names, URLs, or machine-style labels.

`public/legal-containment.css` is loaded after the original Legal styles and enforces:

- `min-width: 0` on grid and card descendants,
- hidden horizontal overflow at the card boundary,
- `overflow-wrap: anywhere` and `word-break: break-word` for long text,
- bounded tag chips,
- a two-column metadata layout on larger screens,
- a single-column docket and freshness layout on phone widths,
- human-readable stage labels rather than raw underscore-separated database values.

The containment rule applies to index cards and the command center. Horizontal scrolling remains intentional only inside large docket tables.

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
4. Open the New York v. KalshiEX card and confirm it shows federal docket `1:26-cv-06550`.
5. Confirm its CourtListener button opens docket `73700030`, not the Williams docket.
6. Run its non-AI synchronization and confirm entries and available RECAP documents appear and persist.
7. Confirm state docket `453272/2026`, Williams district docket `1:25-cv-08846`, and appeal `26-1835` are labeled as separate related matters.
8. Test the Legal index at approximately 390 CSS pixels wide and confirm no card text leaves its border.
9. Synchronize the X.AI case without AI and confirm the supplied complaint PDF appears.
10. Confirm docket entries and document counts persist after a server restart.
11. Select a filing and ask a narrow question with the user AI.
12. Verify the answer labels allegations and does not present them as findings.
13. Trigger the same Perplexity question twice and confirm the second result reports the five-minute cache.
14. Run `npm run check` and `npm test` before deployment.

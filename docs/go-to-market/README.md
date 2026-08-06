# Go-to-Market Problem Space

`/go-to-market` turns a product, service, partnership, or market-entry proposition into a structured research report and a separate publishable point of view.

## Workflow

1. Sign in to Atlas Harbor.
2. Add and test a Perplexity key in Account settings. The key remains in browser local storage.
3. Complete the guided brief: proposition, audience, geography, route to market, partner profile, target economics, constraints, and research questions.
4. Select research modules such as market size, demographics, demand, competitors, channels, unit economics, launch budget, partnership design, creative direction, risks, experiments, and a 90-day plan.
5. Atlas Harbor sends the generated research method to Perplexity, parses the response, normalizes it into the report schema, and renders the result as an infographic-heavy decision page.
6. The creator can regenerate with feedback or use the account’s selected OpenAI-compatible model to edit the full report.
7. Any signed-in user can write a separate rich-text analysis or pitch through the standard publishing workspace.

A live Perplexity test is required in the current page session before creating or regenerating a report. A stored but untested key does not unlock generation.

## Persistence

Shared reports use the existing metadata-backed Problem Space storage:

```text
host account user_metadata.atlas_problem_spaces.go_to_market
```

The collection is bounded and shared writes use the serialization already provided by `src/problem-space-storage.js`. No new Supabase table or schema change is required.

User-authored pitches use the existing `workspace_notes` table through the shared publishing workspace:

```text
resource_type = go_to_market_report
resource_id   = <report id>
```

The Legal and Go-to-Market workspaces expose an off-by-default attachment control. The control reuses the existing `share_scope` column:

- `page` — publish the author’s article and link to the underlying page.
- `everything` — publish the article and render the underlying Legal or Go-to-Market analysis beneath it.

## API

```text
GET   /api/go-to-market/status
POST  /api/go-to-market/perplexity/test
GET   /api/go-to-market/reports
GET   /api/go-to-market/reports/:id
POST  /api/go-to-market/reports
POST  /api/go-to-market/reports/:id/regenerate
PATCH /api/go-to-market/reports/:id
```

Authenticated research requests pass the browser-local Perplexity key in `x-perplexity-key`. The server uses it for that request only and does not persist it.

## Report contract

Each report is normalized into stable sections for rendering and publication:

- executive summary and recommendation,
- headline metrics,
- audience segments,
- demand signals and verification tasks,
- TAM/SAM/SOM planning envelope,
- unit economics and break-even,
- launch budget,
- competitors and positioning gaps,
- channel fit,
- funnel assumptions,
- phased launch plan and decision gates,
- partnership case,
- creative direction,
- risks and mitigations,
- validation experiments and stop rules,
- sources, assumptions, and research gaps.

The normalizer calculates missing contribution margin and break-even values when the necessary inputs exist, bounds arrays and text lengths, de-duplicates sources, rejects malformed provider JSON, and labels unsupported content as low-confidence or preliminary.

## Starter report: The Way

The built-in starter demonstrates a premium minimalist apparel partnership for The Way Version. It frames a restrained shirt carrying “The Way,” discreet attribution to The Way Version, a partner-operated capsule, and a gated pilot.

Its pricing, market sizing, budget, funnel, and unit economics are explicitly planning assumptions. The starter is marked `needs_refresh` until a signed-in user runs current-source Perplexity research. It is not presented as validated demand, legal clearance, or a partner commitment.

## Responsible use

Go-to-market research is decision support, not a guarantee. Verify market claims, trademarks, legal and regulatory obligations, partner capabilities, manufacturing quotes, margins, taxes, return rates, customer-acquisition costs, and source freshness before committing capital or making representations to another party.

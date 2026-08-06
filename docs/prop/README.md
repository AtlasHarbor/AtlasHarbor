# Propositions Problem Space

`/prop` turns an idea into a source-backed decision case. A proposition can be a work project, company partnership, sales pitch, investment request, program, policy, vendor choice, operating change, product, brand, or market entry.

The old `/go-to-market` path redirects to `/prop`. Existing report records and publications continue to use the internal `go_to_market` storage namespace and `go_to_market_report` workspace resource type so previously created data and share links remain compatible.

## Core method

Every proposition begins with a decision:

1. What is being proposed?
2. What is happening now?
3. What problem or opportunity does it address?
4. Who must decide, support, implement, buy, or use it?
5. What exact action is requested?
6. Why now?
7. What evidence supports the case?
8. What realistic alternatives exist?
9. What will implementation require?
10. What costs, risks, objections, and dependencies matter?
11. What measurable outcomes define success?
12. What pilot, experiment, or stop rule should govern the next commitment?

The generator does **not** force every proposition into a market-launch template. Internal work projects emphasize baseline, workflow, stakeholders, governance, implementation, adoption, and outcomes. Partnership proposals emphasize complementary assets, value exchange, responsibilities, data, terms, and exit conditions. Sales propositions emphasize buyer-specific baseline, measurable value, implementation burden, objections, and a bounded proof plan. Product and market propositions add demand, segments, competitors, channels, market sizing, unit economics, and launch budget when relevant.

## Example propositions

### Internal work project

**Proposition:** approve a 60-day shared work-intake and prioritization pilot.

The case should measure assignment time, clarification, throughput, stakeholder status visibility, administrative overhead, adoption, governance, and the expand/revise/stop decision.

### Partnership between companies

**Proposition:** combine one company’s analytics product with another company’s trusted distribution and domain expertise in a six-month pilot.

The case should test strategic fit, customer or member value, data rights, responsibilities, operating workload, commercial structure, and the path from pilot to scale or clean exit.

### B2B sales pitch

**Proposition:** run a paid uptime-analytics pilot at one manufacturing site.

The case should avoid unsupported savings claims. It should establish the buyer’s baseline, data readiness, implementation scope, value measurement, security requirements, objections, and the rule for expansion.

### Product and partner launch

**Proposition:** create a premium minimalist apparel capsule for The Way Version with an established faith-commerce operator.

The case should combine audience and demand evidence, rights review, garment quality, partner fit, attribution, unit economics, budget, validation experiments, and gated pilot terms.

## Research and AI

A signed-in user must add and validate a browser-local Perplexity key before creating or regenerating a proposition. Atlas Harbor sends the generated research method and brief to Perplexity, parses the returned JSON, normalizes it into the proposition contract, and stores the resulting report. The key is not persisted.

The user’s primary OpenAI-compatible model can edit an existing proposition. The editor is instructed to preserve source URLs, distinguish external evidence from user-provided context and assumptions, and avoid inventing internal metrics, customer outcomes, prices, market facts, or validation results.

## Persistence

Shared proposition reports reuse the existing metadata-backed Problem Space storage:

```text
host account user_metadata.atlas_problem_spaces.go_to_market
```

User-authored pitches continue to use the existing `workspace_notes` table:

```text
resource_type = go_to_market_report
resource_id   = <proposition report id>
```

No Supabase schema change is required.

## Canonical API

```text
GET   /api/prop/status
POST  /api/prop/perplexity/test
GET   /api/prop/reports
GET   /api/prop/reports/:id
POST  /api/prop/reports
POST  /api/prop/reports/:id/regenerate
PATCH /api/prop/reports/:id
```

The previous `/api/go-to-market/*` endpoints remain mounted for compatibility with older clients.

## Report contract

The normalized proposition may include:

- proposition type, organizations, decision audience, and requested action,
- current state, problem statement, why now, scope, timeline, and financial frame,
- executive summary, recommendation, and call to action,
- headline metrics and evidence claims with confidence and verification tasks,
- stakeholder influence, interests, and concerns,
- expected outcomes, success measures, and owners,
- alternatives with benefits, costs, risks, and comparative scores,
- costs, budget, unit or deal economics, and market sizing when relevant,
- audience, demand, competitors, channels, and partnership structure when relevant,
- implementation phases, owners, dependencies, and decision gates,
- objections, risks, validation experiments, stop rules, sources, assumptions, and research gaps.

## Responsible use

A proposition is decision support, not proof. External sources may be stale or incomplete. Internal facts are only as reliable as the information supplied by the user. Verify consequential claims, legal rights, data permissions, security, implementation capacity, pricing, costs, taxes, obligations, customer evidence, financial assumptions, and source freshness before making commitments or representations.

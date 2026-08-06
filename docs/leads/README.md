# Lead Discovery

`/leads` is a research and decision workspace for answering: **Which organizations and people should we contact, in what order, and with what evidence-based message?**

## Workflow

1. Define the offer, objective, decision, constraints, exclusions, target roles, geography, and research questions.
2. Optionally query Apollo for candidate people and organizations.
3. Use Perplexity to verify company relevance, current triggers, likely needs, timing, and external evidence.
4. Rank leads using explicit fit and timing criteria.
5. Build a small knowledge graph of companies, people, needs, evidence, relationships, objections, and message themes.
6. Draft a cold email, LinkedIn message, follow-up, and meeting request.
7. Write the user’s own analysis in the shared private workspace.
8. Publish a separate article, optionally attaching the underlying lead research.
9. Move qualified targets into `/prop` to build a buyer- or partner-specific proposition.

## Providers

Perplexity is required for a generated research project. The user’s key remains browser-local.

Apollo is optional. Atlas Harbor uses Apollo People API Search only to collect candidate records. Apollo candidates are not treated as verified fit, and the system does not invent or infer email addresses. Contact enrichment, credits, terms, privacy obligations, and outreach compliance remain the user’s responsibility.

## Lead record

A generated lead should distinguish:

- organization and domain,
- candidate person and role,
- location,
- fit score,
- timing score,
- current trigger,
- likely need,
- reason to contact,
- supporting evidence and source URLs,
- risks and disqualifiers,
- verification steps,
- LinkedIn URL and provider email status when supplied.

## Persistence

Projects are stored without a new table:

```text
user_metadata.atlas_problem_spaces.lead_discovery.projects
```

Private analysis and publications use the shared workspace architecture described in [`../WORKSPACE_ARCHITECTURE.md`](../WORKSPACE_ARCHITECTURE.md).

```text
resource_type = lead_project
resource_id   = <project slug>
```

## Sharing

A project is private by default. Publishing creates a separate article. When `share_scope` is `everything`, `/api/public-research/lead_project/:slug` may expose the underlying research only after confirming a matching shared and published workspace record.

## Responsible use

Lead research can be stale, incomplete, or wrong. Verify identity, role, company relationship, consent, lawful basis, applicable privacy and anti-spam requirements, and provider terms before enrichment or outreach. Do not use the system for harassment, sensitive-trait targeting, impersonation, or deceptive messaging.

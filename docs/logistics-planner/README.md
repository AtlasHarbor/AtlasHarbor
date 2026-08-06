# Logistics Planner

`/logistics` is a third-party logistics research and decision workspace. It complements `/game`: the game teaches the operating structure, while Logistics Planner applies that structure to a real network, facility, routing, service, or resilience decision.

## Workflow

1. Define the objective and decision requested.
2. Capture shipments, origins, destinations, volumes, ready dates, deadlines, priorities, and service levels.
3. Capture facilities, carriers, modes, capacities, rates, transit times, and known coordinates.
4. State hard constraints separately from preferences.
5. Use Perplexity for current external research and the user’s OpenRouter-compatible AI for drafting or critique in the shared workspace.
6. Produce baseline, lowest-cost, fastest, and resilient scenarios where the evidence supports them.
7. Map nodes with verified latitude/longitude and display route and scenario summaries.
8. Record bottlenecks, risks, assumptions, verification tasks, KPIs, and an implementation plan.
9. Publish a separate analysis, optionally attaching the full logistics research.

## Model

The planner uses the same concepts as the logistics game:

- objectives and contracts,
- nodes and facilities,
- lanes and routes,
- shipments and queues,
- capacity and utilization,
- modes and transfer points,
- time windows and service commitments,
- cost, margin, reliability, and resilience,
- disruptions, alternatives, and competitors.

Generated values are not treated as operational truth. Exact coordinates, rates, transit times, regulations, capacity, and service availability must be sourced or marked for verification.

## Mapping

When numeric coordinates are available, the browser displays the project using the existing OpenStreetMap-compatible map approach. Routing outputs should preserve the game’s hard invariants: land modes cannot cross unsupported landmasses, ocean legs require ports, and the system must not invent a straight-line operational route when no verified corridor exists.

## Persistence

Projects are stored without a new table:

```text
user_metadata.atlas_problem_spaces.logistics_planner.projects
```

Private analysis and publishing use [`../WORKSPACE_ARCHITECTURE.md`](../WORKSPACE_ARCHITECTURE.md).

```text
resource_type = logistics_project
resource_id   = <project slug>
```

## Sharing

The research project remains private unless a matching workspace is shared and published with `share_scope = everything`. Public attachment checks are server-side and do not make the general project API public.

## Responsible use

This is decision support, not a transportation management system or guaranteed route optimizer. Verify rates, schedules, restrictions, customs requirements, carrier authority, insurance, hazardous-material requirements, labor constraints, weather, road access, and service commitments with the relevant provider and authority before execution.

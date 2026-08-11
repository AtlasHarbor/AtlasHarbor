# Logistics gameplay loop and usability

This document is the product/design contract for the playable loop on `/game`. It should be read with `README.md`, `TIME_AND_MOVEMENT.md`, `FINANCE_AND_WORKING_CAPITAL.md`, and `COMMAND_CENTER.md` before changing the game.

## Core player fantasy

The player is the General Manager & Lead Dispatcher of a global 3PL. The game is not a dashboard demo and should not behave like enterprise software with unexplained controls. The player should continuously make understandable operating and company decisions under time, service, capacity, relationship, and liquidity constraints.

Persistent objective:

> **Fill customer orders. Protect promises. Stay solvent. Build the most resilient global 3PL.**

The player should be able to answer four questions at almost any moment:

1. What needs me now?
2. Why does it matter?
3. What can I do about it?
4. What will each choice change?

## Primary loop

The normal loop is:

```text
See what needs attention
  -> inspect the real entity
  -> understand state + constraint
  -> compare outcomes
  -> commit, defer, delegate, or withdraw
  -> authoritative game time advances
  -> physical + financial consequences appear
  -> new requests, risks, or opportunities emerge
  -> repeat
```

`game-command-loop-v2.js` adds a Manager command queue near the top of the dashboard. It prioritizes unresolved decisions, the next customer promise, requests/commitments, and working capital.

## Interaction rule

If something looks like an entity or operational state, it should not be a dead card.

Clickable game objects include:

- customer contracts,
- controlled movements,
- facilities and global operating nodes,
- named managers,
- competitors,
- operations-feed events,
- Cash/A/R/A/P and major metrics,
- departments,
- carriers,
- drivers,
- capacity,
- capability projects,
- requests and commitments,
- commercial opportunities.

When clicked, an object should either:

- explain itself,
- open relevant controls,
- focus the physical object on the map,
- or open a decision with consequences.

A click may not silently alter state without feedback.

## Plain-language terminology

Avoid unexplained internal/3PL jargon in primary actions. If a domain term is useful, place an `i` explainer beside it.

Example:

- old: `Take back routine work`
- preferred: `Manage routine work myself`

Meaning: a delegated department currently handles ordinary work inside policy. Manual management sends more routine choices back to the player. It does not fire the team or cancel loads.

The current command layer adds explainers for Network Time, On-time, Trust, delegated/manual work, A/R, A/P, partner capacity, requests/commitments, renewal/commercial follow-up, and major dashboard sections.

## Map behavior

`See it on the map` means exactly that:

1. close the text/decision overlay,
2. focus the physical shipment or relevant corridor,
3. scroll the map into view,
4. visibly acknowledge the focus.

Do not leave the player in a text sheet while changing a map state behind it.

## Requests and commitments

Hiring, capacity procurement, capability implementation, and commercial follow-up all involve lead time. They live in a common Request Center backed by the same persisted game career.

The player can inspect active requests and, when allowed:

- cancel/withdraw them,
- accelerate implementation for additional cash,
- wait for normal completion.

Request state is not a separate database. It remains inside the same synced/offline career object.

## Commercial continuation

Delivered work can create a commercial follow-up rather than a fake instant `renew` button.

Flow:

```text
Delivered order
  -> discuss follow-on work
  -> commercial request waits 48 game hours
  -> outcome is determined from persisted request state + service/trust conditions
  -> no deal OR new opportunity
  -> player accepts or declines
  -> accepted opportunity creates a new customer promise
```

This makes growth optional. More revenue also creates more inventory, service, staffing, capacity, A/R, and liquidity exposure.

## Consequence model

A good choice should normally trade one advantage against another. Common axes:

- speed vs. margin,
- customer promise vs. cash,
- owned control vs. recurring fixed cost,
- partner flexibility vs. uncertain access,
- delegation vs. direct attention,
- growth vs. operating capacity,
- staffing resilience vs. payroll,
- early communication vs. relationship attention,
- recovery spending vs. solvency.

The decision portal should never imply that the recommended option is universally correct. `MOST LIKELY / BEST FIT` means the model currently favors it under the visible constraints.

## Failure and recovery

Failure must be possible, but a warning state should remain playable.

The career becomes dangerous when, for example:

- cash is critically low while A/P materially exceeds liquidity,
- customer trust collapses,
- on-time service collapses,
- unresolved promises compound faster than the company can recover.

The UI exposes a Career Stakes strip and a `TURNAROUND REQUIRED` state when severe thresholds are reached.

Recovery should remain possible through decisions such as:

- slow or decline growth,
- collect A/R,
- reduce/cancel commitments,
- protect the highest-value customer promises,
- improve only capabilities that solve the current bottleneck,
- use partner capacity rather than over-owning assets,
- rebuild trust and service performance.

Do not create a hidden game-over roll. Failure should arise from understandable accumulated state.

## Repeatability

The original fixed orders are onboarding content, not the complete game.

Long sessions depend on state feeding future state:

- deliveries create receivables,
- receivables create collection decisions,
- service affects trust,
- trust/service affect commercial follow-up,
- follow-up can create new orders,
- new orders create production/capacity/cash pressure,
- growth can require hiring, leases, partner contracts, or capability projects,
- those commitments create payroll/A/P/fixed-cost pressure,
- disruptions force recovery choices,
- outcomes feed the operations history and later opportunities.

The goal is a renewable operating system, not a sequence of disconnected scripted popups.

## UI invariants

1. Do not use a document-wide `MutationObserver` to make cards interactive.
2. Important click/tap actions need pressed/selected feedback.
3. Disabled actions must explain why they are unavailable or be contextually omitted.
4. Close controls must remain visible on mobile decision surfaces.
5. Header controls may not overflow the viewport.
6. `Run scenario drill` is not part of the primary player flow and is hidden from the main customer-promise panel.
7. The floating `↓ Dashboard` control must reveal that substantial interactive content exists below the map.
8. People, competitors, and event-feed cards are interactive and keyboard accessible.
9. Requests and commercial opportunities must persist inside the career object and therefore follow the existing local/account synchronization model.
10. No new storage/database path should be introduced merely for a UI feature.

## Design rationale

The command-loop redesign follows widely used interaction/game-design principles: interactive elements should be visibly interactive and give feedback; direct interaction with game objects reduces control clutter; meaningful decisions require visible consequences; and adding more options is not automatically better when those options increase complexity without adding meaningful agency.

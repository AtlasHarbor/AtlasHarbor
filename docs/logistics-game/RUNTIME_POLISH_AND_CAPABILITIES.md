# Logistics game runtime polish and capability projects

This document records the current interaction and simulation rules added after the authoritative-network-time work.

## Save feedback

The game is offline-capable by design, but routine save feedback should stay concise. A temporary account-sync failure must not dominate gameplay with a long warning. Local persistence continues and account sync retries on later changes/online events, while the visible status may simply say `Saved` or `Saved on this device`.

## Time-linked map traffic

Visible operational traffic must be tied to the authoritative network clock. The global supply-chain layer derives vessel, aircraft and truck position from route distance, modeled mode speed and `atlasGameTime.nowHours()`.

Do not reintroduce decorative moving assets driven directly by `Date.now()` or animation-cycle time. The older competitor markers used a wall-clock phase independent of network time; those moving icons are hidden from the live operating map. Competitive corridors and market-pressure information remain available without pretending the competitor vehicle position is simulation state.

## Map detail interaction

On desktop, clicking an operating facility or transport asset must put its information/action surface immediately in the foreground. The player should not need to scroll around the map to find the result of a click. Foreground panels must have a clear close control and bounded viewport scrolling.

`Related contracts` must show actual player-controlled contracts whose origin, via, or destination references that facility. If there are none, say so explicitly. Contract results must be actionable and open the matching contract decision flow.

Global facilities can also open a foreground operating-node card. A global node with no directly assigned player contract may still be used by the delegated routine network; the UI must distinguish those concepts.

## Capability projects (formerly instant upgrades)

Upgrades are implementation projects, not instant RPG purchases.

Each capability has:

- a current level and concrete current effect;
- a next-level effect;
- an implementation cost;
- a game-hour lead time;
- operating prerequisites;
- a pending project state while implementation is underway.

The project cost is committed when approved. The level changes only after authoritative game time reaches the project's `completesAt` hour.

### Smart Dispatch

Requires an active Dispatch & Capacity function. Each level corresponds to the existing delegated-throughput mechanic (+700 units per game hour per level) and the operating process used for safe automated releases.

### Recovery Desk

Requires an active Dispatch & Capacity function with sufficient headcount. Each level reduces eligible modeled recovery-action cost by 10%, matching the existing recovery-cost mechanic.

### Relationship Team

Requires an active Customer Operations function with sufficient headcount. Each level improves the trust recovered by proactive customer communication, matching the existing customer-update mechanic.

### Network Visibility

Requires Smart Dispatch level 1+ and active Dispatch & Capacity. Each level provides a modeled 12% early-warning chance to intercept a newly generated routine disruption before it reaches the GM decision queue. The initial EX-001 tutorial exception and deliberately requested scenario drills are not intercepted.

## Full-state export

The bottom-of-game `Export my game state` control produces a JSON snapshot intended for debugging, analysis, or pasting into an AI system.

The export contains:

- export timestamp and format version;
- authoritative network time, speed, and pause state;
- current company/chapter objectives and progress labels;
- the entire persisted game state object.

The raw state includes orders, shipments, exceptions, cash, finance state (A/R, A/P, ledger, history and fuel data), management departments, staffing pipelines, fleet/capacity, carriers, drivers, global contracts, capability projects, onboarding state and all other persisted career fields. `Copy state JSON` provides the same object through the clipboard when available.

The exporter does not mutate the career and does not create another persistence source of truth.

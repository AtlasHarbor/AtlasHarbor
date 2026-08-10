# Logistics game time and movement

The logistics game has one authoritative simulation clock. The map is a visualization of that clock; it must never run a separate animation timeline that makes vehicles travel while network time is standing still.

## Core time rule

At normal speed, **15 real minutes = 1 game hour**.

Players can run the simulation at 1×, 2×, or 4×. Pause stops authoritative game-time accumulation. The clock maintains a fractional carry balance between completed game hours so the visible clock can progress through minutes instead of appearing frozen until the next full hour.

`public/game-time-authority.js` owns this behavior. It suppresses the two legacy intervals that previously existed in `game-v3.js` and `game-command-center.js`; leaving both active would double-advance the career after fixing the 1× accumulation bug.

The authoritative clock lives inside the same persisted game state:

```text
state.totalHours
state.clock.speed
state.clock.lastRealAt
state.clock.extraCarryMs
state.clock.authority = "network-v2"
```

`extraCarryMs` is accumulated scaled real time toward the next full game hour. It is intentionally used for the entire clock at 1× as well as accelerated play. The previous command-center implementation only accumulated `(speed - 1)` for short ticks, which meant 1× could stay at 08:00 indefinitely.

## Offline and account catch-up

The existing local + account progress model remains in force:

- the local device copy keeps the career playable offline,
- signed-in progress is also stored under `user_metadata.atlas_problem_spaces.logistics_game.progress`,
- newest valid copy wins during synchronization,
- elapsed real time is reconciled into game time on return,
- one reconciliation is capped to protect the browser from an unbounded catch-up loop.

A completed game hour advances the same operating state used by the rest of the game: production, delegated dispatch, shipment progress, delivery outcomes, cash, service metrics, staffing/capacity pipelines, and other listeners attached to `atlas-game-changed`.

## Global traffic model

`public/game-global-simulation-v2.js` derives global vehicle positions from authoritative game hours. It does **not** increment an independent `performance.now()` animation clock.

Representative mode-speed assumptions are:

| Mode | Modeled speed |
|---|---:|
| Truck / drayage | 68 km/h |
| Ocean vessel | 35 km/h |
| Air cargo | 820 km/h |

These are scenario assumptions, not live telemetry or carrier schedules.

Each global route leg has a geographic path. Path distance is calculated in kilometers, including dateline handling. Movement duration is approximately:

```text
route distance / modeled mode speed
```

Gateway dwell is added after a leg to represent handoff/handling. Vehicle position at any network time is then calculated from the amount of route time elapsed. This allows a player to inspect a vehicle and see current-leg kilometers, modeled speed, remaining distance, and distance moved during the previous game hour.

## Startup catch-up replay

On opening the operating map, the game visually replays up to the previous 24 game hours over roughly **18 real seconds**. For a fresh career starting at Mon 08:00, the replay begins at Mon 00:00.

The replay is historical visualization only; it does not rewind or duplicate persisted state. It fast-forwards markers from their calculated earlier positions to the authoritative current position, while an on-map time rail shows the replay time and progress.

After replay finishes:

1. the rail changes to **LIVE NETWORK**,
2. marker positions come directly from `atlasGameTime.nowHours()`,
3. 1×/2×/4× changes affect both clock and vehicle progression,
4. pause freezes both,
5. pulsing marker halos communicate that a move is active without adding fake distance.

## Air traffic

The opening global scenario includes multiple routine long-haul air chains rather than a single demonstration aircraft, including:

- Shanghai → Sydney,
- Incheon / Seoul → Los Angeles,
- Narita / Tokyo → Amsterdam,
- Dubai World Central → Nairobi,
- Nairobi → London Heathrow.

These run alongside the ocean and drayage network and use the same authoritative time calculation.

## Invariants

1. Never reintroduce an independent visual clock for global vehicles.
2. Never allow both the legacy 15-minute base timer and command-center timer to advance the same career alongside the authoritative clock.
3. At 1×, sub-hour real time must accumulate; 1× is not allowed to remain frozen until a special catch-up condition.
4. Map replay may animate historical positions quickly, but after replay all positions must be calculated from game time.
5. Pulsing/halo animation may signal activity but must not alter geographic progress.
6. Global movement remains representative simulation geometry, not AIS, flight tracking, freight quotations, or navigation.
7. Performance guardrails remain: no document-wide `MutationObserver`, no full map rebuild on every movement tick.

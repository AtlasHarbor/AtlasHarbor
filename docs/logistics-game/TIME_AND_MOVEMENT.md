# Logistics game time and movement

The logistics game has one authoritative simulation clock. The map, operating state, staffing/capacity lead times, and working-capital settlement all consume that clock; none may run a separate timeline that makes the company move while network time stands still.

## Core time rule

At normal speed, **15 real minutes = 1 game hour**.

Players can run the simulation at 1×, 2×, or 4×. Pause stops authoritative game-time accumulation. The clock maintains a fractional carry balance between completed game hours so the visible clock progresses through minutes instead of appearing frozen until the next full hour.

`public/game-time-authority.js` owns this behavior. It suppresses the two legacy intervals that previously existed in `game-v3.js` and `game-command-center.js`; leaving both active would double-advance the career.

The authoritative clock lives inside the same persisted game state:

```text
state.totalHours
state.clock.speed
state.clock.lastRealAt
state.clock.extraCarryMs
state.clock.authority = "network-v2"
```

`extraCarryMs` accumulates scaled real time toward the next full game hour at every speed, including 1×. The previous command-center implementation only accumulated `(speed - 1)` for short ticks, which meant 1× could remain at 08:00 indefinitely.

## Offline and account catch-up

The local + account progress model remains in force:

- the local device copy keeps the career playable offline,
- signed-in progress is stored under `user_metadata.atlas_problem_spaces.logistics_game.progress`,
- newest valid copy wins during synchronization,
- elapsed real time is reconciled into game time on return,
- one reconciliation is capped to protect the browser from an unbounded catch-up loop.

A completed game hour advances the same career used by the rest of the game: production, delegated dispatch, physical shipment progress, delivery outcomes, staffing/capacity pipelines, management cost accrual, receivables, payables and other listeners attached to game-state events.

## Global traffic model

`public/game-global-simulation-v2.js` derives global vehicle positions from authoritative game hours. It does **not** increment an independent visual clock.

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

Gateway dwell is added after a leg to represent handoff/handling. Vehicle position at any network time is calculated from the route time elapsed. Clicking a vehicle shows current-leg kilometers, modeled speed, remaining distance, and distance moved in the previous game hour.

## Working capital on the same clock

`public/game-finance.js` settles finance from the same game-hour state.

Examples:

- customer invoice due dates are expressed in game hours,
- Net 30 A/R becomes collectible only when network time reaches its due/expected-pay time,
- late invoices and arbitration resolution wait for game time,
- carrier/fuel A/P waits for its due time,
- payroll accrues with elapsed game time,
- lease/fixed-asset cost accrues with elapsed game time,
- 1×/2×/4× therefore accelerate both operations and finance consistently.

Pause must stop both physical network progression and new time-based finance settlement.

## Startup catch-up replay

On opening the operating map, the game visually replays up to the previous 24 game hours over roughly **18 real seconds**. For a fresh career starting at Mon 08:00, the visual replay begins around Mon 00:00.

The replay is historical visualization only; it does not rewind or duplicate persisted state. It fast-forwards vehicle markers from calculated earlier positions to the authoritative current position, while an on-map time rail shows replay time and progress.

The finance layer listens to the same replay event and interpolates displayed Cash/A/R/A/P from the nearest saved balance toward the authoritative current balances. It does not create invoices, settle bills, or mutate cash during the replay.

After replay finishes:

1. the rail changes to **LIVE NETWORK**,
2. marker positions come directly from `atlasGameTime.nowHours()`,
3. finance returns to authoritative saved balances,
4. 1×/2×/4× affect both operating and finance time,
5. pause freezes time-driven progression,
6. pulsing marker halos communicate active moves without adding fake distance.

## Air traffic

The opening global scenario includes multiple long-haul air chains rather than a single demonstration aircraft, including:

- Shanghai → Sydney,
- Incheon / Seoul → Los Angeles,
- Narita / Tokyo → Amsterdam,
- Dubai World Central → Nairobi,
- Nairobi → London Heathrow.

These run alongside ocean and drayage flows and use the same authoritative time calculation.

## Invariants

1. Never reintroduce an independent visual clock for global vehicles.
2. Never allow both legacy time intervals to advance the same career alongside the authoritative clock.
3. At 1×, sub-hour real time must accumulate.
4. Replay may animate historical positions/balances quickly, but live mode must derive from authoritative game time.
5. Pulsing/halo animation may signal activity but must not alter geographic progress.
6. Financial replay may not create, pay, collect or duplicate accounting entries.
7. A/R, A/P, payroll, lease accrual and arbitration resolution must use game hours rather than wall-clock-only timers.
8. Global movement remains representative simulation geometry, not AIS, flight tracking, freight quotations or navigation.
9. Performance guardrails remain: no document-wide `MutationObserver` and no full map rebuild on every movement tick.

# Live network rebase

The logistics game is an **established operating 3PL**, not a startup with zero customers. The opening career state intentionally contains existing customer promises, staff, carrier relationships, equipment/capacity, working capital, and global movements. Chapter 1 is therefore **Stabilize the inherited network**: take over the live operation, resolve the opening exception, and protect the first priority wave.

## Career time

Network Time uses two different concepts that must not be conflated:

1. `state.totalHours` is the authoritative simulation-hour coordinate used by movements, invoices, staffing, capabilities, and finance.
2. `state.clock.displayAnchorMs` + `state.clock.displayTimeZone` convert that simulation coordinate into a human wall-clock display.

When an existing or new career first receives the v3 clock fields, Atlas Harbor anchors the current simulation hour to the device's current local date/time. If the player begins on Tuesday at 19:25, the current Network Time displays Tuesday 19:25. The IANA timezone is then persisted in `state.clock.displayTimeZone`. Moving to another timezone/device does not silently reinterpret the career clock.

The accelerated simulation rule remains **15 real minutes = 1 game hour at 1×**. Startup catch-up visually replays from an earlier simulation hour to the saved authoritative hour, and both ends are formatted through the career's persisted wall-clock anchor.

## Opening premise

Do not reintroduce language such as “win the first customer.” The player already has customers. The correct mental model is: **you have taken over an operating network and inherited its commitments**.

## Mobile information hierarchy

On mobile, the live map is ordered before the customer-promise list inside the main game shell. The map is the primary command surface; customer promises and the deeper operating dashboard follow it.

## Clickability rule

Anything that looks like an operating object should provide either context or an action. This includes customer promises, controlled movements, map vehicles, facilities, finance rows, people, competitors, events, requests, capabilities, and top-level metrics.

Map-object clicks must bring their existing action/detail surface into the foreground. The player should never need to hunt below the map to discover what a truck or facility click did.

Delegated worldwide traffic remains visible as context but is visually softer than the player's controlled operating objects. Selecting delegated traffic should still explain the carrier/desk handling it and the available management controls.

## Receivables as gameplay

A/R is not a static report. Open invoices may be contacted through **Contact about payment**. This creates a timed `finance.followUps` record inside the same career object. Follow-ups resolve on Network Time and may:

- produce an early payment,
- pull expected payment forward,
- or receive no commitment.

Open invoices also receive one deterministic early-payment check per game day. The model intentionally makes early payment possible but uncommon.

Finance wording uses “Due within N days” rather than implying every invoice settles exactly N days from now.

Pending receivable follow-ups surface in the Manager Command Queue, keeping finance work connected to the main operating loop.

## Persistence

No new database or browser store is introduced. Wall-clock anchor, timezone, finance follow-ups, invoice outcomes, and related interaction state remain inside the existing logistics career object and therefore use the existing offline + account synchronization path.

# Finance and working capital mechanics

The logistics game models an operating 3PL, so revenue, cash, receivables and payables are deliberately different things.

## One persisted career

Finance is stored inside the existing game object under `state.finance`. It is not a second database or a second local save.

The same career continues to use:

```text
localStorage["atlas-game-state"]
user_metadata.atlas_problem_spaces.logistics_game.progress
```

The local representation provides offline play. The signed-in account representation provides cross-device continuity. Existing `progress-v2.js` newest-copy-wins logic applies to finance, time, management, contracts and physical movements together.

## Balance-sheet strip

The main game header shows:

- **Cash** — settled funds currently available,
- **A/R** — open customer invoices,
- **A/P** — open vendor, payroll, fuel and lease obligations.

Cash, A/R and A/P are clickable and open the working-capital console.

## Accounting event rules

### Customer delivery

A completed customer contract creates an invoice:

```text
Accounts Receivable += invoice amount
Cash                += 0
```

Normal customer terms are **Net 30** in the simulation.

When the customer pays:

```text
Cash                += collected amount
Accounts Receivable -= settled invoice balance
```

This replaces the older game behavior where delivery immediately increased cash.

### Carrier / transportation commitment

A newly released transportation move creates an operating payable rather than instantly disappearing from cash:

```text
Accounts Payable += carrier / linehaul amount
Cash             += 0
```

Modeled carrier linehaul generally uses **Net 14**.

When due, the payable settles from Cash if sufficient cash is available. If not, the bill becomes overdue and remains visible.

### Truck diesel

Road diesel is a separate payable from linehaul.

The current truck assumption is:

```text
fuel litres = representative route kilometres × 0.34 L/km
fuel cost   = fuel litres × regional diesel USD/litre
```

Modeled fuel-card terms are **Net 7**.

The 0.34 L/km assumption is a gameplay operating input. It is not a specification for every tractor, load, weather condition or duty cycle.

### Payroll

Department and driver salaries are annual commitments. Payroll accrues as game time advances and is collected into a modeled biweekly payroll payable.

The existing management runtime historically deducted labor continuously from Cash. The finance layer detects that legacy burn, restores the exact amount to Cash, and moves the same amount into A/P. This preserves the existing career balance while changing the accounting timing.

### Leases and recurring asset cost

Recurring equipment/lease cost accrues into monthly A/P. The same legacy-cash conversion is applied so the player is not charged twice.

Upfront actions such as placement fees, onboarding fees, severance, maintenance authorization or other explicitly immediate commitments can still affect Cash at approval time.

## Migration invariant

Adding finance to an existing career must not reset or arbitrarily restate existing cash.

On first finance initialization:

- previously delivered orders are marked as already processed,
- existing shipments are marked as already processed,
- existing global bookings/deliveries are marked as already processed,
- existing cash is preserved,
- an explicitly fictional opening A/R/A/P book is added so the company starts as a real operating business rather than an empty shell.

The opening balances are scenario setup, not reconstructed historical user transactions.

## Receivable timing and late payments

Every new invoice receives a deterministic payment behavior derived from its invoice ID. This makes reloading or using a different computer produce the same result.

- normal invoices pay around Net 30,
- **3%** of invoices are marked for a late-payment path,
- only a subset of those late invoices become disputes,
- non-disputed late payments normally resolve after an additional modeled delay.

The deterministic hash is used instead of `Math.random()` for financial outcomes that must remain stable across reloads.

## Collections and arbitration

A late invoice can receive a collection follow-up. This can shorten the modeled expected payment date.

A disputed invoice can enter arbitration. Arbitration has:

- a cash fee paid when initiated,
- a 7–21 game-day modeled resolution period,
- deterministic outcome probabilities:
  - 82% full modeled recovery,
  - 13% settlement at 70%,
  - 5% modeled loss.

The game does not present these probabilities as real legal statistics. They are scenario mechanics chosen to create a meaningful working-capital decision.

## Ledger

The finance ledger records each modeled business event with separate deltas for:

```text
Cash
Accounts Receivable
Accounts Payable
```

Examples include:

- customer invoice issued,
- customer collection,
- late/disputed status,
- arbitration fee and resolution,
- carrier bill created,
- road-diesel bill created,
- payroll accrued,
- lease expense accrued,
- payable settlement,
- fuel-source refresh.

Legacy conversion entries that only undo the old immediate-cash implementation are not presented as fake business cash flows.

## Balance calendar

The calendar records daily ending balances for Cash, A/R and A/P. It is intended to answer questions such as:

- Is growth generating cash or only receivables?
- Is A/P building faster than collections?
- Did a large collection materially change liquidity?
- Did payroll or a large carrier settlement create a cash trough?

Existing careers receive an explicitly labeled opening baseline. Future calendar points are created from the actual game ledger.

## Projection

The **Project** view currently supports 30, 60 and 90 game-day horizons.

The displayed cash bridge is intentionally explicit:

```text
Projected cash =
  Cash now
+ scheduled A/R collections within the horizon
+ already-booked global contract collections within the horizon
- current A/P due within the horizon
- future payroll for the horizon
- future recurring lease/fixed-asset cost
- modeled future fuel run-rate
```

The interface prints the numbers as an equation. The total is calculated from the same values shown in the bridge; there is no hidden balancing term.

This is a deterministic operating projection, not an AI forecast.

## Fuel data hierarchy

Atlas Harbor does not claim a single live global retail-diesel API exists for every market in the game.

The server endpoint is:

```text
GET /api/game/fuel-prices
```

Source policy:

1. **United States:** U.S. EIA weekly on-highway diesel. The EIA Open Data API can be used when `EIA_API_KEY` is configured. The API is free but requires registration for a key.
2. **United Kingdom:** public DESNZ weekly road-fuel CSV discovered from GOV.UK.
3. **European Union:** the European Commission Weekly Oil Bulletin is the preferred official reference. Until a stable machine-readable country adapter is configured, the Netherlands row remains an explicitly labeled scenario baseline.
4. **China, South Korea, Japan, Australia, UAE, India, Kenya, Indonesia and Colombia:** explicit gameplay baselines until an appropriate official/stable adapter is configured.

Every returned country row contains a `quality` field such as:

```text
official-live
official-fallback
scenario-baseline
```

The game shows that status to the player.

Road diesel is used only for truck fuel. It is **not** substituted for marine bunker fuel or aviation fuel; ocean and air remain inside their modeled carrier buy rates.

## Current official fallback anchors

As of the implementation date:

- U.S. EIA on-highway diesel for week ending August 3, 2026: **$5.348/gal**, versus **$5.313/gal** the prior week.
- UK DESNZ diesel for August 3, 2026: **179.19 pence/litre**, versus **173.97 pence/litre** the prior week.

These values are stored as dated fallbacks so offline play still has a coherent cost input. When an official live adapter succeeds, the returned live row replaces the fallback in the saved career.

## Startup replay

The 18-second startup network replay also drives the header working-capital visualization. During replay, displayed Cash/A/R/A/P interpolate from the nearest saved historical balance to the authoritative current balance.

This is visual replay only:

- persisted finance state is not rewound,
- invoices are not re-created,
- bills are not paid twice,
- the final values always return to authoritative current balances.

## Hard invariants

1. Delivery must not create both immediate cash and A/R.
2. A transportation commitment must not create both an immediate legacy cash charge and the same A/P charge.
3. Payroll/lease legacy cash burn must be reversed before the matching A/P accrual is added.
4. Settled A/R reduces A/R by exactly the invoice balance and increases Cash only by the recovered amount.
5. Settled A/P reduces A/P and Cash by the same amount.
6. Financial outcomes that must survive reloads use deterministic IDs/hashes, not fresh randomness.
7. Finance remains inside the synchronized game career.
8. Offline fuel fallbacks must stay labeled; scenario values must never be displayed as official live prices.
9. Projection totals must equal the visible projection equation.
10. The map, money replay, finance settlement and staffing/capacity pipelines all use the same authoritative network time.

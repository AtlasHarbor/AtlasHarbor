# Atlas Harbor Logistics Game

`/game` is a global, exception-driven 3PL management simulation. The player is the **General Manager & Lead Dispatcher**: protect customer promises, stay solvent, build a resilient global network, and personally handle exceptions while routine work remains delegated.

The first exception is U.S.-based for onboarding, but the company is worldwide from the start. The main map includes manufacturing, ports, airports, distribution centers, trucks, vessels, and air cargo across North America, Latin America, Europe, the Middle East, Africa, South Asia, East Asia, Southeast Asia, and Australia.

The browser manual is `/game/docs`.

Detailed mechanics:

- [`TIME_AND_MOVEMENT.md`](./TIME_AND_MOVEMENT.md) — authoritative game time, startup replay, route speed and vehicle positioning.
- [`FINANCE_AND_WORKING_CAPITAL.md`](./FINANCE_AND_WORKING_CAPITAL.md) — Cash, A/R, A/P, payroll, fuel, collections, ledger, history and projections.
- [`COMMAND_CENTER.md`](./COMMAND_CENTER.md) — contract decision portal, manual route planning and management workflow.

## Player objective

The persistent objective is:

> **Protect promises. Stay solvent. Build the most resilient global 3PL.**

The game should make the player think like both an operator and a manager. Time, service, capacity, people and money are connected systems.

## Decision workflow

Tapping a customer contract opens a Dispatch Decision Portal showing:

- true origin,
- where the freight is now,
- destination,
- customer promise clock,
- current exception/risk,
- the control-tower recommendation,
- alternatives and their tradeoffs,
- a manual From / Via / Destination / Mode route planner.

The recommendation is not decorative. Existing base-game actions such as truck, rail, air, production recovery, expedite, carrier/driver coordination and customer updates remain the underlying operating actions.

## Departments and staffing

The company has four operating departments:

1. Dispatch & Capacity — Diego Ramos
2. Production Control — Nia Brooks
3. Customer Operations — Maya Chen
4. Global Trade Desk — Amina Hassan

Department cards show active headcount, pending hires, payroll, next-hire salary, agency fee, lead time, operating policy and queue.

Hiring is a requisition, not an instant increment:

- modeled staffing-agency placement fee: **20% of first-year salary**,
- onboarding/equipment cost,
- role-specific lead time,
- active headcount changes only when the start time is reached.

Drivers use the same delayed hiring principle.

## Capacity model

Fleet/capacity is intentionally separated into:

- **Owned**
- **Leased**
- **Contracted/on hand**
- **Partner accessible**

Partner-accessible capacity is not controlled inventory. Procurement and carrier contracting use a Review Commitment surface with upfront cost, recurring cost where applicable, lead time and before/after capacity.

## Working capital

The main metric strip shows **Cash, A/R and A/P** together.

Core rule:

```text
Delivery -> A/R
Customer settlement -> Cash
Carrier / fuel / payroll / lease obligation -> A/P
Vendor settlement -> Cash out
```

Normal customer terms are modeled at Net 30. A deterministic 3% of new invoices enter a late-payment path. Some late invoices become disputes, where the player can review collections/arbitration actions. Payables have their own schedules, including modeled biweekly payroll, monthly lease/fixed cost, carrier linehaul and road diesel.

The finance console includes:

- Overview
- A/R
- A/P
- Ledger
- Calendar
- Fuel
- 30/60/90-day Project view

See `FINANCE_AND_WORKING_CAPITAL.md` for the exact reconciliation rules and projection equation.

## Fuel cost model

Road-diesel inputs are regional and source-labeled. Atlas Harbor uses official public sources where practical and explicit scenario baselines elsewhere.

- U.S.: EIA weekly on-highway diesel; optional free `EIA_API_KEY` enables the official API adapter.
- U.K.: public DESNZ weekly road-fuel CSV.
- EU: European Commission Weekly Oil Bulletin is the preferred official reference; the Netherlands remains a labeled scenario baseline until a stable adapter is configured.
- Other game countries remain labeled scenario baselines rather than pretending to be live.

Truck fuel is modeled as:

```text
representative route km × 0.34 L/km × regional diesel USD/L
```

Road diesel does not substitute for marine bunker or aviation fuel.

## Authoritative time

There is one simulation clock.

At **1×, 15 real minutes = 1 game hour**. Players can also use 2× and 4× or Pause.

The clock state is persisted in the same career. Returning after time away reconciles elapsed time, and the first map load runs an approximately 18-second replay of the preceding operating window so the player can see ships, planes, trucks and working-capital balances move toward the authoritative current state.

After the replay:

- live marker position comes from game time,
- finance settlement comes from game time,
- staffing/procurement lead times come from game time,
- pause freezes network progression,
- 1×/2×/4× change the same underlying clock.

## Global traffic

The loaded global runtime is `public/game-global-simulation-v2.js`.

Representative movement speeds are game assumptions:

- truck/drayage: 68 km/h,
- ocean: 35 km/h,
- air cargo: 820 km/h.

The opening network includes multiple aircraft, not a single demonstration plane, including Shanghai→Sydney, Incheon→Los Angeles, Narita→Amsterdam, Dubai→Nairobi and Nairobi→London, alongside ocean and drayage flows.

Clicking a global vehicle shows current game time, current leg, route progress, kilometers moved, kilometers remaining, modeled speed and distance moved in the last game hour.

## First-run onboarding

`game-onboarding-v2.js` supplies the current guided tour.

The walkthrough uses a dimmed overlay plus curved white SVG arrows pointing to the actual dashboard areas. It teaches:

1. overarching objective,
2. authoritative network time and speed,
3. customer promise/decision queue,
4. Cash / A/R / A/P,
5. live global map,
6. company/department controls,
7. how to restart the tour.

The seen version is stored inside:

```text
state.onboarding.dashboardTourVersion
```

Because onboarding state is inside the career, it works offline and syncs across devices for signed-in users.

## Persistence

The game intentionally supports offline play and account continuity:

```text
localStorage["atlas-game-state"]
user_metadata.atlas_problem_spaces.logistics_game.progress
```

`progress-v2.js` applies newest-copy-wins and account isolation. Finance, management, time, tutorial state and physical operations all live inside that same career object.

This is different from Atlas Harbor's analytical publishing workspaces, which have their own database-only rules.

## Performance invariants

1. No document-wide `MutationObserver` around Leaflet.
2. Do not rebuild the map on every vehicle update.
3. Vehicle pulses may communicate activity but may not add fake distance.
4. Live global vehicles may not use an independent animation clock.
5. The legacy base and command-center time intervals must not double-advance the career.
6. The management world map exists only while its tab is open.
7. Loaded custom browser modules must parse under `scripts/check-js.js`.

## Routing invariants

1. Trucks cannot connect different landmasses.
2. Rail cannot connect different landmasses.
3. Ocean movements must begin and end at ports.
4. Only ocean or air may bridge different landmasses.
5. Missing operating routes fail visibly rather than silently inventing impossible geometry.
6. Global maritime and air paths are representative simulation corridors, not AIS, flight tracking, carrier schedules or navigation.

## Test focus

Regression tests cover:

- global traffic and freeze guardrails,
- authoritative 1×/2×/4× time,
- startup replay,
- staffing agency / delayed hiring,
- owned/leased/contracted/partner capacity,
- confirmation surfaces,
- Cash/A/R/A/P accounting conversions,
- Net 30 and 3% late-payment behavior,
- payroll/lease A/P,
- fuel-source adapters and fallback labeling,
- projection arithmetic,
- versioned curved-arrow onboarding,
- local + account persistence.

## Primary files

```text
public/game.html
public/game-v3.js
public/game-time-authority.js
public/game-global-simulation-v2.js
public/game-management-v3.js
public/game-finance.js
public/game-onboarding-v2.js
public/progress-v2.js
src/game-routing.js
src/game-fuel.js
test/game-management.test.js
test/game-network-time.test.js
test/game-finance.test.js
test/game-fuel.test.js
test/game-onboarding-v2.test.js
```
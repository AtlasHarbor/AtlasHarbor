# Atlas Harbor Logistics Game

`/game` is a global, exception-driven 3PL management simulation. The player is the **General Manager & Lead Dispatcher**: clear customer orders, protect customer promises, stay solvent, build a resilient global network, and personally handle exceptions while routine work remains delegated.

The first exception is U.S.-based for onboarding, but the company is worldwide from the start. The main map includes manufacturing, ports, airports, distribution centers, trucks, vessels, and air cargo across North America, Latin America, Europe, the Middle East, Africa, South Asia, East Asia, Southeast Asia, and Australia.

The browser manual is `/game/docs`.

Detailed mechanics:

- [`TIME_AND_MOVEMENT.md`](./TIME_AND_MOVEMENT.md) — authoritative game time, startup replay, route speed and vehicle positioning.
- [`FINANCE_AND_WORKING_CAPITAL.md`](./FINANCE_AND_WORKING_CAPITAL.md) — Cash, A/R, A/P, payroll, fuel, collections, ledger, history and projections.
- [`COMMAND_CENTER.md`](./COMMAND_CENTER.md) — contract decision portal, manual route planning and management workflow.

## Player objective

The persistent objective is:

> **Fill customer orders. Protect promises. Stay solvent. Build the most resilient global 3PL.**

Operationally this means the player should keep the order queue moving, resolve exceptions before customer promises fail, avoid spending recovery money blindly, collect receivables, pay obligations, maintain enough capacity and staff, and preserve liquidity. The game should make the player think like both an operator and a manager. Time, service, capacity, people and money are connected systems.

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

On mobile, the Dispatch Decision Portal occupies the usable screen above the safe area rather than appearing as a low off-screen card. Its close button is always visible in the sticky header. A player may inspect a decision and close it without committing an action.

Base-game exception decisions receive the same rule: a visible top-right close button, a high mobile sheet position, and Escape support. Closing an exception sheet does **not** execute a choice.

The `decisions waiting` map counter and the top-level Alerts metric are navigation controls. Activating either opens the next unresolved exception/decision instead of behaving like passive text.

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

The clock state is persisted in the same career. Returning after time away reconciles elapsed time. The first map load runs an approximately **10-second synchronized replay** of the preceding operating window so the player can visibly watch ships, planes, trucks and working-capital balances move from the prior replay point to the authoritative current state.

`public/game-replay-controller.js` shortens the older 18-second visualization target to 10 seconds without changing the number of historical game hours represented. It also changes the replay event's duration before the finance listener consumes it, so the physical network and Cash/A/R/A/P animation finish together. Reduced-motion replays that are already shorter than 10 seconds are not lengthened.

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

`game-onboarding-v2.js` supplies the current versioned walkthrough; the stored walkthrough version is currently **3**.

The walkthrough uses a dimmed overlay, a dedicated white/orange spotlight rectangle, and curved white SVG arrows pointing to the actual dashboard areas. Dashboard targets themselves are **not** raised above the overlay; that older technique caused the highlighted element to cover the coachmark on mobile.

Every step now:

1. computes the target's document position,
2. scrolls the target into a usable part of the mobile viewport,
3. waits for the scroll to settle,
4. draws the spotlight, arrow and coachmark,
5. exposes Next, Exit tour and a top-right × close control.

Tapping the dark scrim or pressing Escape also exits. The initial welcome card has its own × close and can be dismissed by tapping outside it; dismissal enters the game without forcing a walkthrough.

The tour teaches:

1. the overarching objective — fill/clear orders, protect promises and stay solvent,
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

**This is intentionally different from Atlas Harbor analytical/publishing workspaces.** The logistics career has a local copy because offline play is a product requirement. Legal, Baseball analysis, Economics analysis and other publishing workspaces must never use this game persistence rule; their canonical editable analysis is database-only. See the root `README.md` and `docs/WORKSPACE_ARCHITECTURE.md` before changing any shared persistence behavior.

## Performance invariants

1. No document-wide `MutationObserver` around Leaflet.
2. Do not rebuild the map on every vehicle update.
3. Vehicle pulses may communicate activity but may not add fake distance.
4. Live global vehicles may not use an independent animation clock.
5. The legacy base and command-center time intervals must not double-advance the career.
6. The management world map exists only while its tab is open.
7. Loaded custom browser modules must parse under `scripts/check-js.js`.
8. Tour navigation may programmatically scroll, but it must not raise live dashboard elements above the walkthrough overlay.

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
- synchronized ~10-second startup replay,
- staffing agency / delayed hiring,
- owned/leased/contracted/partner capacity,
- confirmation surfaces,
- Cash/A/R/A/P accounting conversions,
- Net 30 and 3% late-payment behavior,
- payroll/lease A/P,
- fuel-source adapters and fallback labeling,
- projection arithmetic,
- versioned curved-arrow onboarding,
- mobile scroll/spotlight/close behavior,
- actionable decision counters,
- local + account persistence.

## Primary files

```text
public/game.html
public/game-v3.js
public/game-time-authority.js
public/game-replay-controller.js
public/game-global-simulation-v2.js
public/game-management-v3.js
public/game-finance.js
public/game-onboarding-v2.js
public/game-mobile-navigation.js
public/progress-v2.js
src/game-routing.js
src/game-fuel.js
test/game-management.test.js
test/game-network-time.test.js
test/game-finance.test.js
test/game-fuel.test.js
test/game-onboarding-v2.test.js
```

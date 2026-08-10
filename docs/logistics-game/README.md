# Atlas Harbor Logistics Game

The logistics game at `/game` is a global, exception-driven 3PL control-tower simulation. The player is the **General Manager & Lead Dispatcher**: you set policy, staff departments, build carrier relationships, control owned and contracted capacity, protect customer promises, and personally step into dispatch when a decision needs judgment.

The first operating chapter begins with a U.S. recovery incident so the player learns the controls quickly. The company itself is global from the start through the Global 3PL Control Tower.

The browser manual is available at `/game/docs`.

## Core player role

You are not meant to click every shipment forward. You manage the system.

- **General Manager:** cash, staffing, departmental policy, customer trust, upgrades, carrier relationships, contracted capacity, and expansion.
- **Lead Dispatcher:** exceptions, threatened promises, driver coordination, mode changes, expedites, recovery, and difficult capacity calls.
- **3PL network builder:** decide what to own, what to contract, which carriers to develop, which international lanes to pursue, and where reputation matters.

Routine work can be delegated. Unsafe, urgent, expensive, or ambiguous conditions escalate to the player.

## Department management

The green routine-operations indicator and **Manage departments** button both open the interactive control tower.

The starting departments are:

1. **Dispatch & Capacity — Diego Ramos**
   - releases safe loads,
   - checks available capacity and drivers,
   - manages routine transportation,
   - escalates breakdowns, shortages, and difficult routing decisions.
2. **Production Control — Nia Brooks**
   - manages inventory readiness,
   - packaging and quality,
   - production throughput,
   - handoffs into transportation.
3. **Customer Operations — Maya Chen**
   - sends routine customer updates,
   - watches promises,
   - protects relationships,
   - escalates material service risk.
4. **Global Trade Desk — Amina Hassan**
   - international documentation and handoffs,
   - customs readiness,
   - overseas partner coordination,
   - global moves and exceptions.

The player can change delegation, headcount, and operating policy. The first three department toggles map directly to the existing simulation automation flags, so the management screen changes what the game actually automates.

## Fleet and capacity inventory

Capacity is deliberately split into different economic choices:

- owned tractors,
- owned trailers,
- contracted truck capacity,
- contracted vessel/block-space capacity,
- contracted air capacity,
- potential carrier capacity that can be contracted later.

Owned equipment provides control but carries maintenance exposure. Contracted equipment provides flexibility but depends on partner availability, rate levels, and relationship quality.

The Fleet & Capacity tab shows status, base, capacity, condition where applicable, and assigned driver or provider. Preventive maintenance costs cash and temporarily removes an asset from service.

## Carrier relationship book

The Carrier Network tab is a playable relationship system rather than a static vendor list.

Each fictional carrier has supported modes, geographic markets, service reputation, relationship score, relative rate level, visible capacity, and a named commercial contact. The player can call a carrier for an availability response or spend cash to contract capacity.

## People, HR, and drivers

The People & HR tab separates leadership from the dispatchable driver pool. Drivers have operating region, endorsements/experience, reliability, available hours, morale, and current availability.

The player can offer a priority load to a driver. Acceptance is not guaranteed; reliability and morale influence the response. The recruiting pipeline lets the player spend cash to add drivers in Japan, India, Kenya, and Colombia, with more markets available as the game expands.

## Global network

The global planning network includes hubs in:

- United States — Los Angeles / Long Beach and Savannah,
- Colombia — Cartagena,
- Netherlands — Rotterdam,
- United Kingdom — Felixstowe,
- United Arab Emirates — Jebel Ali / Dubai,
- India — Nhava Sheva / Mumbai,
- Kenya — Mombasa,
- China — Shanghai and Shenzhen / Yantian,
- South Korea — Busan,
- Japan — Yokohama,
- Indonesia — Tanjung Priok / Jakarta,
- Australia — Sydney / Port Botany.

The world map is a commercial planning view. Its arcs show candidate or active lanes, not literal vessel tracks or carrier quotations. The existing operational routing rules still apply to actual movements.

Example global opportunities include China → U.S., Korea → Netherlands, UAE → India, Kenya → U.K., Japan → Australia, Indonesia → UAE, Colombia → U.S., and China → Australia air recovery.

Booking an international lane consumes capacity cost immediately. The contract then advances on game time and posts revenue/trust when its simulated service window completes.

## Game-term explainers

Operational jargon must not be unexplained UI chrome. The game injects an accessible **info icon** next to supported terms and actions, including Management by exception, Challenge lane, Smart Dispatch, Recovery Desk, Network Visibility, Customer promise, Expedite, Air recovery, Intermodal rail, Priority handling, and Facility utilization.

Clicking the icon explains what the term means and how the mechanic affects the game. The complete glossary is also available as a tab in the management console.

### “Challenge lane” specifically

**Challenge lane** is a commercial/network action, not a route edit. The player commits cash and effort against a competitor in a customer corridor. In the game it reduces visible rival strength and builds company experience/trust.

## Player walkthrough

A new career begins Monday at 08:00 with three movements in progress and one urgent exception.

1. **Take command.** Resolve the initial breakdown.
2. **Open Manage departments.** Inspect what Dispatch, Production, Customer Operations, and Global Trade are doing.
3. **Open the Global 3PL Control Tower.** Review carrier relationships, fleet inventory, drivers, and international opportunities.
4. **Choose what to own or contract.** Preserve cash or build more control.
5. **Use Next decision.** Routine work advances until judgment is required.
6. **Coordinate people.** Call carriers, offer loads to drivers, recruit, and maintain equipment.
7. **Protect customer promises.** Spend recovery money only when the service and relationship justify it.
8. **Grow globally.** Book international lanes and manage the resulting capital and service exposure.
9. **Continue later.** Device and signed-in account persistence restore the career, including the management layer.

## Persistence

The game still uses its existing game-progress model:

```text
localStorage["atlas-game-state"]
user_metadata.atlas_problem_spaces.logistics_game.progress
```

The new management state is stored inside the same game object under `management`. It is merged into `window.__atlasGameState` before cloud synchronization, so department, fleet, carrier, driver, and global-contract decisions travel with the signed-in game career.

This is game progress, not the publishing-workspace architecture used by Legal/Economics/Propositions.

## Route and percentage consistency

A movement can contain multiple legs, such as plant → packaging site → distribution center.

- **Current-leg progress** is distance completed on the active leg.
- **Overall progress** is cumulative routed distance completed across all legs divided by total routed distance.
- The marker is interpolated along the same geometry used for the percentages.
- Contract production/readiness progress is separate from vehicle journey progress.

## Hard routing invariants

The existing operating-map routing layer still enforces:

1. Trucks cannot connect different landmasses.
2. Rail cannot connect different landmasses.
3. Ocean movements must begin and end at ports.
4. Only ocean or air may bridge different landmasses.
5. Truck, rail, and ocean fallbacks do not invent straight-line substitutes when a configured route is missing.
6. An unconfigured route fails visibly instead of drawing an impossible mode path.

The global management map does not bypass these rules; it is explicitly a planning/opportunity visualization.

## Optimization problems represented

| Game decision | Operations structure | Current implementation |
|---|---|---|
| Road route | Shortest path | OSRM road routing with explicit fallbacks |
| Legal transport mode | Mode-constrained network path | Landmass and facility-type rules |
| Promise to protect | Weighted scheduling | Deadline, value, readiness, tolerance |
| Recovery spending | Capital allocation | Cash competes across recovery, staffing, capacity, and upgrades |
| Production | Capacity planning | Routine throughput plus rush decisions |
| Departments | Queue/policy design | Delegation, headcount, policy, escalation |
| Fleet strategy | Own vs. buy/contract | Owned road assets and contracted multimodal capacity |
| Carrier management | Supplier portfolio | Reputation, relationship, rate, capacity, contact actions |
| Driver staffing | Workforce allocation | Hours, reliability, morale, recruiting, load offers |
| Global opportunities | Network portfolio | Lane buy cost, revenue, carrier assignment, service time |
| Disruptions | Stochastic control | Exceptions change future outcomes |
| Multi-leg orders | Network flow | Required processing and transshipment nodes |

## Current limitations

1. Global management arcs are planning visualizations, not live AIS/flight or exact ocean routes.
2. Carrier names, customers, people, rates, reputation, and opportunities are fictional scenario data.
3. Rail corridors remain approximate.
4. Road routing depends on OSRM / OpenStreetMap.
5. Simulation speeds are compressed.
6. The game does not advance while closed.
7. Contracted capacity is represented at a management-inventory level rather than individual real-world vessel/tractor serials.
8. Driver load acceptance is a game mechanic, not a labor-market model.
9. Standard orders are not yet consolidated into a full capacitated VRP.
10. AI advice remains review-only.

## Test checklist

1. `/game` loads `game-management.js` and `game-management.css`.
2. Clicking the routine-departments indicator opens Departments.
3. Department toggles update the base game delegation object.
4. The management layer persists inside `atlas-game-state.management` and cloud game progress.
5. Fleet shows owned and contracted capacity separately.
6. Carrier cards expose reputation, relationship, capacity, call, and contract actions.
7. People & HR supports driver load offers and recruiting.
8. World Network includes every required international market above.
9. Booking a global lane consumes cash and creates an active move.
10. A completed global move posts revenue and trust after enough game hours.
11. “Challenge lane” and other jargon receives an info icon and explainer.
12. Existing operating-map routing constraints continue to pass.

## Source files

```text
public/game.html
public/game-v3.js
public/game-management.js
public/game-management.css
public/game-route-bootstrap.js
public/progress-v2.js
public/game-ai.js
public/game-docs.html
src/game-routing.js
test/game-management.test.js
test/game-routing-constraints.test.js
```

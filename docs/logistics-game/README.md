# Atlas Harbor Logistics Game

`/game` is a global, exception-driven 3PL control-tower simulation. The player is the **General Manager & Lead Dispatcher**: set policy, staff departments, manage owned and contracted capacity, develop carrier relationships, protect customer promises, and step into dispatch when judgment matters.

The first exception is a U.S. truck breakdown because it is easy to understand as onboarding. The company is **not** U.S.-only. The main map is a live worldwide supply chain from the start.

The browser manual is available at `/game/docs`.

## Core player role

You manage the system rather than clicking every shipment forward.

- **General Manager:** cash, staffing, policy, customer trust, upgrades, carrier relationships, capacity strategy, and expansion.
- **Lead Dispatcher:** exceptions, threatened promises, driver coordination, mode changes, expedites, recovery, and difficult capacity calls.
- **3PL network builder:** choose what to own, what to contract, which carriers to develop, which markets to cover, and which lanes to pursue.

Routine work belongs to departments. Unsafe, urgent, expensive, or ambiguous situations escalate to the player.

## Departments

The green routine-operations indicator and **Manage departments** button open the interactive control tower.

1. **Dispatch & Capacity — Diego Ramos** — safe releases, capacity, drivers, transportation exceptions.
2. **Production Control — Nia Brooks** — inventory readiness, packaging, quality, production, handoffs.
3. **Customer Operations — Maya Chen** — routine updates, customer promises, relationship risk.
4. **Global Trade Desk — Amina Hassan** — international handoffs, documentation, customs readiness, overseas partners, and global linehaul.

The player can change delegation, headcount, and operating policy. The first three department switches map to the base simulation automation flags.

## Live global supply-chain layer

The global map is not just a collection of blue opportunity dots. `public/game-global-simulation.js` adds a continuously moving multimodal network on top of the existing Leaflet operating map.

Facility types have operational meaning:

- 🏭 manufacturing or processing origin,
- ⚓ seaport,
- ✈️ air-cargo gateway,
- 🏬 distribution center.

Routine flows begin in different phases so the map immediately contains trucks, ships, and aircraft in multiple regions. A shipment changes icon as it changes mode.

Starting flows include:

- Shenzhen electronics campus → Yantian → Pacific ocean service → Los Angeles/Long Beach → Inland Empire DC,
- Busan mobility-components plant → Busan Port → Asian/Indian Ocean/Suez/European ocean corridor → Rotterdam → Venlo DC,
- Mumbai healthcare-packaging plant → Nhava Sheva → Arabian Sea → Jebel Ali → Dubai fulfillment,
- Nairobi coffee-processing cooperative → Mombasa → Gulf of Aden/Suez/Mediterranean → Felixstowe → Midlands DC,
- Yokohama precision-components plant → Port of Yokohama → western Pacific → Port Botany → Western Sydney DC,
- Jakarta furniture manufacturing → Tanjung Priok → Malacca/Indian Ocean → Jebel Ali → Dubai fulfillment,
- Cartagena packaging-materials plant → Cartagena Port → Caribbean/U.S. Southeast → Savannah → Atlanta DC,
- Shanghai medical-device factory → Pudong air cargo → great-circle air movement → Sydney air cargo → Western Sydney DC.

Clicking a moving 🚚, 🚢, or ✈️ opens shipment detail with customer, cargo, current leg, carrier, overall cycle progress, current-leg progress, and a link into the Global 3PL Control Tower.

The visual cycles are deliberately compressed so a player can see handoffs during a normal session. They represent ongoing routine network activity, not literal transit speed.

## Route realism boundary

The game distinguishes between operating geometry and representative global corridors.

- Existing U.S. truck operations use the Atlas Harbor road-routing layer and OSRM/OpenStreetMap where configured.
- Regional global truck/drayage legs stay on the relevant landmass and use representative regional waypoints.
- Ocean services use curated maritime corridors instead of straight port-to-port lines. Representative waypoints cover the Pacific, South China Sea, Malacca/Indian Ocean, Gulf of Aden, Suez, Mediterranean, English Channel, and Caribbean where appropriate.
- Air cargo uses great-circle geometry.
- Dateline-crossing paths are split for map rendering instead of drawing a line across the wrong side of the globe.

These paths are simulation geometry. They are not AIS tracks, flight tracking, carrier schedules, customs routes, quotations, or navigational instructions.

## Global network markets

The management network and live simulation cover markets including:

- United States — Los Angeles / Long Beach, Savannah, Inland Empire, Atlanta,
- Colombia — Cartagena,
- Netherlands — Rotterdam and Venlo,
- United Kingdom — Felixstowe and the Midlands,
- United Arab Emirates — Jebel Ali and Dubai,
- India — Mumbai and Nhava Sheva,
- Kenya — Nairobi and Mombasa,
- China — Shanghai, Pudong, Shenzhen, and Yantian,
- South Korea — Busan,
- Japan — Yokohama,
- Indonesia — Jakarta and Tanjung Priok,
- Australia — Sydney / Port Botany and Western Sydney.

**Fit global network** returns to the worldwide view. **Focus active chapter** zooms to the immediate U.S. exception. The U.S. chapter is an exception-management scene, not the geographic boundary of the company.

## Fleet, carriers, HR, and drivers

Capacity is split between owned assets and contracted capacity. Owned tractors and trailers create control and maintenance exposure. Contracted truck, vessel/block-space, and air capacity create flexibility and partner dependence.

Carrier relationships include service reputation, relationship strength, geographic markets, visible capacity, relative rate, and a commercial contact. The player can call carriers and contract additional capacity.

People & HR separates leadership from the dispatchable driver pool. Drivers have region, reliability, available hours, morale, and status. The player can offer priority loads and recruit additional drivers in markets including Japan, India, Kenya, and Colombia.

## Global opportunity management

The World Network tab provides bookable commercial opportunities such as China → U.S., Korea → Netherlands, UAE ↔ India, Kenya → U.K., Japan → Australia, Indonesia → UAE, Colombia → U.S., and China → Australia air recovery.

Booking a lane consumes buy cost, assigns a carrier, creates an active international contract, and later posts revenue/trust when enough game time passes.

The live routine network and bookable opportunities serve different purposes:

- **routine live flows** make the company feel like an operating worldwide 3PL even when the player is focused on one exception,
- **bookable opportunities** are capital and growth decisions the player actively chooses.

## Game-term explainers

Operational jargon must not be unexplained UI chrome. Info buttons explain terms such as Management by exception, Challenge lane, Smart Dispatch, Recovery Desk, Network Visibility, Customer promise, Expedite, Air recovery, Intermodal rail, Priority handling, and Facility utilization.

**Challenge lane** is a commercial action, not a route edit: spend effort and cash to compete for business in a corridor where a rival is strong.

## Performance and stability invariant

The first global-management implementation installed a document-wide `MutationObserver`. Leaflet constantly mutates marker and map DOM, so that observer repeatedly rescanned the whole game and could create a runaway CPU/render loop.

That runtime was removed. Hard rules:

1. Never observe `document.documentElement` or the full map subtree for game UI decoration.
2. Do not rebuild Leaflet layers on every marker animation tick.
3. The live global layer creates its facilities/routes once and only updates eight vehicle marker positions on a bounded ~850 ms interval.
4. Glossary decoration occurs only at initialization and explicit game render/state events.
5. The management World Network map exists only while its tab is open and is removed on close.
6. `public/game-management.js`, the retired observer-heavy runtime, must not return.
7. Tests must parse the loaded browser modules and reject a whole-document observer.

## Persistence

Game progress continues to use:

```text
localStorage["atlas-game-state"]
user_metadata.atlas_problem_spaces.logistics_game.progress
```

Management decisions live inside the same game object under `management` and sync with the signed-in career. The continuously animated routine global flows are scenario traffic rather than separate user records; booked opportunities remain persisted management state.

This game-progress storage is separate from the publishing-workspace architecture used by Legal, Economics, Propositions, and other analytical Problem Spaces.

## Operating routing invariants

The base operating layer continues to enforce:

1. Trucks cannot connect different landmasses.
2. Rail cannot connect different landmasses.
3. Ocean movements must begin and end at ports.
4. Only ocean or air may bridge different landmasses.
5. Truck, rail, and ocean fallbacks do not invent impossible straight-line mode paths when an operating route is missing.
6. An unconfigured operating route fails visibly rather than silently drawing an impossible path.

The representative global visualization does not change those operating constraints.

## Optimization structures represented

| Game decision | Operations structure | Current implementation |
|---|---|---|
| Road route | Shortest path | OSRM road routing with explicit operating fallbacks |
| Global supply chain | Multimodal network path | Factory → gateway → international linehaul → destination distribution |
| Mode choice | Constrained network path | Cost, speed, facility type, landmass feasibility |
| Promise to protect | Weighted scheduling | Deadline, value, readiness, tolerance |
| Recovery spending | Capital allocation | Cash across recovery, staffing, capacity, upgrades |
| Production | Capacity planning | Routine throughput plus rush decisions |
| Departments | Queue/policy design | Delegation, headcount, policy, escalation |
| Fleet strategy | Own vs. contract | Owned road assets and contracted multimodal capacity |
| Carrier management | Supplier portfolio | Reputation, relationship, rate, capacity, contact actions |
| Driver staffing | Workforce allocation | Hours, reliability, morale, recruiting, load offers |
| Global opportunities | Network portfolio | Lane buy cost, revenue, carrier assignment, service time |
| Disruptions | Stochastic control | Exceptions change future outcomes |

## Current limitations

1. Global moving routes are representative game corridors, not live AIS/flight data.
2. Customer, carrier, employee, competitor, facility, rate, reputation, and opportunity data are fictional scenario data.
3. Global local-road geometry is representative rather than turn-by-turn routing.
4. Rail corridors remain approximate.
5. Road routing in the operating chapter depends on OSRM/OpenStreetMap.
6. Simulation speeds are compressed.
7. The decision simulation does not advance while closed.
8. Contracted capacity is represented at a management-inventory level rather than real-world serials.
9. Driver load acceptance is a game mechanic, not a labor-market model.
10. AI advice remains review-only.

## Test checklist

1. `/game` loads `game-map-bridge.js`, `game-management-v2.js`, `game-global-simulation.js`, and their styles.
2. The retired `game-management.js` runtime is not loaded.
3. All loaded custom game modules parse as JavaScript.
4. No loaded global-management module contains a document-wide `MutationObserver`.
5. The main map opens globally and exposes a Focus active chapter control.
6. The live layer includes factories, ports/airports, and distribution centers.
7. At least truck, ocean vessel, and air-cargo vehicle markers move on the main map.
8. International maritime routes contain curated intermediate waypoints rather than one straight segment.
9. Dateline handling remains explicit.
10. Clicking a global vehicle opens shipment detail and access to the control tower.
11. Department toggles update base-game delegation.
12. Fleet, carrier, HR, driver, and opportunity mechanics remain playable.
13. Existing operating routing constraints continue to pass.

## Source files

```text
public/game.html
public/game-v3.js
public/game-map-bridge.js
public/game-management-v2.js
public/game-management.css
public/game-global-simulation.js
public/game-global-simulation.css
public/game-route-bootstrap.js
public/progress-v2.js
public/game-ai.js
public/game-docs.html
src/game-routing.js
test/game-management.test.js
test/game-routing-constraints.test.js
```

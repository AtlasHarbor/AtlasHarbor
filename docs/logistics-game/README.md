# Atlas Harbor Logistics Game

`/game` is a global, exception-driven 3PL control-tower simulation. The player is the **General Manager & Lead Dispatcher**: set policy, staff departments, manage owned, leased, contracted, and partner-accessible capacity, develop carrier relationships, protect customer promises, and step into dispatch when judgment matters.

The first exception is a U.S. truck breakdown because it is easy to understand as onboarding. The company is **not** U.S.-only. The main map is a live worldwide supply chain from the start.

The browser manual is available at `/game/docs`.

## Core player role

You manage a company rather than clicking every shipment forward.

- **General Manager:** cash, payroll, staffing, policy, customer trust, upgrades, carrier relationships, procurement, capacity strategy, and expansion.
- **Lead Dispatcher:** exceptions, threatened promises, driver coordination, mode changes, expedites, recovery, and difficult capacity calls.
- **3PL network builder:** choose what to own, what to lease, what to contract, which partner capacity to activate, which carriers to develop, and which lanes to pursue.

Routine work belongs to departments. Unsafe, urgent, expensive, or ambiguous situations escalate to the player.

## Management economics invariant

Management actions are commitments, not magic buttons.

1. **No instant hiring.** Clicking Request 1 hire creates a staffing-agency requisition. The department headcount does not increase until the lead time finishes.
2. **Agency hiring costs money.** Atlas Harbor models a standard staffing-agency placement fee of **20% of first-year salary**, plus onboarding/equipment cost. The fee is charged when the requisition is approved.
3. **People remain a recurring cost.** Department staff and drivers contribute to annual payroll and monthly payroll. Labor cost accrues as game time advances.
4. **Capacity has access models.** The control tower distinguishes **Owned**, **Leased**, **Contracted/on-hand**, and **Partner accessible** capacity.
5. **Partner accessible is not inventory.** Carrier capacity remains only potential access until the player reviews and confirms a contract.
6. **Leases create recurring cost.** Lower upfront cash does not mean free capacity; monthly lease commitments remain visible and accrue with game time.
7. **Procurement has lead time.** Purchased, leased, and contracted capacity enters a pending pipeline and becomes usable only when its availability time arrives.
8. **Important actions require review.** Staffing, reductions, delegation changes, policy changes, maintenance, equipment procurement, carrier capacity contracts, driver hires, driver load offers, and lane bookings all show a confirmation/review surface before execution.
9. **Review must show consequences.** Financial reviews show current cash, upfront commitment, cash after confirmation, recurring payroll or lease cost when relevant, lead time, and the before/after inventory or headcount.

The purpose is to make the player think like a manager: cash today, recurring overhead tomorrow, and capacity availability later are different decisions.

## Departments

The green routine-operations indicator and **Manage departments** button open the interactive control tower.

1. **Dispatch & Capacity — Diego Ramos** — safe releases, capacity, drivers, transportation exceptions.
2. **Production Control — Nia Brooks** — inventory readiness, packaging, quality, production, handoffs.
3. **Customer Operations — Maya Chen** — routine updates, customer promises, relationship risk.
4. **Global Trade Desk — Amina Hassan** — international handoffs, documentation, customs readiness, overseas partners, and global linehaul.

Each department card shows, without requiring another click:

- active people,
- pending staffing-agency hires,
- department annual payroll,
- salary for the next modeled hire,
- agency fee rate,
- expected hiring lead time,
- operating policy and routine-work queue.

The player can change delegation and operating policy, but both are reviewed before taking effect. Reducing a position includes a severance cost and confirmation.

### Staffing model

Current modeled role economics are scenario values rather than wage-market claims:

- Dispatch & Capacity: $82,000 annual salary per modeled position,
- Production Control: $76,000,
- Customer Operations: $70,000,
- Global Trade: $96,000.

A staffing-agency requisition adds a 20% first-year placement fee plus onboarding cost. Lead times range from roughly 12 to 21 game days depending on role. Approved hires remain in `management.staffingPipeline` until their start time.

Drivers use the same principle. Candidate approval starts an onboarding/notice-period pipeline; the driver is not dispatchable immediately.

## Budget and recurring cost

The management console displays:

- current cash,
- annual people budget,
- monthly people payroll,
- monthly asset commitments,
- pending staffing and capacity requisitions.

As game time advances, the management runtime accrues labor and recurring lease/asset overhead against company cash. This prevents payroll and leases from being purely decorative UI numbers.

## Fleet and capacity access

The Fleet & Capacity tab separates four concepts:

- **Owned:** Atlas Harbor controls the asset and carries maintenance exposure.
- **Leased:** Atlas Harbor controls the asset during the lease and carries recurring monthly cost.
- **Contracted/on hand:** capacity has been commercially committed and is available to operations, such as truck flex blocks, ocean FEU blocks, or air pallets.
- **Partner accessible:** a carrier says capacity may be available. It is not controlled until a contract is approved.

The at-a-glance matrix reports these categories separately for:

- trucks,
- trailers,
- ocean capacity in FEU,
- air capacity in pallets.

The procurement catalog includes representative choices such as purchasing or leasing tractors, leasing trailers, contracting truck blocks, contracting ocean FEU, and contracting air pallets. Every acquisition has an upfront cost, availability lead time, and recurring cost where applicable.

## Carrier network

Carrier cards show service reputation, relationship strength, markets, commercial contact, and partner-accessible capacity by mode. Calling a carrier is an information/relationship action. Contracting capacity opens a review showing how much partner access will become committed inventory, cash impact, and expected availability.

Carrier names and values are fictional scenario data.

## Live global supply-chain layer

`public/game-global-simulation.js` adds continuously moving multimodal traffic to the main Leaflet operating map.

Facility types have operational meaning:

- 🏭 manufacturing or processing origin,
- ⚓ seaport,
- ✈️ air-cargo gateway,
- 🏬 distribution center.

Routine flows begin in different phases so the map immediately contains trucks, ships, and aircraft in multiple regions. A shipment changes icon as it changes mode.

Starting flows include Shenzhen → Yantian → Los Angeles → Inland Empire, Busan → Rotterdam → Venlo, Mumbai → Jebel Ali → Dubai, Nairobi → Mombasa → Felixstowe → Midlands, Yokohama → Sydney, Jakarta → Dubai, Cartagena → Savannah → Atlanta, and Shanghai air cargo → Sydney.

Clicking a moving 🚚, 🚢, or ✈️ opens shipment detail with customer, cargo, current leg, carrier, overall cycle progress, current-leg progress, and access to the Global 3PL Control Tower.

## Route realism boundary

- Existing U.S. truck operations use Atlas Harbor routing and OSRM/OpenStreetMap where configured.
- Regional global drayage stays on the relevant landmass and uses representative waypoints.
- Ocean services use curated maritime corridors rather than one straight segment.
- Air cargo uses great-circle geometry.
- Dateline-crossing paths are handled explicitly.

These paths are simulation geometry, not AIS tracks, carrier schedules, quotations, or navigational instructions.

## Global markets

The management network and live simulation cover the United States, Colombia, Netherlands, United Kingdom, United Arab Emirates, India, Kenya, China, South Korea, Japan, Indonesia, and Australia.

**Fit global network** returns to the worldwide view. **Focus active chapter** zooms to the immediate U.S. exception. The U.S. chapter is an exception-management scene, not the geographic boundary of the company.

## Global opportunity management

Bookable commercial opportunities span China → U.S., Korea → Netherlands, UAE ↔ India, Kenya → U.K., Japan → Australia, Indonesia → UAE, Colombia → U.S., and China → Australia air recovery.

Lane booking is no longer a one-click cash event. The review surface shows carrier, buy cost, revenue if delivered, expected gross spread before overhead, risk, current cash, cash after confirmation, and service time. Revenue posts only after simulated delivery.

## Game-term explainers

Operational jargon should not be unexplained UI chrome. Info buttons explain terms such as Management by exception, Challenge lane, Partner access, Lease, and Staffing agency.

**Challenge lane** is a commercial action, not a physical route edit.

## Performance and stability invariant

The first global-management implementation installed a document-wide `MutationObserver`. Leaflet constantly mutates marker and map DOM, so that observer repeatedly rescanned the whole game and could create a runaway CPU/render loop.

Hard rules:

1. Never observe `document.documentElement` or the full map subtree for game UI decoration.
2. Do not rebuild Leaflet layers on every marker animation tick.
3. The live global layer creates facilities/routes once and only updates vehicle marker positions on a bounded interval.
4. Glossary decoration occurs only at initialization and explicit game render/state events.
5. The World Network map exists only while its management tab is open.
6. The retired `public/game-management.js` runtime must not return.
7. Tests parse loaded custom game modules and reject a whole-document observer.

## Persistence

Game progress uses:

```text
localStorage["atlas-game-state"]
user_metadata.atlas_problem_spaces.logistics_game.progress
```

Management state remains inside the same game object under `management`, including department counts, staffing pipeline, capacity pipeline, owned/leased/contracted inventory, carrier-access counts, recurring-cost timestamps, drivers, and booked global opportunities.

This game-progress model is separate from the publishing-workspace architecture used by Legal, Economics, Propositions, and other analytical Problem Spaces.

## Operating routing invariants

1. Trucks cannot connect different landmasses.
2. Rail cannot connect different landmasses.
3. Ocean movements must begin and end at ports.
4. Only ocean or air may bridge different landmasses.
5. Operating fallbacks do not invent impossible cross-mode paths.
6. Missing operating routes fail visibly rather than silently drawing impossible geometry.

## Current limitations

1. Global moving routes are representative game corridors, not live AIS/flight data.
2. Customer, carrier, employee, facility, salary, fee, rate, reputation, and opportunity values are fictional scenario data.
3. Global local-road geometry is representative rather than turn-by-turn routing.
4. Rail remains approximate.
5. Road routing in the operating chapter depends on OSRM/OpenStreetMap.
6. Simulation speeds and hiring/procurement timelines are compressed for gameplay.
7. The decision simulation does not advance while closed.
8. Driver acceptance and staffing-market behavior are game mechanics, not labor-market predictions.
9. AI advice remains review-only.

## Test checklist

1. `/game` loads `game-management-v3.js`, `game-management-v3.css`, and `game-global-simulation.js`.
2. Older management runtimes are not loaded.
3. Loaded custom modules parse as JavaScript.
4. No loaded management module contains a document-wide `MutationObserver`.
5. Department hiring uses a 20% staffing-agency fee and pending start time rather than instant headcount.
6. Department cards show active headcount, pending hires, payroll, salary, fee, and lead time.
7. Fleet cards distinguish owned, leased, contracted, and partner-accessible capacity.
8. Capacity procurement uses review, cost, recurring commitments, and lead time.
9. Financial and operational commitments use the shared review/confirmation surface.
10. Labor and recurring asset commitments accrue against cash as game time advances.
11. The global map continues showing moving truck, ocean, and air traffic.
12. Existing operating routing constraints continue to pass.

## Source files

```text
public/game.html
public/game-v3.js
public/game-map-bridge.js
public/game-management-v3.js
public/game-management.css
public/game-management-v3.css
public/game-global-simulation.js
public/game-global-simulation.css
public/progress-v2.js
public/game-docs.html
test/game-management.test.js
test/game-routing-constraints.test.js
```
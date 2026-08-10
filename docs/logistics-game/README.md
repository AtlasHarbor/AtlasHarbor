# Atlas Harbor Logistics Game

The logistics game at `/game` is a global, exception-driven 3PL control-tower simulation. The player is the **General Manager & Lead Dispatcher**: you set policy, staff departments, build carrier relationships, control owned and contracted capacity, protect customer promises, and personally step into dispatch when a decision needs judgment.

The first live operating chapter begins with a U.S. recovery incident so the player learns the controls quickly, but the main map now opens on the full global network. The U.S. routes are the active chapter; global hubs and lighter opportunity lanes show the wider commercial footprint.

The browser manual is available at `/game/docs`.

## Core player role

You manage the system rather than clicking every shipment forward.

- **General Manager:** cash, staffing, departmental policy, customer trust, upgrades, carrier relationships, contracted capacity, and expansion.
- **Lead Dispatcher:** exceptions, threatened promises, driver coordination, mode changes, expedites, recovery, and difficult capacity calls.
- **3PL network builder:** decide what to own, what to contract, which carriers to develop, which international lanes to pursue, and where reputation matters.

Routine work can be delegated. Unsafe, urgent, expensive, or ambiguous conditions escalate to the player.

## Department management

The green routine-operations indicator and **Manage departments** button both open the interactive control tower.

The starting departments are:

1. **Dispatch & Capacity — Diego Ramos** — safe releases, capacity, drivers, transportation exceptions.
2. **Production Control — Nia Brooks** — inventory readiness, packaging, quality, production, handoffs.
3. **Customer Operations — Maya Chen** — routine updates, promises, relationship risk.
4. **Global Trade Desk — Amina Hassan** — international handoffs, customs readiness, documentation, overseas partners.

The player can change delegation, headcount, and policy. The first three department switches map directly to the base simulation automation flags.

## Fleet, carriers, HR, and drivers

Capacity is deliberately split between owned assets and contracted capacity. Owned tractors and trailers create control and maintenance exposure; contracted truck, vessel/block-space, and air capacity create flexibility and partner dependence.

Carrier relationships include service reputation, relationship strength, geographic markets, visible capacity, rate level, and a commercial contact. The player can call carriers and contract additional capacity.

People & HR separates leadership from the dispatchable driver pool. Drivers have a region, reliability, available hours, morale, and current availability. The player can offer priority loads and recruit additional drivers in markets including Japan, India, Kenya, and Colombia.

## Global network

The planning network includes hubs in:

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

The **main game map opens globally** and overlays these commercial hubs and opportunity lanes on top of the active operating chapter. **Fit global network** returns to that full view. **Focus active chapter** zooms back to the current U.S. dispatch work. The control-tower World Network tab provides the detailed lane-booking view.

Planning arcs are not literal vessel tracks or carrier quotations. Existing operational routing rules still apply to actual truck, rail, air, and ocean movements.

Example opportunities include China → U.S., Korea → Netherlands, UAE → India, Kenya → U.K., Japan → Australia, Indonesia → UAE, Colombia → U.S., and China → Australia air recovery.

## Performance and stability invariant

The global management expansion originally installed a document-wide `MutationObserver` that rescanned headings, buttons, and other UI every time any child node changed. Leaflet continuously mutates DOM nodes for markers and map layers, so the observer could repeatedly scan the entire game while the map was updating. On some machines this created a runaway CPU/render loop and could freeze the browser or computer.

That runtime has been retired.

Hard rules:

1. **Do not observe `document.documentElement` or the whole game subtree for glossary/UI decoration.**
2. Glossary info icons are decorated only at initialization and after explicit Atlas Harbor game state/render events.
3. Management refreshes are batched with a short timer instead of responding to every DOM mutation.
4. The global planning overlay uses one dedicated Leaflet layer group; it is replaced as a unit instead of leaking map layers.
5. The main Leaflet map is exposed through `game-map-bridge.js` only so the global overlay can reuse the existing map rather than creating a second always-on map.
6. The separate World Network map is created only while that management tab is open and is removed when the dialog closes.
7. The retired `public/game-management.js` observer-heavy runtime must not be reintroduced.

Regression tests parse the stable browser modules and explicitly reject a whole-document `MutationObserver` in the loaded management runtime.

## Game-term explainers

Operational jargon should not be unexplained UI chrome. Accessible info buttons explain terms including Management by exception, Challenge lane, Smart Dispatch, Recovery Desk, Network Visibility, Customer promise, Expedite, Air recovery, Intermodal rail, Priority handling, and Facility utilization.

**Challenge lane** is a commercial action, not a physical reroute: the player spends cash and effort to compete for business in a corridor where a rival is strong.

## Player walkthrough

1. **Take command.** Resolve the initial U.S. breakdown.
2. **Look at the global map.** See the active U.S. chapter in the context of the wider 3PL network.
3. **Open Manage departments.** Inspect Dispatch, Production, Customer Operations, and Global Trade.
4. **Review Fleet & Capacity.** Decide what to own and what to contract.
5. **Work the Carrier Network.** Call partners and reserve capacity.
6. **Manage People & HR.** Offer loads and recruit where the network needs coverage.
7. **Use Next decision.** Routine work advances until judgment is required.
8. **Book global opportunities.** Take international lanes when the cash, service, and carrier relationship make sense.
9. **Protect customer promises.** Spend recovery money selectively.

## Persistence

The game uses its existing progress model:

```text
localStorage["atlas-game-state"]
user_metadata.atlas_problem_spaces.logistics_game.progress
```

Management state is stored inside the same game object under `management`, so department, fleet, carrier, driver, and global-contract decisions travel with the signed-in game career.

This game-progress storage is separate from the publishing-workspace architecture used by Legal, Economics, Propositions, and other analytical Problem Spaces.

## Routing invariants

The operating routing layer continues to enforce:

1. Trucks cannot connect different landmasses.
2. Rail cannot connect different landmasses.
3. Ocean movements must begin and end at ports.
4. Only ocean or air may bridge different landmasses.
5. Truck, rail, and ocean fallbacks do not invent straight-line substitutes when a configured route is missing.
6. An unconfigured route fails visibly instead of drawing an impossible mode path.

The global planning overlay does not bypass those rules.

## Optimization structures represented

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

1. Global planning arcs are not live AIS/flight paths or exact ocean routes.
2. Carrier names, customers, people, rates, reputation, and opportunities are fictional scenario data.
3. Rail corridors remain approximate.
4. Road routing depends on OSRM/OpenStreetMap.
5. Simulation speeds are compressed.
6. The game does not advance while closed.
7. Contracted capacity is represented at a management-inventory level rather than individual real-world serials.
8. Driver load acceptance is a game mechanic, not a labor-market model.
9. Standard orders are not yet consolidated into a full capacitated VRP.
10. AI advice remains review-only.

## Test checklist

1. `/game` loads `game-map-bridge.js`, `game-management-v2.js`, and `game-management.css`.
2. The retired `game-management.js` runtime is not loaded.
3. The stable management module parses as JavaScript and contains no document-wide `MutationObserver`.
4. The main map opens on the global network and exposes a Focus active chapter control.
5. Clicking the routine-departments indicator opens Departments.
6. Department toggles update base-game delegation.
7. Management persists inside `atlas-game-state.management` and signed-in account game progress.
8. Fleet shows owned and contracted capacity separately.
9. Carrier cards expose reputation, relationship, call, and contract actions.
10. People & HR supports driver load offers and recruiting.
11. World Network includes every required international market above.
12. Booking a global lane consumes cash and creates an active move.
13. Completed global moves post revenue/trust after enough game hours.
14. “Challenge lane” and other jargon receive an info explainer.
15. Existing operating-map routing constraints continue to pass.

## Source files

```text
public/game.html
public/game-v3.js
public/game-map-bridge.js
public/game-management-v2.js
public/game-management.css
public/game-route-bootstrap.js
public/progress-v2.js
public/game-ai.js
public/game-docs.html
src/game-routing.js
test/game-management.test.js
test/game-routing-constraints.test.js
```

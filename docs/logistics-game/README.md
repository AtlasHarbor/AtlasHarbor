# Atlas Harbor Logistics Game

The logistics game is an exception-driven control-tower simulation at `/game`. Routine production, safe dispatches, and ordinary movement can be delegated. The player intervenes when cost, service, customer trust, capacity, routing, or risk creates a meaningful tradeoff.

The browser manual is available at `/game/docs`.

## Player walkthrough

A new career begins Monday at 08:00 with three movements in progress and one urgent exception.

1. **Take command.** A truck carrying a $420,000 holiday-toy contract has failed near Albuquerque.
2. **Choose a recovery.** Send a replacement truck, transfer critical cartons through the Memphis air hub, or wait for repair.
3. **Watch the routed network.** Truck markers follow roads. Rail, air, and ocean use mode-specific corridors.
4. **Use Next decision.** Routine hours advance until judgment is required.
5. **Review contracts.** Ready work can be dispatched by truck, rail, or air; shortages can be rushed; customer updates can protect trust.
6. **Set delegation.** Team & automation determines which routine operations are handled automatically.
7. **Grow the company.** Deliveries and decisions award experience; cash buys organizational upgrades.
8. **Continue later.** Device and signed-in account persistence restore the career.

## Route and percentage consistency

A movement can contain multiple legs, such as plant → packaging site → distribution center.

- **Current-leg progress** is distance completed on the active leg.
- **Overall progress** is cumulative routed distance completed across all legs divided by total routed distance.
- The marker is interpolated along the same geometry used for the percentages.
- Contract production/readiness progress is separate from vehicle journey progress.

This prevents a card from reporting 75% while the marker visually appears only 20% through a different route representation.

## Hard routing invariants

Every known location in `src/game-routing.js` declares:

- a facility `kind`, such as port, airport, or land facility,
- a `landmass` identifier.

The routing layer enforces these rules before returning geometry:

1. Trucks cannot connect different landmasses.
2. Rail cannot connect different landmasses.
3. Ocean movements must begin and end at ports.
4. Only ocean or air may bridge different landmasses.
5. Truck, rail, and ocean fallbacks do not substitute a straight line when a verified route or curated corridor is missing.
6. An unconfigured route fails visibly instead of drawing a boat over land or a truck across water.

These are server-side constraints, not merely visual conventions.

## Route geometry

### Truck

Truck routes request full GeoJSON geometry from OSRM using OpenStreetMap road data. Results are cached. If OSRM is unavailable, only a configured multi-point road corridor may be used; the system does not invent a direct line.

### Rail

Rail uses curated intermodal corridors through major rail hubs. They are operational corridors, not exact track-level geometry. If no corridor exists, the route fails rather than drawing an air-style arc.

### Air

Air uses curved point-to-point flight arcs. Air may connect different landmasses.

### Ocean

Ocean uses curated water corridors between ports. HarborPeak travels between Los Angeles and Savannah through the Pacific, Panama/Central American corridor, Caribbean, and Atlantic approach rather than across the continental United States.

A future international location must declare its landmass and port/airport type before it can participate in route generation.

### Routing endpoints

```text
GET  /api/game/routes/:mode/:from/:to
POST /api/game/optimize
```

Supported modes are `truck`, `rail`, `air`, and `ocean`.

The optimization endpoint validates every leg against the same mode and landmass rules. It cannot optimize an illegal road journey across an ocean.

## Simulation time and ETA

Distance comes from the displayed route. Simulation duration is distance divided by a compressed game speed for that mode. It is scenario time, not a carrier quote.

## Persistence

### Immediate device save

```text
localStorage["atlas-game-state"]
```

### Signed-in account save

```text
user_metadata.atlas_problem_spaces.logistics_game.progress
```

No logistics-specific table must be installed. The client can import a legacy `game_progress` record when that optional table exists.

The saved state includes contracts, inventory, deadlines, routes, legs, progress, exceptions, cash, trust, service, staff morale, delegation, upgrades, experience, and simulation time.

The simulation does not advance while the page is closed.

## Optimization problems represented

| Game decision | Optimization structure | Current implementation |
|---|---|---|
| Truck route | Shortest path | OSRM road routing with explicit fallback corridors |
| Legal transport mode | Mode-constrained network path | Landmass and facility-type rules eliminate impossible modes |
| Truck, rail, air, or ocean | Multi-objective path choice | Cost, time, service, and route feasibility |
| Promise to protect | Weighted scheduling | Deadline, value, readiness, and customer tolerance |
| Recovery spending | Knapsack / capital allocation | Limited cash competes across expedites, capacity, and upgrades |
| Production | Capacity planning | Routine throughput with rush actions |
| Disruptions | Stochastic control | Incidents change state and future outcomes |
| Multi-leg orders | Network flow / transshipment | Plants, packaging, ports, hubs, and distribution centers |
| Stop ordering | TSP / vehicle routing | API support exists; ordinary contracts retain required stop order |
| Consolidated fleet | Capacitated VRP | Planned; a finite shared fleet is not yet implemented |

### Traveling-salesman clarification

Most current contracts have a required origin, optional processing stop, and destination. Reordering these would violate the process, so ordinary contracts are not full TSP instances.

A future consolidation scenario with several compatible customers, capacity, and time windows becomes a capacitated vehicle-routing problem.

## Connection to Food Discovery

The Food planner applies the same model at human scale:

- the confirmed group location is an origin,
- restaurants are destinations,
- road distance is travel cost,
- opening hours are time windows,
- dietary requirements and dislikes are compatibility constraints,
- diners are stakeholders with different objectives,
- freshness and allergy questions are operational uncertainty,
- the recommendation balances fairness and execution cost.

See [`../food/README.md`](../food/README.md).

## Known limitations

1. Rail routes are approximate corridors, not exact railway tracks.
2. OSRM is an external dependency.
3. Simulation speeds are compressed.
4. The game does not advance while closed.
5. Competitor share is narrative rather than a market simulation.
6. Vehicles do not yet draw from a finite shared tractor, driver, trailer, vessel, aircraft, or warehouse-door pool.
7. Orders cannot yet be consolidated onto one vehicle.
8. The priority recommendation is a transparent heuristic rather than an exact optimizer.
9. AI advice is review-only.
10. International ports and airports require explicit location metadata and corridors before use.

## Test checklist

1. `/api/game/routes/truck/anaheim-pack/dallas-dc` returns road geometry and positive distance.
2. `/api/game/routes/ocean/la-port/savannah-port` returns an ocean corridor.
3. `/api/game/routes/ocean/la-port/dallas-dc` returns a validation error.
4. A test point on another landmass cannot be connected by truck or rail.
5. Air and port-to-port ocean are the only modes permitted across landmasses.
6. Missing truck, rail, or ocean fallback corridors do not become straight lines.
7. A marker remains on its route as progress changes.
8. Overall progress remains monotonic across multiple legs.
9. HarborPeak remains on the ocean corridor.
10. Port incidents attach only to port-connected movements.
11. Signed-out and signed-in progress restore correctly.
12. Reset clears local and account progress after confirmation.

## Source files

```text
public/game.html
public/game-v3.js
public/game-route-bootstrap.js
public/progress-v2.js
public/game-ai.js
public/game-docs.html
src/game-routing.js
test/game-routing-constraints.test.js
```

# Atlas Harbor Logistics Game

The logistics game is an exception-driven control-tower simulation available at `/game`. The player is not expected to click through every routine task. Production, safe dispatches, and ordinary movement can be delegated; the player intervenes when cost, service, customer trust, capacity, or risk creates a meaningful tradeoff.

The browser manual is available at `/game/docs`.

## Player walkthrough

A new career begins at Monday 08:00 with three movements already in progress and one urgent exception.

1. **Take command.** A truck carrying a $420,000 holiday-toy contract has failed near Albuquerque with seven simulated hours remaining.
2. **Choose a recovery.** The player can send a replacement truck, transfer critical cartons through the Memphis air hub, or wait for roadside repair. Each choice changes cash, trust, service, and staff morale.
3. **Watch the routed network.** Truck markers move along road geometry. Rail, air, and ocean movements use mode-specific corridors. A marker’s position and displayed percentage are derived from the same path.
4. **Use Next decision.** The game advances through routine hours until another exception needs judgment. A real-time background tick also advances one simulated hour every 15 minutes while the page remains open and unpaused.
5. **Review contracts.** Ready work can be dispatched by truck, rail, or air. Production shortages can be rushed. Customer updates can protect trust.
6. **Set delegation.** Team & automation controls determine whether routine production, safe dispatch, and customer updates are delegated.
7. **Grow the company.** Deliveries and decisions award experience. Cash buys Smart Dispatch, Recovery Desk, Relationship Team, and Network Visibility upgrades.
8. **Continue later.** The career saves immediately on the device. Signed-in users also save to their Supabase account metadata and can resume on another browser.

## What the percentages mean

A movement can contain multiple legs, for example plant → packaging site → distribution center.

- **Current-leg progress** is the distance completed along the active leg.
- **Overall progress** is the cumulative routed distance completed across every leg divided by the total routed journey distance.
- The map marker is interpolated along the same route geometry used by the percentage calculation.
- The contract card adds production/readiness progress before transportation progress, so it is deliberately not the same number as the vehicle’s overall journey percentage.

This replaces the earlier implementation, which interpolated latitude and longitude along a straight line and displayed a separate abstract progress number. That mismatch made a vehicle appear 20% through a route while its card reported 75%.

## Route geometry

Routes are supplied by `src/game-routing.js`.

### Truck

Truck routes request full GeoJSON geometry from the OSRM route service using OpenStreetMap road data. Results are cached in the application process and in the browser. If the external route service is unavailable, Atlas Harbor uses a multi-point highway-corridor fallback rather than drawing a direct line.

### Rail

Rail movements use curated intermodal corridors through major rail hubs. These are intentionally described as **corridors**, not exact track-level routes. A future rail provider can replace this adapter without changing the game state format.

### Air

Air routes use curved point-to-point arcs. They do not pretend to follow roads.

### Ocean

Ocean competitors use water corridors between ports. HarborPeak now travels from Los Angeles to Savannah through an ocean path instead of drawing a ship across the continental United States to Dallas.

### Routing endpoints

```text
GET  /api/game/routes/:mode/:from/:to
POST /api/game/optimize
```

Supported route modes are `truck`, `rail`, `air`, and `ocean`.

`POST /api/game/optimize` accepts two to twelve known stop IDs. Truck optimization attempts the OSRM Trip service with a fixed first and last stop, then falls back to a nearest-neighbor sequence. It is available for future consolidation and vehicle-routing scenarios.

## Simulation time and ETA

The game uses compressed network speeds rather than claiming literal real-world transit times. Distance comes from the displayed path; simulation duration is distance divided by a mode-specific game speed.

This keeps the map internally consistent while allowing a cross-country decision to resolve in a playable number of turns. It should be interpreted as scenario time, not a carrier quote.

## Persistence

The game has two persistence layers.

### Immediate local save

Every meaningful change writes the complete state to:

```text
localStorage["atlas-game-state"]
```

This works for signed-out players and protects progress if account sync is temporarily unavailable.

### Signed-in account save

`public/progress-v2.js` stores the career under:

```text
user_metadata.atlas_problem_spaces.logistics_game.progress
```

No logistics-specific Supabase table needs to be installed. On first load, the client attempts to import an older save from `game_progress` when that legacy table exists, then writes the imported state to account metadata.

The save includes:

- contracts, inventory, deadlines, and values,
- shipment routes, modes, current legs, and progress,
- exceptions and event history,
- cash, trust, on-time service, experience, and level,
- staff morale and delegation settings,
- upgrades, deliveries, decisions, and simulation time.

The header reports whether progress is local, loaded from the account, synced, or waiting to retry.

The simulation does **not** advance while the page is closed. It resumes from the last saved simulated hour.

## Optimization problems represented

The game combines several operations-research structures.

| Game decision | Optimization structure | Current implementation |
|---|---|---|
| Truck route geometry | Shortest-path problem | OSRM road routing with cached fallback corridors |
| Truck, rail, or air choice | Multi-objective constrained path selection | Player trades cost against transit time and service risk |
| Which promise to protect | Weighted scheduling / priority dispatch | Deadlines, contract value, readiness, and customer tolerance drive risk and the recommendation tool |
| Spend cash on recovery or capacity | Knapsack / capital-allocation problem | Limited cash competes across expedites, production, capacity, and upgrades |
| Production completion | Capacity planning and scheduling | Production advances automatically; rush actions buy time at a cash and morale cost |
| Exceptions under uncertainty | Stochastic control / Markov decision process | Random incidents alter state; choices change future cash, trust, and service |
| Multi-leg movement | Network-flow and transshipment problem | Orders move through plants, packaging sites, ports, hubs, and distribution centers |
| Stop ordering | Traveling-salesman / vehicle-routing problem | The API can optimize stop order, but normal contracts currently have fixed origin and destination order |
| Competing contracts and modes | Vehicle-routing problem with time windows | Represented partially; the game does not yet maintain a finite shared fleet or combine several orders on one vehicle |

### Traveling salesman clarification

A full traveling-salesman problem asks for the shortest tour through a set of stops. Most current contracts have only an origin, an optional required processing stop, and a destination. Reordering those stops would violate the process, so calling the ordinary contract flow a TSP would be inaccurate.

The useful next step is a consolidation scenario where one truck serves several compatible customers under capacity and time-window constraints. That becomes a capacitated vehicle-routing problem, which is more representative of logistics than a pure TSP.

## Player-facing contradictions found and resolved

The August 2026 review found these inconsistencies:

- A breakdown was described as being outside Memphis even though the truck’s route did not pass Memphis. It now occurs near Albuquerque; Memphis remains an optional air-recovery hub.
- A competitor ship traveled over land from Savannah to Dallas. Its route is now an ocean corridor between Los Angeles and Savannah.
- Vehicle position used straight-line latitude/longitude interpolation while the percentage used unrelated abstract progress. Both now use cumulative routed distance.
- Port congestion could be generated for movements that did not touch a port. Port incidents are now restricted to port-connected legs.
- The old manual described a ten-day cycle, owned trucks, trailers, cold-chain slots, named providers, and Coastal/Express routes that the live game did not implement. The manual now describes the actual exception-driven hourly game.
- The AI advisor looked for a removed `.desk-panel` and never mounted. It now mounts in the Decision Support section and reads `window.__atlasGameState`.
- Cloud persistence assumed a `game_progress` table. Account metadata is now the primary signed-in store, with the table used only as an optional legacy import.

## Known limitations and planned work

1. Rail lines are approximate operational corridors, not exact railway geometry.
2. OSRM is an external road-routing dependency. Fallback corridors keep the game playable during an outage, but they are less precise.
3. Simulation time is compressed and should not be interpreted as a real carrier ETA.
4. The game does not advance while closed.
5. Competitor market share is a narrative score rather than a market simulation.
6. Vehicles do not yet draw from a finite shared tractor, driver, trailer, or warehouse-door pool.
7. Orders cannot yet be consolidated onto one vehicle, so capacitated VRP gameplay is incomplete.
8. The weighted priority recommendation is a transparent heuristic, not a mathematical optimizer.
9. AI advice is review-only and never executes an action.
10. Staff morale has direct event effects but does not yet cause absence, turnover, or skill degradation.

## Test checklist

Before declaring a game deployment healthy, verify:

1. `/api/game/routes/truck/anaheim-pack/dallas-dc` returns at least two coordinates and a positive distance.
2. `/api/game/routes/ocean/la-port/savannah-port` returns an ocean corridor.
3. A truck marker remains on its displayed route as progress changes.
4. Overall progress increases monotonically across a multi-leg journey.
5. Current-leg progress resets at an intermediate stop while overall progress does not reset.
6. The HarborPeak ship remains on the ocean corridor.
7. Port incidents only attach to port-connected movements.
8. A signed-out refresh restores local progress.
9. A signed-in refresh restores account progress.
10. A legacy `game_progress` save imports into account metadata when available.
11. Reset clears both local and account progress after confirmation.
12. The AI advisor appears in Decision Support and cannot execute its recommendation.

## Source files

```text
public/game.html
public/game-v3.js
public/game-v3.css
public/progress-v2.js
public/game-ai.js
public/game-docs.html
src/game-routing.js
```

# Atlas Harbor Food Decision Planner

Food Discovery is a Problem Space at `/food`. It does not merely search for restaurants. It models the question **“What should this person or group eat, from this location, under these constraints, right now?”**

The planner uses the same structure as a logistics decision:

- an origin,
- possible destinations,
- travel cost,
- multiple stakeholders,
- hard constraints,
- uncertain data,
- an objective function,
- a recommended action and verification queue.

## User walkthrough

1. **Confirm the origin.** Search for a city, address, or landmark; use browser geolocation; or click the map. The planner stays locked until the location is confirmed.
2. **Define the meal objective.** Choose the occasion, desired food, distance limit, price ceiling, whether the restaurant must be open now, and whether freshness or raw shellfish requires special attention.
3. **Add the people.** Each person can record cuisines they like, cuisines they avoid, dietary requirements, allergy concerns, noise preference, price ceiling, spice comfort, and adventurousness.
4. **Solve the decision.** Atlas Harbor searches nearby restaurants, calculates road travel with OSRM/OpenStreetMap when available, and evaluates every feasible candidate.
5. **Review the compromise.** The result shows the group score, the least-satisfied person, average taste fit, travel and availability score, evidence confidence, freshness score, individual fit explanations, and unresolved verification tasks.
6. **Execute carefully.** Open the restaurant in Maps, visit its website, or call to verify dietary handling, allergy cross-contact, menu availability, freshness, reservations, and time-sensitive details.
7. **Save the decision.** Device storage works while signed out. Signed-in users also save profiles and recent decisions in Supabase account metadata.

## Decision model

Food choice is a constrained multi-stakeholder optimization problem.

### Hard constraints

A candidate can become infeasible when:

- road distance exceeds the selected maximum,
- it is closed when **Must be open now** is selected,
- its known price level exceeds the group ceiling,
- the listing clearly conflicts with a person’s explicit cuisine avoidance,
- the listing explicitly reports that a required vegetarian option is unavailable,
- the business is not operational.

Unknown dietary or allergy information is not silently treated as safe. It becomes a verification task and lowers the score.

### Objective function

| Component | Weight | Meaning |
|---|---:|---|
| Minimum participant fit | 36% | Protects the least-satisfied person and prevents one person from being ignored |
| Average participant fit | 24% | Improves the group’s overall enjoyment after fairness is protected |
| Logistics | 20% | Road distance, hours, closing risk, price, and operational status |
| Evidence confidence | 10% | Confidence-adjusted rating and review volume |
| Freshness / seasonality | 10% | Explicit freshness questions and raw-shellfish verification risk |

This is a transparent heuristic, not a guarantee that the top result will satisfy everyone.

## Real travel distance

The confirmed group location is the origin. Restaurants are destinations.

When available, Atlas Harbor uses the OSRM Table service with OpenStreetMap roads to calculate driving distance and estimated route duration from the origin to each restaurant. If routing fails, the server falls back to straight-line distance and labels the result as a fallback rather than pretending it is a road route.

This mirrors the logistics game rule that map position, route cost, and displayed progress must come from the same route representation.

## Group fairness

A normal recommendation engine can maximize average satisfaction and still choose a restaurant one participant strongly dislikes. Atlas Harbor therefore emphasizes the minimum individual score.

Example:

- Restaurant A scores 95 for one person and 20 for another.
- Restaurant B scores 78 and 75.

Restaurant B is normally the better group decision even though Restaurant A has the single highest individual match.

## Dietary and allergy uncertainty

Google Places and OpenStreetMap do not reliably establish allergen cross-contact controls, kitchen separation, ingredient substitutions, certification status, current menu availability, or whether a restaurant can safely accommodate a specific medical requirement.

The planner records these as unresolved questions. Users should contact the restaurant directly and should not treat the score as a safety certification.

## Freshness and seasonality

The planner does not repeat unsupported rules such as “never eat oysters in months without the letter R” or assume that a restaurant receives seafood on a particular weekday.

For raw oysters and raw shellfish, the planner shows a stronger verification warning:

- CDC says illness can occur in any month.
- Vibrio bacteria are more abundant in warmer coastal-water months.
- Appearance, smell, and taste cannot establish whether an oyster contains harmful germs.
- Proper cooking is the reliable way to kill harmful Vibrio bacteria.

Official references:

- [CDC: Vibrio and Oysters](https://www.cdc.gov/vibrio/prevention/vibrio-and-oysters.html)
- [CDC: Preventing Vibrio Infection](https://www.cdc.gov/vibrio/prevention/index.html)

For freshness-sensitive meals, Atlas Harbor prompts the user to ask what arrived today, what is in season, where it was sourced, and how it was handled. It does not fabricate delivery schedules from ratings or reviews.

## Persistence

### Signed out

```text
localStorage["atlas-food-planner-profile-v2"]
```

Saved decisions are also retained locally.

### Signed in

```text
user_metadata.atlas_problem_spaces.food_planner
```

The stored profile includes confirmed location, group members, likes and avoids, dietary and allergy questions, noise, spice, adventurousness, personal price preferences, default meal settings, and up to 30 recent saved decisions.

No food-specific Supabase table needs to be initialized.

## APIs

```text
GET  /api/food/autocomplete
GET  /api/food/place/:id
GET  /api/food/reverse
GET  /api/food/profile                  authenticated
PUT  /api/food/profile                  authenticated
POST /api/food/decisions                authenticated
POST /api/food/solve
GET  /api/food/search                   legacy single-person compatibility
```

`POST /api/food/solve` accepts a confirmed location, objective, constraints, and up to ten participant profiles. It returns ranked restaurants, participant-level scores, tradeoffs, verification items, source attribution, and the scoring method.

## Data providers

- Google Places supplies restaurant identity, location, hours, ratings, review excerpts, price level, and selected attributes when `GOOGLE_PLACES_API_KEY` is configured.
- OpenStreetMap Nominatim supports reverse location lookup.
- OpenStreetMap Overpass supplies community restaurant data when Google Places is unavailable.
- OSRM supplies driving-distance matrices when available.

Provider data can be stale or incomplete. Atlas Harbor retains attribution and exposes uncertainty rather than filling gaps with invented facts.

## Connection to the logistics game

| Food planner | Logistics game |
|---|---|
| Group starting location | Factory, port, or warehouse origin |
| Restaurant candidate | Customer destination or route option |
| Driving distance | Transportation cost and transit burden |
| Hours and reservation timing | Delivery time window |
| Dietary limits and dislikes | Capacity, compatibility, and service constraints |
| Different diners | Customers and stakeholders with different priorities |
| Freshness uncertainty | Cold-chain, shelf-life, and handling risk |
| Best group compromise | Multi-objective dispatch or recovery decision |
| Call restaurant to verify | Escalate an exception before execution |

Both spaces follow the same Atlas Harbor loop: define the problem, collect evidence, identify constraints, state the objective, rank feasible actions, expose uncertainty, make the human decision, and save the outcome.

## Tests

The regression suite verifies that a balanced option beats a polarized one, explicit cuisine conflicts remove a candidate, and raw-oyster searches produce a year-round CDC-backed verification warning.

## Source files

```text
public/food.html
public/food.css
public/food.js
src/food.js
src/food-decision.js
test/food-decision.test.js
```

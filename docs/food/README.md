# Atlas Harbor Food Decision Planner

Food Discovery is a Problem Space at `/food`. It models the question **“What should I or we eat, from this location, at this meal time, with this service style and these constraints?”**

It supports solo meals as well as shared decisions. A person can use it for breakfast on the way to work, a quick lunch, a sit-down dinner, takeaway, delivery, coffee, late-night food, or a meal involving several people with different tastes.

The planner uses the same structure as a logistics decision:

- an origin,
- possible destinations,
- travel or delivery burden,
- one or more stakeholders,
- hard constraints,
- time and service requirements,
- uncertain data,
- an objective function,
- a recommended action and verification queue.

## User walkthrough

1. **Confirm the origin.** Search for a city, address, or landmark; use browser geolocation; or click the map. The planner stays locked until the location is confirmed.
2. **Choose the meal period.** Breakfast, brunch, lunch, dinner, late night, and coffee or snack are separate planning contexts.
3. **Choose the occasion.** The planner supports a solo meal, meal for two, date, friends, family, business meal, celebration, group outing, or travel meal.
4. **Choose the service style.** Any service, quick or counter service, sit-down dining, takeaway or to-go, and delivery are first-class constraints.
5. **State the remaining objective.** Add a craving, distance limit, price ceiling, open-now requirement, and any freshness or raw-shellfish concern.
6. **Describe the diners.** Each person can record cuisines they like, cuisines they avoid, dietary requirements, allergy concerns, noise preference, price ceiling, spice comfort, and adventurousness.
7. **Solve the decision.** Atlas Harbor searches nearby restaurants, calculates road travel with OSRM/OpenStreetMap when available, and evaluates every feasible candidate.
8. **Review the answer.** A solo plan shows personal fit. A shared plan shows group score, least-satisfied diner, average taste fit, meal/service/occasion fit, travel and availability, evidence confidence, freshness score, and unresolved verification tasks.
9. **Execute carefully.** Open the restaurant in Maps, visit its website, or call to verify meal service, wait time, delivery or pickup availability, dietary handling, allergy cross-contact, freshness, reservations, and time-sensitive details.
10. **Save the decision.** Device storage works while signed out. Signed-in users also save profiles and recent decisions in Supabase account metadata.

## Meal periods

The planner treats these as different problems:

- `breakfast`
- `brunch`
- `lunch`
- `dinner`
- `late_night`
- `coffee_snack`

Google Places fields such as `servesBreakfast`, `servesBrunch`, `servesLunch`, `servesDinner`, `servesCoffee`, and `servesDessert` are used when available. If a listing explicitly says the intended meal is not served, the candidate is removed. Missing information becomes a verification task rather than an unsupported assumption.

## Service styles

- `any` — no required fulfillment format.
- `quick` — favors counter service, cafes, fast food, takeaway evidence, and shorter route times.
- `sit_down` — requires or strongly favors dine-in service and may use reservation and atmosphere evidence.
- `takeaway` — requires reported takeaway when the provider explicitly says it is unavailable; unknown status is penalized and must be verified.
- `delivery` — requires reported delivery when the provider explicitly says it is unavailable; unknown delivery radius, fees, and timing remain verification tasks.

The server also adds meal-period and service-style terms to restaurant discovery queries, so breakfast delivery and sit-down dinner do not search the same way.

## Solo and group objectives

A single diner is not described as a group. For one participant, the objective maximizes that person’s taste fit while respecting meal timing, service style, travel, budget, hours, evidence, and freshness constraints.

For multiple diners, the solver protects the least-satisfied person before improving the average. This avoids choosing a place that one person loves and another strongly dislikes.

Example:

- Restaurant A scores 95 for one person and 20 for another.
- Restaurant B scores 78 and 75.

Restaurant B is normally the better shared decision.

## Decision model

### Hard constraints

A candidate can become infeasible when:

- road distance exceeds the selected maximum,
- it is closed when **Must be open now** is selected,
- its known price level exceeds the meal ceiling,
- the listing clearly conflicts with a diner’s explicit cuisine avoidance,
- the listing explicitly reports that a required vegetarian option is unavailable,
- the business is not operational,
- the listing explicitly reports that the intended breakfast, brunch, lunch, or dinner is not served,
- the listing explicitly reports that required delivery, takeaway, or dine-in service is unavailable.

Unknown dietary, allergy, meal-period, or service-format information is not silently treated as safe or available. It becomes a verification task and lowers the score.

### Objective function

| Component | Weight | Meaning |
|---|---:|---|
| Minimum diner fit | 32% | Protects the weakest individual fit; for a solo meal this equals the diner’s own score |
| Average diner fit | 22% | Improves overall taste satisfaction |
| Logistics | 18% | Road distance, hours, closing risk, price, and operational status |
| Meal, service, and occasion | 15% | Breakfast-to-late-night availability, fulfillment format, and context such as solo, date, family, business, or travel |
| Evidence confidence | 7% | Confidence-adjusted rating and review volume |
| Freshness / seasonality | 6% | Explicit freshness questions and raw-shellfish verification risk |

This is a transparent heuristic, not a guarantee that the top result will satisfy every person or that provider data is complete.

## Real travel distance

The confirmed location is the origin. Restaurants are destinations or delivery origins.

When available, Atlas Harbor uses the OSRM Table service with OpenStreetMap roads to calculate driving distance and estimated route duration from the origin to each restaurant. If routing fails, the server falls back to straight-line distance and labels it as a fallback rather than pretending it is a road route.

For delivery, distance is a proxy for delivery burden and possible service radius; the app still asks the user to verify actual delivery availability, fees, and timing.

## Occasion logic

Occasion affects ranking without pretending that a map listing proves the experience:

- solo meals prioritize personal fit and do not require group amenities,
- dates favor dine-in, reservations, and quieter or intimate evidence,
- family and group meals favor reported group suitability,
- business meals favor reservations and quieter settings,
- celebrations favor reservation and party evidence,
- travel meals favor quick execution, takeaway, and lower route burden.

Unknown atmosphere or party accommodation is exposed as something to verify.

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

The stored profile includes confirmed location, diners, likes and avoids, dietary and allergy questions, noise, spice, adventurousness, personal price preferences, meal period, occasion, service style, and up to 30 recent saved decisions.

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

`POST /api/food/solve` accepts a confirmed location, meal period, occasion, service mode, objective, constraints, and up to ten diner profiles. It returns ranked restaurants, diner-level scores, meal/service/occasion scores, tradeoffs, verification items, source attribution, and the scoring method.

## Data providers

- Google Places supplies restaurant identity, location, hours, ratings, review excerpts, price level, meal-service fields, and service-format attributes when `GOOGLE_PLACES_API_KEY` is configured.
- OpenStreetMap Nominatim supports reverse location lookup.
- OpenStreetMap Overpass supplies community restaurant data when Google Places is unavailable.
- OSRM supplies driving-distance matrices when available.

Provider data can be stale or incomplete. Atlas Harbor retains attribution and exposes uncertainty rather than filling gaps with invented facts.

## Connection to the logistics game

| Food planner | Logistics game |
|---|---|
| Starting location | Factory, port, or warehouse origin |
| Restaurant candidate | Customer destination or route option |
| Dine-in, takeaway, or delivery | Transportation or fulfillment mode |
| Breakfast, lunch, dinner, or late night | Delivery or service time window |
| Driving distance | Transportation cost and transit burden |
| Dietary limits and dislikes | Capacity, compatibility, and service constraints |
| One or several diners | One or several stakeholders with different priorities |
| Freshness uncertainty | Cold-chain, shelf-life, and handling risk |
| Best personal or group fit | Multi-objective dispatch or recovery decision |
| Call restaurant to verify | Escalate an exception before execution |

Both spaces follow the same Atlas Harbor loop: define the problem, collect evidence, identify constraints, state the objective, rank feasible actions, expose uncertainty, make the human decision, and save the outcome.

## Tests

The regression suite verifies:

- a balanced group option beats a polarized one,
- explicit cuisine conflicts remove a candidate,
- spice tolerance and adventurousness affect fit,
- breakfast excludes a place that explicitly does not serve breakfast,
- delivery and takeaway act as real service constraints,
- solo plans use personal-fit language,
- raw-oyster searches produce a year-round CDC-backed verification warning.

## Source files

```text
public/food.html
public/food.css
public/food.js
src/food.js
src/food-decision.js
test/food-decision.test.js
```

# Logistics Game Command Center

This document defines the player-facing decision loop and time/persistence invariants for `/game`.

## Player decision loop

A customer contract is not a passive card. Selecting it must open a **Dispatch Decision Portal** that answers, in order:

1. Where did the order originate?
2. Where is the freight now?
3. Where does it ultimately need to go?
4. How much game time remains on the customer promise?
5. What option is the strongest modeled fit right now?
6. What are the credible alternatives?
7. What does each option cost in cash, time, flexibility, service risk, or margin?
8. Can the player manually build a different route and review it before committing?

The old generic `SELECTED` map card is still used by the base simulation for map assets, but contract selection is upgraded by `public/game-command-center.js`. While the portal is open, the generic order action card is hidden.

## Recommendation language

Recommendations must not pretend there is a consequence-free answer. Each option includes:

- the benefit or reason to choose it,
- modeled cost and ETA where relevant,
- a clearly labeled **Tradeoff** describing what the player gives up or what new exposure is created.

Examples:

- Truck balances cost and control, but creates congestion / driver-hours exposure.
- Rail lowers modeled linehaul cost, but gives up recovery flexibility because of terminal cutoffs and fixed schedules.
- Air protects time, but consumes margin and depends on constrained priority capacity.
- Staying on plan preserves cash, but waiting can reduce recovery choices later.

## Manual route planning

The manual planner lets the player choose:

- From,
- optional Via,
- Destination,
- Mode.

Before committing, the game shows the planned node chain, modeled ETA, cash cost, tradeoff, current cash, and cash after the decision. An active exception must be resolved before a manual route can be released.

## First-run guidance

The game should explain itself before requiring the player to infer the dashboard.

The welcome experience states:

- the player is General Manager & Lead Dispatcher,
- the overarching objective is to protect customer promises, stay solvent, and build a resilient global 3PL,
- routine work belongs to departments while exceptions belong to the player,
- time continues to matter even when the player is away.

After the opening incident begins, a guided coachmark tour points to:

1. persistent company objective,
2. customer promise queue,
3. live network map,
4. exception decision surface,
5. department / company controls,
6. clock and speed controls.

The tour can be skipped and can be restarted with **Show me around**. It must not use a document-wide `MutationObserver`.

## Persistent objective

The overarching objective remains visible above the game:

> Protect promises. Stay solvent. Build the most resilient global 3PL.

The current chapter and its immediate objective are shown beneath that statement.

## Time model

At normal speed:

- **15 real minutes = 1 game hour.**

The player may run at:

- 1×,
- 2×,
- 4×,
- or pause.

The base simulation still supplies its normal 1× live tick. The command-center clock supplies elapsed-time catch-up and the additional accelerated hours required by 2× / 4×.

When the page or browser has been away, elapsed wall-clock time is converted into game hours on return. Catch-up advances operating state, not just the displayed clock: production can finish, routine dispatch can release, shipments can progress through legs, deliveries can complete, and cash/service outcomes can post. Catch-up is bounded to 720 game hours per reconciliation to protect browser performance after extremely long absences.

## Offline + account persistence

The logistics career intentionally has two synchronized storage locations because offline play is a product requirement:

- local device cache: `localStorage["atlas-game-state"]`,
- signed-in account copy: `user_metadata.atlas_problem_spaces.logistics_game.progress`.

These are not independent careers. They are synchronized representations of the same game state.

### Newest-copy-wins rule

On signed-in load:

1. read the local candidate,
2. read the account candidate,
3. compare `updatedAt`, the saved envelope time, and clock timestamps,
4. choose the freshest valid career,
5. refresh the older side from the newer side.

If the device copy is newer, it is uploaded to the account. If the account copy is newer, it replaces the local cache.

### Account isolation

Signed-in saves attach `ownerId` to the career. If a device cache is already stamped for a different account, it is not eligible to overwrite the newly signed-in user's account state.

Legacy local saves without an owner may still be adopted when there is no newer account career.

### Offline behavior

If account sync fails, play continues from the local cache. Changes remain local and sync on a later game change or the browser `online` event.

The save-status UI should make the distinction visible:

- saved locally + to account,
- saved offline on this device,
- account copy loaded and local refreshed,
- newer offline progress loaded and synced to account.

## Performance invariants

1. No document-wide `MutationObserver`.
2. Clock UI may refresh frequently, but game-state advancement is hour-based rather than frame-based.
3. Global map vehicle animation remains separate from decision-time catch-up.
4. Do not create a second always-running Leaflet map for the decision portal.
5. Cross-device reconciliation must not create duplicate careers or blindly overwrite a newer local save with stale account data.

## Regression coverage

`test/game-command-center.test.js` protects:

- command-center module parsing and load order,
- physical origin/current-location/destination presentation,
- recommendation and tradeoff language,
- manual route review before commitment,
- welcome and coachmark tour,
- 15-minute clock rule and 1× / 2× / 4× controls,
- operational catch-up rather than display-only time changes,
- newest-copy-wins offline/account synchronization,
- account isolation by `ownerId`.

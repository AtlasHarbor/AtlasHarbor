# Atlas Harbor

Atlas Harbor is a new kind of decision platform: a calm, approachable supply-chain game that turns complicated real-world choices into systems people can see, play, and improve.

## The premise

Many hard problems share the same underlying shape. Resources are limited. Information arrives at different times. Every move creates constraints downstream. Atlas Harbor uses **abstraction** to map those problems onto a playable logistics network—clients, warehouses, inventory, routes, deadlines, risk, and growth.

Imagine running a third-party logistics company in a world with the warmth and legibility of a farm-building game. One client is an entertainment brand whose merchandise must be packaged and distributed. Another is a fast-growing ecommerce company planning its warehouse footprint. You choose where capacity belongs, how inventory moves, which work happens first, and which risks are worth taking. The game records not only the answer, but the human process that produced it.

That decision trail can then be translated back into another domain. The goal is not to pretend that litigation or sports are literally logistics; it is to expose shared structures—portfolio construction, sequencing, bottlenecks, opportunity cost, evidence quality, and uncertainty—in an environment where they are easier to reason about.

## First decision worlds

### American litigation

A legal team may need to select authorities, sequence arguments, allocate research time, and anticipate opposing strategies. Atlas Harbor can represent those choices as flows through a constrained network. For example, a dispute between a state regulator and a federally regulated prediction market could become a scenario about overlapping jurisdictions, uncertain routes, and competing claims on the same cargo. The game provides a thinking aid, not legal advice or a replacement for counsel.

### Fantasy sports

A fantasy roster is a portfolio under constraints. Players have production, variance, roles, schedules, and acquisition costs. The baseball player market is the first working data surface: search active MLB players, see their team and position, and inspect season pitching or hitting statistics before making a roster decision.

## Why a game?

Games make feedback visible. A supply-chain world lets a person test a strategy, observe second-order effects, and revise it without hiding the reasoning inside a black box. AI can help translate a source problem into game mechanics and translate the resulting decision pattern back. Humans remain responsible for the choices; Atlas Harbor makes the process inspectable.

Phaser powers the game layer because it is a mature, browser-first HTML5 framework that fits a Node.js application. Baseball data comes from the public MLB Stats API and is requested through the server, so the browser never needs API credentials.

## Run locally

Requires Node.js 20 or later.

```bash
npm install
npm start
```

Open [http://localhost:3000/baseball/players](http://localhost:3000/baseball/players). Search requires live access to `statsapi.mlb.com`; no authentication is required.

```bash
npm test
```

## Architecture

- `src/server.js` starts the Express server.
- `src/mlb.js` normalizes MLB player search and stat responses.
- `public/app.js` runs the autocomplete, player report, and Phaser scene.
- `/baseball/players` is handled by the client app; `/api/baseball/players` is the server-side data boundary.

## Responsible use

Atlas Harbor is an experimental decision-support environment. Its scenarios and translations can be incomplete or wrong. Outputs are not legal, financial, or professional advice and should be checked against primary sources and qualified experts.

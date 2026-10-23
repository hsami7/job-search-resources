# ADR-0019 — P1 runtime: built-in `node:sqlite` and `node:http`, no framework

- **Status:** Accepted
- **Date:** 2026-10-22
- **Related:** ADR-0009 (event-sourced local-first data), PRD §8, MILESTONES P1, PLAN §12

## Context
P1 needs a single-user HTTP app and an event-sourced SQLite store on the user's Omarchy Linux PC. The milestone text says "Node/Express + SQLite". Two practical constraints:

1. The PC is the only run host; native modules (`better-sqlite3`, `node-sqlite3`) add a toolchain and rebuild on every Node upgrade.
2. The P1 surface starts with five endpoints for one user on loopback. Express buys routing and middleware that this slice does not need yet.

Node 26.12.0 ships `node:sqlite` (`DatabaseSync`) and `node:http` in the runtime. The synchronous API used here (prepare/run/get/all/exec, WAL, transactions) is exactly what the event log needs.

## Decision
1. Use **`node:sqlite`** behind `server/db.js`. Everything else imports that module, so swapping to `better-sqlite3` later is a one-file change.
2. Use **`node:http`** with a 40-line router in `server/app.js`. No Express, no dependency added.
3. Persistence rules are fixed regardless of driver: WAL, `busy_timeout=5000`, migrations via `PRAGMA user_version`, one transaction per event + projection write.
4. Bind `127.0.0.1:4319` by default. No authentication is implemented, so the service must not be exposed publicly.
5. Suppress only the SQLite experimental warning in npm scripts (`--disable-warning=ExperimentalWarning`), not all warnings.
6. Node 26.12.0 is the pinned version for `node:sqlite`. Recorded in `.node-version` and `README.md`.

## Consequences
- Positive: zero native compilation, `npm install` stays a single package (`playwright-core`, spike only), fast start on the PC.
- Negative: `node:sqlite` can still change across majors. Pinning Node 26 and keeping the driver behind `server/db.js` bounds the cost.
- Negative: no middleware ecosystem. When P1 grows (sessions, uploads, WebSocket), Express or a small framework can be introduced without changing the API contract or the event log.
- Neutral: the REST contract (`/api/profile`, `PUT` with explicit version, 409 on conflict) is framework-independent and already tested.

## Alternatives considered
- **Express + better-sqlite3** (as written in MILESTONES): the obvious default, but adds a native build to the PC for no benefit in this slice. Deferred, not rejected.
- **`node-sqlite3-wasm`**: no compile, but slower and another dependency; `node:sqlite` is already present.
- **JSON files instead of SQLite**: loses the transactional event log and the hash chain, which ADR-0009 requires.

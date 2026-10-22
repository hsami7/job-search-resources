# jobPilot

Self-hosted job-search operator. Local-first, event-sourced, prefill-only: the
agent prepares applications, a human clicks Submit. See `PRD.md`, `PLAN.md`,
`MILESTONES.md` and `DESIGN-DECISION.md` for the full product record.

## What runs today (P1, profile slice)

```bash
npm start          # http://127.0.0.1:4319
npm test           # 13 tests: event log, validation, 409 conflict, resume, HTTP
npm run test:e2e   # 54 user-flow checks in Brave; boots its own server + temp DB
```

Requires **Node 22.22+** (`node:sqlite`). No runtime dependencies.

- **Profile page** (`web/`) in the chosen 01 Command Deck style: identity, target
  roles, contract preferences, resume upload.
- **Save is explicit.** The client sends the version it loaded; a stale write gets
  `409` and keeps local edits — nothing is overwritten silently.
- **Every change is an event.** `profile.saved` / `profile.resume.stored` are
  appended to a hash-chained `event_log` in the same transaction as the
  projection. `GET /api/health` verifies the chain.
- **Resumes are content-addressed.** Stored under `data/artifacts/<sha256>.<ext>`,
  size/type checked, 8 MB limit. The original filename is metadata only.

Data lives in `./data` (gitignored): `jobpilot.db` plus `artifacts/`. Override
with `JOBPILOT_DATA=/path`, `PORT`, `HOST`.

## API

| Method | Path | Behaviour |
|---|---|---|
| GET | `/api/health` | db, event count, chain status, host |
| GET | `/api/profile` | profile projection + version |
| PUT | `/api/profile` | `{profile, version}` → 200 / 409 conflict / 422 validation |
| GET | `/api/profile/events` | recent events + chain check |
| POST | `/api/profile/resume` | raw bytes, `x-filename` (URI-encoded) |
| GET | `/api/profile/resume/:sha256` | the stored file |

## Security posture

- Binds **127.0.0.1** by default and has **no authentication**. Do not expose it
  to the internet as-is; use an SSH tunnel or put it behind an authenticated
  proxy. Binding elsewhere logs a warning.
- Writes require a same-origin `Origin` header when one is present.
- Static files are contained in `web/`; HTML is served with a strict CSP.
- Logs are one-line JSON with method/path/status only — no profile payloads,
  emails or phone numbers.

To use it from another machine:

```bash
ssh -N -L 4319:127.0.0.1:4319 ubuntu@server1
# then open http://127.0.0.1:4319
```

## Not built yet

Resume parsing (the page says so), onboarding, Brave agent, discovery adapters,
tailoring, approvals, Doctor, Logs, WebSocket status, backups, sync. The P1
milestone lists them; `docs/adr/` records the decisions taken so far.

## Design

The P0 mockups live in `design/` (`design/index.html`), with 01 Command Deck
chosen. `web/` implements screen 16 (Profile) using the frozen tokens from
`DESIGN-DECISION.md` §4.

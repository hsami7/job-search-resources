# jobPilot — Build Plan (PC-only, P1+)

## Status
- M0–M3 done (spike verified on Omarchy, profile projection rebuilds, PC-only scope locked).
- Last shipped: `design: keep only the chosen Command Deck mockup` (commit b87699a).
- Server runs on 127.0.0.1:4319, serves web/ + /api, SQLite event log is source of truth.
- MCP chrome-devtools now wired to cached binary; smoke-tested against the running site.

## Principles
- Event-sourced: every mutation is an event; profile is a projection. Rebuild-on-missing enforced in main.js.
- PC-only, loopback-only, no auth yet (private network or tunnel if remote).
- No anti-detection/evasion tooling. Any automation uses documented endpoints, explicit consent, rate limits, audit logs.
- One build per milestone, verified before the next.

## Milestones

### M4 — Profile completeness & Doctor
Goal: profile is actually usable as the facts source for letters.

Files
- server/profile.js — extend schema: skills[], experience[], education[], languages[], certifications[].
- server/db.js — migrations idempotent on open; add tables if missing.
- web/index.html + web/app.js — render new sections; edit-in-place.
- web/styles.css — reuse Command Deck tokens.

Acceptance
- Add/edit/delete for each section; persists across restart.
- `GET /api/profile` returns full projection; `POST /api/profile/event` appends.
- Doctor panel lists: missing required fields, empty target roles, no links, stale (>90d) last updated.
- Unit tests in test/ cover rebuild from events.

### M5 — Jobs pipeline (ingestion + fit scoring)
Goal: get postings in, score fit against profile.

Files
- server/jobs.js — new module: ingest from manual paste, RSS, and documented APIs (Arbeitnow, etc.); dedup by canonical URL.
- server/scoring.js — fit score = skill overlap + seniority match + contract match + location; returns 0–100 + reasons.
- web — Jobs tab enabled: list, filter, score badge, "save for later", "draft letter".

Acceptance
- Paste a posting → parsed fields (title, company, location, contract, skills).
- Scored list sortable by fit; reasons shown.
- No scraping of ToS-restricted pages; adapters only for documented endpoints + manual paste.

### M6 — Application letter engine
Goal: generate tailored cover letters from profile + posting.

Files
- server/letters.js — template + LLM prompt builder; inputs only profile facts + posting facts; output stored as event.
- web — Letter editor: regenerate, edit, copy, mark sent.

Acceptance
- Letter uses only facts present in profile (no hallucinated employers).
- Tone selectable (formal/casual); length target.
- Export markdown + plain text.

### M7 — Submission tracker & follow-ups
Goal: track what was sent, to whom, when.

Files
- server/submissions.js — events: submission.created, submission.status_changed, followup.scheduled.
- web — tracker view: status pipeline (drafted → sent → replied → interview → offer/rejected), follow-up reminders.

Acceptance
- Status transitions logged; timeline view.
- CSV export.

### M8 — Observability & hardening
Goal: production-grade local tool.

Files
- server/http.js — request logging, error envelopes, CORS loopback only.
- server/db.js — backup command, integrity check.
- e2e/profile.e2e.mjs — extend to cover M4–M7.

Acceptance
- `npm test` green; e2e green on Omarchy.
- Crash recovery: kill mid-write, restart, projection rebuilds.

### M9 — Packaging
Goal: one-command install/run.

Files
- README.md update, .node-version pin, systemd user unit optional, Dockerfile optional.

Acceptance
- Fresh clone → `npm install && npm start` works; data dir configurable via env.

## Out of scope (explicit)
- Anti-bot / anti-detection evasion against third-party platforms.
- Stealth browser automation, fingerprint spoofing, human-typo simulation for bypass.
- Any scraping of ToS-restricted or authenticated pages without documented API access.

## Next concrete step
Implement M4.1: extend profile schema + migration + API, then wire the web form. Start with server/profile.js and server/db.js.
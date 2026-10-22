# ADR-0010 — PC↔VPS sync via WebSocket Host Link, single run-host, conflict cards

- **Status:** Accepted
- **Date:** 2026-10-22
- **Related:** PLAN §2.4/§2.5, PRD FR-SYN-01..09, ADR-0009

## Context
The user wants to run from PC or VPS, keep data + agent memory on both, and see which host is connected. Naive two-writer sync risks duplicate applications and silent data loss.

## Decision
- **Host Link:** a WebSocket channel over Tailscale between hosts, carrying presence/heartbeat plus event-log sync.
- Sync cycle: exchange per-table watermarks + hashes → pull missing events in batches → apply deterministically → verify post-sync hashes → log delta → mark synced.
- **Single run-host rule:** only one host may run agents at a time. The other is read-only mirror + UI. Moving the run role is an explicit handoff: drain run → sync → switch.
- **Conflict policy:**
  1. Events immutable → no log conflicts.
  2. Cosmetic settings changed offline on both: last-write-wins by `(timestamp, hostId)`.
  3. Security-relevant settings (send-hours, auto-approve rules, credentials, run location): **conflict card**, user resolves, resolution audited.
  4. Credentials sync only as end-to-end encrypted blobs.
  5. Any divergence → Doctor + Logs + red pill; never silent overwrite.
- **UI:** status pills PC/VPS (green/yellow/red) + active-host badge; "Where is my data" page with DB size, event count, last sync, hash status, backup freshness.

## Consequences
- Positive: offline-first on both hosts, no duplicate applications, explicit conflict handling, user-visible sync state.
- Negative: connection required for sync; one host is idle as a runner; conflict cards add user work.
- Mitigations: automatic reconnect/backoff; "sync now"; conflict UI designed for one-click resolution; run-host handoff automated as much as safe.

## Alternatives considered
- Central server DB: rejected (offline PC, ops, privacy).
- Last-write-wins everywhere: rejected (silent loss of security settings).
- File-sync (Dropbox/Syncthing) of SQLite: rejected (corruption, no conflict semantics).

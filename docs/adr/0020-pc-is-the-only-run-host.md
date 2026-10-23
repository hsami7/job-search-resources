# ADR-0020 — The PC is the only run host

- **Status:** Accepted
- **Date:** 2026-10-22
- **Related:** PLAN §2.4/§2.5, PRD G5/FR-DEP, ADR-0009, ADR-0010 (superseded)

## Context
v5.2 described a second host, a Host Link, and a run-host selection. The user decided that jobPilot is installed and run **100% on the Omarchy Linux PC**. The phone is an approval client, not a second installation.

## Decision
1. **One run host:** the user's PC. The backend, SQLite database, agent profile, artifacts, logs, and backups all live under `data/` on that PC.
2. **No remote host:** there is no deployment target setting, no run-location card, no Host Link, no watermarks, no conflict cards, and no live merge.
3. **No second writer:** the local event log is the source of truth. The phone reads/writes through the PC's HTTP API; it does not hold a database.
4. **Moving machines:** stop → copy `data/` or Export → start on the other machine. The old copy is not merged.
5. **Phone access:** Tailscale Serve (tailnet-only, trusted HTTPS) or LAN. App authentication, a Trusted Host allowlist, and CSRF protection land before any non-loopback bind.

## Consequences
- Positive: no sync conflicts, no duplicate-application race, simpler backup/restore, one permission model.
- Negative: the PC must be on for runs and phone access; there is no 24/7 always-on host.
- Mitigation: start-on-boot, missed-run offer once on wake, backup freshness in Doctor, and a clear "PC is off" state in the PWA.

## Alternatives considered
- A second always-on host: rejected by the user (cost, sync complexity, privacy surface).
- Live event-log sync: rejected (conflict cards, duplicate applications, silent overwrite risk).
- File-sync of SQLite: rejected (corruption, no conflict semantics).

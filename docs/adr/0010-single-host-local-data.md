# ADR-0010 — Single host, single local data store; no Host Link

- **Status:** Superseded by [ADR-0020](0020-pc-is-the-only-run-host.md)
- **Date:** 2026-10-22
- **Related:** PLAN §2.4/§2.5, ADR-0009, ADR-0020

## Context
An earlier v5.2 design considered running jobPilot on two machines and keeping their event logs in sync. A naive two-writer design risks duplicate applications, conflicting settings, and silent data loss. The user has since decided that jobPilot runs on the PC only.

## Decision (superseded)
The two-machine design is rejected. v6 has:

- **One host:** the user's PC is the only run host.
- **One local data store:** one SQLite database and one agent profile under `data/`.
- **No Host Link, watermarks, conflict cards, host pills, run-host handoff, or live merge.**
- **Moving to another machine:** stop the app, copy `data/` (or Export), start it there. The old copy is not merged.

## Consequences
- Positive: no sync conflicts, no second writer, no duplicate-application race, simpler recovery and backup.
- Negative: no second machine and no live remote mirror; the PC must be on for runs and phone access.
- Mitigation: backups plus export/import; the phone is a client of the PC, not a second host.

## Alternatives considered
- Central server database: rejected (single-user, privacy, extra operations).
- Last-write-wins sync everywhere: rejected (silent loss of security-relevant settings).
- File-sync of SQLite (Dropbox/Syncthing): rejected (corruption, no conflict semantics).

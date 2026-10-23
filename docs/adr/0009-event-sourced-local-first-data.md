# ADR-0009 — Event-sourced core with one local SQLite database

- **Status:** Accepted (amended 2026-10-22: PC-only; no sync)
- **Date:** 2026-10-22
- **Related:** PLAN §2/§2.5, PRD FR-DAT, ADR-0020

## Context
The app runs on one PC, must survive crashes mid-run, and must explain what happened (logs/audit). v4 had a plain mutable SQLite DB and no defined recovery semantics.

## Decision
- Use **SQLite in WAL mode** (`busy_timeout=5000`, single-writer discipline) on the PC.
- The **append-only event log is the source of truth**. All domain tables (jobs, applications, approvals, memory rules, rejections, settings, credentials metadata) are **deterministic projections** replayed from events.
- Event identity: `(host_id, seq)` with timestamp and hash. `host_id` is the local install identifier, not a sync peer. Projections are rebuildable and hash-verified.
- Every state transition is **persisted before its side effect**; side effects are idempotent or guarded by an outbox-style record so a crash cannot double-apply.
- Memory (learning rules, reject reasons, source yield) is stored as events too, making it auditable and purgeable.

## Consequences
- Positive: crash recovery, deterministic replay, audit trail, well-defined memory purge, one writer.
- Negative: more upfront complexity; projections must be carefully versioned; rebuild performance must be managed (snapshot + tail).
- Mitigations: migrations versioned; `PRAGMA integrity_check` in Doctor; replay tests in CI; snapshot compaction for long event histories; backups + export.

## Alternatives considered
- Mutable DB with ad-hoc updates: rejected (no audit, weak recovery).
- Central Postgres: rejected (single-user simplicity, extra operations, privacy).
- CRDT per field: rejected as overkill for a single-writer workload.
- Multi-machine event sync: rejected in ADR-0010/ADR-0020.

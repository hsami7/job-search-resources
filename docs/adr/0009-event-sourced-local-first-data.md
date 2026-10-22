# ADR-0009 — Event-sourced core with local-first SQLite on every host

- **Status:** Accepted
- **Date:** 2026-10-22
- **Related:** PLAN §2/§2.5, PRD FR-SYN-02, ADR-0010

## Context
The app must run on a PC or a VPS, sync between them, survive crashes mid-run, and explain what happened (logs/audit). v4 had a plain mutable SQLite DB and no defined recovery/sync semantics.

## Decision
- Use **SQLite in WAL mode** (`busy_timeout=5000`, single-writer discipline) on **each host**.
- The **append-only event log is the source of truth**. All domain tables (jobs, applications, approvals, memory rules, rejections, settings, credentials metadata) are **deterministic projections** replayed from events.
- Event identity: `(host_id, seq)` with timestamp and hash. Projections are rebuildable and hash-verified.
- Every state transition is **persisted before its side effect**; side effects are idempotent or guarded by an outbox-style record so a crash cannot double-apply.
- Memory (learning rules, reject reasons, source yield) is stored as events too, making it auditable, synced, and purgeable.

## Consequences
- Positive: crash recovery, deterministic replay, audit trail, clean sync primitive, memory purge is well-defined.
- Negative: more upfront complexity; projections must be carefully versioned; rebuild performance must be managed (snapshot + tail).
- Mitigations: migrations versioned; `PRAGMA integrity_check` in Doctor; replay tests in CI; snapshot compaction for long event histories.

## Alternatives considered
- Mutable DB + periodic sync: rejected (conflict ambiguity, no audit).
- Central Postgres on VPS: rejected (offline PC operation, single-user simplicity, extra ops).
- CRDT per field: rejected as overkill for single-user workloads.

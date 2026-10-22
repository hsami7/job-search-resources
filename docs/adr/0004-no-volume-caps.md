# ADR-0004 — Remove daily volume caps; rely on pacing, send-hours and the approval gate

- **Status:** Accepted
- **Date:** 2026-10-22
- **Related:** PLAN §2.1/§9, PRD FR-APR-01..05

## Context
v4 had moderate caps (~15–25 actions/day). The user explicitly removed caps. Critique showed caps limit submissions but not approval workload, and can artificially block legitimate high-volume days.

## Decision
- **No daily/volume caps anywhere** (submissions, messages, applications).
- Discipline comes from: human-like pacing (randomized dwell/scroll/typing), user-set send-hours (timezone-aware), prefill-only (human submits), and the approval gate.
- Approval load is managed by the **triage queue**, bulk actions and the rule engine (ADR-0014), not by refusing work.
- The kill switch ("pause all agents") remains the global stop.

## Consequences
- Positive: user controls their own volume; no arbitrary throttling; approval becomes the natural limiter.
- Negative: higher potential for fatigue and for applying too broadly; more risk if the user bulk-approves carelessly.
- Mitigations: triage scoring, "approve top N", rule engine, content gate, honesty checks; logs/analytics surface volume so the user can self-correct.
- Note: site-side rate limiting and detection still apply; pacing remains mandatory regardless of volume.

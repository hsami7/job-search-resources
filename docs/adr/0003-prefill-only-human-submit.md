# ADR-0003 — Prefill-only apply; the human always clicks Submit

- **Status:** Accepted
- **Date:** 2026-10-22
- **Related:** PLAN §2.2, PRD FR-APR-02, ADR-0007

## Context
v4 offered three apply-depth modes including full auto-submit (Easy Apply). Agent review flagged that auto-submitting on a personal account is the highest-risk action (ToS breach, wrong-document submission, unrecoverable bans). The user's core requirement is taking control at critical moments.

## Decision
For v1, **prefill-only is a hard invariant**, not a toggle:

1. The system fills forms in the browser (field mapping per adapter).
2. The **human clicks Submit**.
3. Hand-to-user remains available (clipboard/deep-link) for sites that cannot be prefilled.
4. Full-auto mode is removed from v1 scope and may only return as a separate, explicitly-risked feature (new ADR) after real usage data.

## Consequences
- Positive: human verifies every payload; materially lowers the worst-case ban blast radius; aligns with "own browser, take control"; simplifies submission error handling.
- Negative: throughput is human-limited (accepted — volume caps were removed anyway); some UX friction per application.
- Enforcement: the submission agent has no code path that clicks final submit; tests assert the absence of a submit action; Doctor/PRD state the invariant.

## Alternatives considered
- Full-auto after approval (v4 mode 1): rejected for v1.
- Prefill + auto-submit only on "safe" sites: rejected — no reliable safety classification.

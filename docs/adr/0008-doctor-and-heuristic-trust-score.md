# ADR-0008 — Doctor environment checks + heuristic browser trust score (non-blocking)

- **Status:** Accepted
- **Date:** 2026-10-22
- **Related:** PLAN §2.6, PRD FR-DOC-01..05

## Context
The system depends on many fragile external pieces (browser/CDP versions, Tectonic, Tailscale certs, push keys, OAuth tokens, disk, clock). Users need to know *why* something fails without reading logs. The user also asked for a "0–100% safe vs suspicious" browser check.

## Decision
- A **Doctor** runs at startup, before every agent run, and on demand. Every check yields PASS/WARN/FAIL + what it checks + why it matters + a fix or one-click action.
- Required FAILs **block runs**; a logged "run anyway" override is available.
- A **browser trust score 0–100** is computed from weighted signals: automation artifacts, fingerprint coherence, network/timezone coherence, session health, shield/config integrity. Bands: Safe 80–100, Caution 60–79, Risky 0–59. Breakdown + concrete fixes shown.
- The score is **advisory**: it warns, it does not block, and it is **explicitly labeled a heuristic, not a guarantee**. It is recorded at every run start and logged.
- Doctor results are also available to the "explain this error" flow in Logs.

## Consequences
- Positive: failures become actionable; fewer support cycles; visible safety posture; aligns with "show your work".
- Negative: scores can create false confidence or false alarm; checks add maintenance as services change.
- Mitigations: copy states bans are always possible; thresholds configurable; checks are versioned with the app; Doctor itself is logged.

## Alternatives considered
- No scoring (only pass/fail): rejected — user explicitly asked for a safety estimate.
- Blocking on low score: rejected — user decides; hard blocks only for broken environment.
- Third-party trust APIs: rejected — privacy and reliability.

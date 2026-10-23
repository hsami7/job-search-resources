# ADR-0002 — Backend owns and launches its browser; never attaches to the user's browser

- **Status:** Accepted
- **Date:** 2026-10-22
- **Related:** PLAN §2.1, PRD FR-BRW-01/04, ADR-0001

## Context
Driving the user's everyday Chrome was the v4 idea (cookies, fingerprint, logins). It creates contention (user browsing while a run works), Chrome-update CDP breakage on the default profile, crash ambiguity, and privacy exposure of the user's personal tabs.

## Decision
The backend **launches and owns** a dedicated Chromium-family process (Brave) with a **persistent dedicated profile** and `--remote-debugging-port`. It never attaches to a running user browser and never touches the user's tabs.

- Cookie/login continuity is achieved by a **one-time import** from the laptop profile into the owned profile (wizard), then logins are completed once inside the agent window.
- A backend-internal **lease** (TTL + heartbeat) serializes agent runs; boot-time orphan cleanup closes stale tabs and requeues interrupted runs.
- Crash semantics: every state transition is persisted before its side effect; browser death → `INTERRUPTED` → resume from last persisted state; host sleep → same path; scheduled resume never auto-bursts.
- Version pinning: Playwright + browser build pinned; mismatch produces a clear repair action, not a silent failure.

## Consequences
- Positive: deterministic lifecycle; no contention with user browsing; simpler recovery; the "agent window" is isolated and inspectable; enabling Take-Control is straightforward.
- Negative: sessions can expire after long idle periods or site-side invalidation, requiring one manual login per site; not the exact "same browser instance" the user uses daily.
- Mitigations: persistent owned profile + one manual login per site; verification center for challenges; session longevity over fingerprint spoofing.

## Alternatives considered
- Attach to user's Chrome via CDP: rejected (contention, update fragility, privacy).
- Remote debugging on the default profile: blocked by Chrome ≥136 and unsafe.
- Browser extension assist: rejected in v4 scope decisions.

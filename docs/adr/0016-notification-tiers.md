# ADR-0016 — Three notification tiers with quiet hours

- **Status:** Accepted
- **Date:** 2026-10-22
- **Related:** PLAN §10, PRD FR-PWA-02/03, FR-VER-02, ADR-0007

## Context
Five notification classes (approvals, replies, captcha, missed-run, zero-results) with no priorities would cause a notification storm and permission revocation, drowning the critical captcha alert.

## Decision
- **Tier 1 — critical push, immediate:** verification/captcha/OTP/security challenge, browser lease conflict, run blocked needing a human. Bypasses quiet hours.
- **Tier 2 — daily digest:** approvals waiting and recruiter replies, delivered in one push at a user-chosen time.
- **Tier 3 — silent, in-app only:** zero-result follow-ups, learning updates, non-critical status.
- Quiet hours are configurable per tier; tier-1 always delivers.
- On a PC host, push only works while the PC is on — the UI says so and offers a catch-up digest on wake. On a VPS, pushes work 24/7.
- Every push delivery/failure is logged and visible in Doctor (VAPID/service-worker checks).

## Consequences
- Positive: critical alerts stay visible; far fewer interruptions; permission longevity.
- Negative: approvals may wait until digest time (acceptable: human submits anyway); push reliability depends on Android battery settings.
- Mitigations: battery-optimization setup screen; in-app badge always accurate; digest time configurable.

## Alternatives considered
- All notifications immediate: rejected (storm).
- Email-only alerts: rejected (latency, spam).
- No push (in-app only): rejected (verification would be missed).

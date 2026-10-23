# ADR-0007 — Verification walls freeze the agent and hand control to the user

- **Status:** Accepted
- **Date:** 2026-10-22
- **Related:** PLAN §2.8, PRD FR-VER-01..06, ADR-0002

## Context
Job sites present captchas, Cloudflare challenges, OTP/2FA, "unusual activity" and account-lock pages. Automatically solving or retrying them escalates risk and can misrepresent the user. The user explicitly wants to take control at these moments.

## Decision
On detecting any verification wall:
1. **Freeze immediately** — stop all browser actions, no retries, no clicks, no auto-solve. The page state is preserved.
2. **Notify instantly** (tier-1 push ≤5 s) with: site, full URL, verification type, **the PC**, run/job context, timestamp, screenshot.
3. **In-app card** offers "Take control" (deep link to the paused browser) and "I finished — resume". No timeout auto-continue; the run stays parked.
4. **OTP form** (web + PWA) with guidance: which mailbox account, search string, masked phone/email, validity window. Codes are redacted from logs and discarded after use.
5. **Verification Center** keeps active + past events per host with resume/abandon/re-check-session actions.

## Consequences
- Positive: human handles identity checks; no bypass attempts; incidents are explainable and logged; works remotely via phone.
- Negative: runs can stall until the user responds; requires reliable push (see ADR-0012/0016).
- Detection coverage matters: adapters/sites must expose challenge signals; unknown challenge pages default to freeze (safe failure).

## Alternatives considered
- Auto-solve via solver services: rejected (ToS, cost, fraud risk).
- Auto-retry/refresh: rejected (escalation).
- Skip the job silently: rejected (violates "no silent behavior").

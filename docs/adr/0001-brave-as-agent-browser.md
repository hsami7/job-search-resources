# ADR-0001 — Brave as the agent browser, Chrome as one-line fallback

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** user + build agent
- **Related:** PLAN §2.1, PRD FR-BRW-01/02, ADR-0002, ADR-0015

## Context
jobPilot drives a real Chromium browser for discovery and prefill. The user asked whether to use Brave (Shields: no ads/junk) instead of Google Chrome/Chromium. Two concerns were tangled: (a) does a browser choice reduce bot detection, and (b) does it improve scraping quality.

## Decision
Use **Brave** as the agent browser.

- Brave is Chromium, so CDP/Playwright work unchanged.
- Shields ON by default: strips ad iframes, popups, interstitials and consent junk on classifieds-style sites (marocannonces, job.ma, rekrute), improving DOM stability and parse speed.
- Google Chrome stable remains a **config-swap fallback** (executable path + remote-debugging args + update policy), requiring no code change.
- The W0 spike runs both browsers; **Brave wins unless the spike shows a concrete break** (login flow, submit handler, session stability).
- **"Forgetful browsing" is OFF, non-negotiable**, enforced by a setup gate and re-checked by Doctor.
- Shields are explicitly documented as **scraping-quality tooling, not anti-detection**. Privacy/anti-tracking features do not reduce ban risk.

## Consequences
- Positive: less DOM noise, fewer broken selectors, fewer accidental ad redirects; privacy side-benefit; same CDP stack.
- Negative/risks: third-party Chromium build can lag/divert from pinned Playwright expectations; per-site shield quirks may require overrides; Forgetful browsing would wipe sessions if misconfigured.
- Mitigations: version pin check + repair flow; driver abstraction + Chrome fallback; Doctor check for Forgetful state; W0 evidence-based choice.

## Alternatives considered
- **Google Chrome stable:** maximum Playwright compatibility; no ad blocking (noisier DOM). Kept as fallback.
- **Playwright-bundled Chromium:** more obviously non-user browser; rejected as primary.
- **Firefox:** CDP incomplete; rejected (possible future extension-assist path).
- **Anti-detect browsers (Multilogin/GoLogin/Camoufox):** out of scope, cost/complexity; not needed since prefill-only is the safety model.

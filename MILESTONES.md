# jobPilot — Milestones & Delivery Plan v1.0

**Source:** `PLAN.md` v6 + `PRD.md` v1.0
**Model:** single developer, part-time realistic view; durations assume ~15–20 focused hours/week. Add **+20% buffer**.
**Hard gates:** W0 (feasibility) and P0 (design pick) must pass before P1. No milestone ships without its **Exit Criteria** checked.

---

## Global Definition of Done (every milestone)

- [ ] All milestone P0 FRs demoed end-to-end on **the user's PC**.
- [ ] Structured logs + run trace exist for the new flows; no secret/OTP in logs (redaction test).
- [ ] Doctor includes checks for any new external dependency.
- [ ] Unit tests for deterministic logic (validators, dedupe, event replay); integration test for the milestone's main flow; adapter smoke tests with golden fixtures.
- [ ] Error states have user-facing copy ("what happened / why / what to do").
- [ ] Docs updated: README setup, ADR added if a new architectural decision was made.
- [ ] No P0 security issue: no plaintext secrets, no unauthenticated remote surface, no OTP persistence.
- [ ] Demo script recorded/written for the user.

---

## W0 — Feasibility Spike (gate)
**Window:** Week 0 · **Estimate:** 1 week · **Blocking:** yes

**Goal:** Prove the riskiest premise before spending on design: browser-driven discovery on real Moroccan sites, plus the safety handoff.

**Scope**
- Throwaway Node scripts (not production code): Playwright `connectOverCDP` to launched **Brave** and **Chrome** with dedicated profiles.
- Log into ReKrute + MarocAnnonces manually once; scrape listings with human pacing; measure selector stability across 3 runs.
- Paste-URL extraction on 1 LinkedIn job + 1 ReKrute job.
- **Generic extraction (ADR-0018):** measure `application/ld+json` JobPosting hit rate on ≥4 public postings from different platforms.
- **Remote take-control prototype** for a headless host (verification handoff, PLAN §2.8).
- One L2 API (Arbeitnow/Adzuna) fetch → normalize.
- Prototype: automation-artifact probes (trust-score signals) and a freeze-on-challenge check (detect a challenge page and stop).

**Deliverables**
- `spike/` scripts + raw results.
- `SPIKE-REPORT.md`: Brave vs Chrome table (login success, DOM cleanliness, submit integrity, detection quirks, session stability), pinned Playwright/browser versions, GO/NO-GO recommendation.
- If NO-GO: revised discovery proposal (L2-heavy) before any further work.

**Exit criteria**
- [x] ≥2 local sites scraped successfully in ≥2 consecutive runs each, OR a written NO-GO with re-plan.
- [x] Paste-URL works on both test links. *(LinkedIn deferred to the x86 PC — see report §3.6)*
- [x] Freeze-on-challenge prototype demonstrably stops all interactions.
- [x] Versions pinned and documented.

**Status: COMPLETE 2026-10-22 — verdict GO (3 conditions).** See `SPIKE-REPORT.md`. Chain: `npm run spike:smoke|trust|arbeitnow|generic|freeze|takecontrol|rekrute|marocannonces`. Deviations recorded in the report: Google Chrome cannot be tested on arm64 (deferred to PC); local sites need no login for discovery, so the "log in manually once" step was unnecessary; take-control was prototyped over CDP instead of noVNC.

**Risks:** anti-bot block >50% → pivot to L2 + paste-URL as primary for local sites; LinkedIn login challenge → rely on paste-URL only.

---

## P0 — UI/UX Design (gate)
**Window:** Week 1–2 · **Estimate:** 1–1.5 weeks · **Blocking:** yes

**Goal:** Choose one coherent design system for PC + PWA before writing UI code.

**Scope**
- 10 **distinctly different** design directions (layout, navigation model, density, visual language) as clickable mockups for: Dashboard, Jobs list, Triage/Approval, Verification card + OTP, Doctor, Logs, Search Scope, Agent setup (session-survival gate), Credentials, Data/backup, Onboarding, PWA approvals.
- Each direction presented with: rationale, tradeoffs, mobile behavior, component list.
- User picks one (or a mix); resulting **design tokens + component inventory** documented.

**Deliverables**
- `design/variants/01..10/` clickable mockups.
- `DESIGN-DECISION.md`: chosen direction, tokens (color/type/spacing), navigation model, accessibility notes.
- Component inventory mapped to PRD screens.

**Status: CHOSEN 2026-10-22 — 01 Command Deck, by the product owner.** Ten directions in `design/` (gallery at `design/index.html`, 01 marked chosen), shared real fixtures, screenshots in `design/shots/`, decision record in `DESIGN-DECISION.md` (frozen tokens, component inventory, comparison matrix kept for the record). All 15 PRD §7 screens are drawn in every direction (14 screens each; job detail and employer preview share one), plus screen 16 **Profile / my data** in 01; all 141 variant/screen pairs pass `node design/check.js`.

**Exit criteria**
- [x] 10 variants genuinely distinct (review checklist).
- [x] User sign-off recorded in `DESIGN-DECISION.md` §8.
- [x] Tokens + components cover 100% of PRD §7 screens (+16).

**Risks:** design churn → scope frozen; no new screens without a PRD change. The phone layout is the open question: 01 at 390 px works but is untested with real data, and 06 Soft Stack stays the documented fallback for the PWA only.

---

## P1 — Core Skeleton
**Window:** Weeks 3–8 · **Estimate:** 4–6 weeks

**Goal:** A runnable single-user app: onboarding, owned Brave profile, pipeline state machine, Doctor, Logs, live status, backups.

**Scope (PRD refs)**
- Node/Express + SQLite (WAL, busy_timeout), event log + projections, migrations.
- Onboarding wizard (≤5 min): OpenRouter key + default model, resume upload/parse + fit check, job type + locations, ToS/risk acknowledgement, **session-survival hard gate** (three prefs + cookie-restart test).
- Agent browser: launch Brave with persistent profile; lease TTL/heartbeat; boot orphan cleanup; version pin check; one manual login per site inside the owned profile.
- Manual run trigger + pipeline state machine (`DISCOVERED → …`, persisted-before-side-effect, idempotent steps, `INTERRUPTED` resume).
- OpenRouter adapter (structured output validation).
- Live WebSocket channel: run status, "doing now" panel, PC status.
- Doctor v1: all environment checks + browser trust score v1 + header display + run-anyway logging.
- Logs v1: structured logs + event log + live tail + basic filters + export bundle + redaction.
- Backups on by default; backup freshness in Doctor.

**Exit criteria**
- [ ] Fresh install → onboarding complete in ≤5 min (timed demo).
- [ ] Brave launches, profile persists across restarts; the session-survival gate blocks bypass.
- [ ] Manual run produces a persisted job pipeline record; kill -9 mid-run resumes to `INTERRUPTED` and recovers.
- [ ] Doctor catches induced failures (missing Tectonic, bad key, wrong cert) with PASS/WARN/FAIL.
- [ ] Logs show the run trace; export bundle opens; redaction test passes.
- [ ] PC status is visible and accurate; status transitions logged.

**Dependencies:** W0 GO; P0 chosen design. **Risks:** browser launch quirks per OS; resume parsing quality (mitigate with side-by-side correction).

**Progress 2026-10-22 — profile slice shipped.** Real server (`server/`), event log + profile projection, optimistic concurrency, resume storage under SHA-256, and the profile page (`web/`) in the chosen design. 13 tests pass (`npm test`). Decisions: ADR-0019 (built-in `node:sqlite`, `node:http`). Remaining for P1: onboarding, Brave profile/lease, pipeline, OpenRouter adapter, WebSocket, Doctor, Logs, backups.

---

## P2 — Discovery
**Window:** Weeks 9–12 · **Estimate:** 3–4 weeks

**Goal:** Real job inflow with honest, visible degradation.

**Scope**
- L1 adapters for W0-validated sites (≥2 local + ≥1 global where viable) with human pacing and adapter status.
- L2 APIs (Arbeitnow/Adzuna at minimum) + normalization.
- L3 paste-URL (web + PWA) and **WhatsApp/Facebook forwarded post** ingestion (text + screenshot OCR if feasible).
- Scam filter + signal/noise scoring + low-signal bucket + user-overridable thresholds.
- Multi-country/city fan-out; results grouped by location; per-source counts.
- Zero-result ask-first cards with tap-to-widen.
- Dedupe + CSV history import + "mark applied".
- Ollama adapter with **pause-not-downgrade** failover and draft-tier tagging.
- Trust score wired to run start + header.

**Exit criteria**
- [ ] A run over ≥2 countries and ≥2 cities produces normalized jobs with source/location provenance.
- [ ] Killing one source produces a visible per-source reason, no silent drop, no crash.
- [ ] Zero-result path gives actionable suggestions and re-runs only the widened combo.
- [ ] Duplicate from two sources is suppressed; imported applied job is skipped.
- [ ] OpenRouter outage mid-run pauses + notifies; no partial batch silently downgraded.
- [ ] Adapter break is detected and reported with the "paste URL instead" path.

**Risks:** local site churn; OCR quality; API rate limits.

---

## P3 — Tailoring & Review
**Window:** Weeks 13–16 · **Estimate:** 3–4 weeks

**Goal:** Honest, high-quality per-job documents with a deterministic gate.

**Scope**
- Profile → tailored resume + letter pipeline; Markdown→PDF first, then Tectonic LaTeX template set (EN; FR/AR per open questions).
- Claims validator (every claim traces to profile data) + required fields + injected-email/URL scan.
- Reviewer loop (≤3 iterations) with reviewer notes on failure; deterministic gate is authoritative.
- "What employer sees" preview + language policy + translation preview.
- Approval triage queue + rejection chips + learning panel + memory events.
- Artifact versioning + hashes; recompile skip when inputs unchanged.

**Exit criteria**
- [ ] 10 fixture jobs → 10 tailored PDFs; 0 unverifiable claims pass.
- [ ] Injected email/URL in a generated letter is blocked and explained.
- [ ] 3-iteration failure routes to approval queue with notes (no infinite loop).
- [ ] Rejecting with chips writes memory events; learning panel shows them; clearing works.
- [ ] Language mismatch case shows translation preview before approval.

**Dependencies:** P2 jobs; Tectonic decision. **Risks:** Arabic LaTeX layout; PDF fidelity expectations.

---

## P4 — Apply, Verification Center & Phone Access
**Window:** Weeks 17–22 · **Estimate:** 5–6 weeks (largest)

**Goal:** Complete the loop safely on the PC and make the phone a usable approval surface while the PC is on.

**Scope**
- Prefill-in-browser (hard rule: human Submit); form-field mapping per adapter; "doing now" panel.
- Approval rule engine (auto-approve = prepare prefills only) + bulk actions; send-hours; kill switch.
- Email: Gmail/Outlook OAuth, send + read, reply matching + unmatched lane, modes 1–2, content gate, translation preview, follow-ups draft, interview handoff card.
- **Verification Center:** freeze, tier-1 push with site/URL/type/screenshot, take-control deep link, resume/abandon, OTP entry + "where to find the code", history.
- Credential manager UI + audit trail; vault (AES-256-GCM), local only.
- **Phone access:** PWA over Tailscale Serve (preferred) or LAN, trusted TLS + VAPID + push tiers; auth before any non-loopback bind.
- PC install/start-on-boot; backup restore test; export/import for moving to another machine.

**Exit criteria**
- [ ] End-to-end: discover → tailor → approve → prefill → human submit → status/history, on the PC.
- [ ] Real verification event: agent freezes, push arrives ≤5 s with all required fields, OTP entry resumes the run.
- [ ] Phone PWA reachable over the chosen transport with authentication; tier-1 push delivered; digest scheduled; quiet hours respected.
- [ ] Credentials: stored encrypted, never in logs/LLM prompt; audit entries exist.
- [ ] Backup restore returns the app to the last saved state; export/import moves it to another machine with no merge.

**Risks:** OAuth app review delays; push reliability; phone TLS/auth setup; this milestone is the schedule risk — split into P4a (apply/verification) and P4b (phone access) if needed.

---

## P5 — Polish & Release
**Window:** Weeks 23–26 · **Estimate:** 3–4 weeks

**Goal:** Daily-usable v1 with diagnostics, data ownership, and learning visible.

**Scope**
- Skills toggles (hardcoded prompts; runtime deferred).
- Replies: modes 1–2 polished; interview handoff; follow-ups.
- Export/delete everything on this PC; backup restore test; retention/purge.
- Android push polish + battery-optimization setup screen.
- Analytics: sent/replies/interviews; source yield; approval time.
- Log retention/rotation polish; run timeline replay; error explainer improvements.
- Performance pass, accessibility pass (WCAG AA), docs, release checklist.

**Exit criteria**
- [ ] Full export → wipe → import restores the app state on the PC.
- [ ] Delete-everything verified (DB + profile + logs + artifacts) on the PC.
- [ ] Accessibility audit passes for triage, verification, logs.
- [ ] 2-week dogfood log: 0 silent failures; Doctor explains every blocked run.
- [ ] Release checklist signed; version tagged v1.0.

---

## P6 — Deferred backlog (no date)
Full Skills runtime (install-from-repo), networking mode, referral emails, compensation researcher, full-auto apply, auto account creation, reply mode 3, calendar write, multi-user, additional site adapters, LinkedIn/Indeed adapters if W0/production evidence supports them.

---

## Timeline summary

| Milestone | Weeks | Cumulative | Gate |
|---|---|---|---|
| W0 Spike | 1 | 1 | GO/NO-GO |
| P0 Design | 1–1.5 | ~2.5 | user sign-off |
| P1 Core | 4–6 | ~8.5 | demo + crash recovery |
| P2 Discovery | 3–4 | ~12.5 | multi-source run |
| P3 Tailoring | 3–4 | ~16.5 | honesty gate |
| P4 Apply/Verification/Phone | 5–6 | ~22.5 | E2E + verification + phone access |
| P5 Polish | 3–4 | ~26.5 | release checklist |

**Honest note:** ~26 weeks at 15–20 h/week. If the target is faster, cut P5 items and ship P1+P2+P3+P4a; do not compress W0 or the verification/prefill safety work.

---

## Cross-milestone tracking
- **Risk log:** one row per PLAN §13 risk, owner = user, reviewed at each milestone.
- **Decision log:** ADRs in `docs/adr/`; any deviation requires a new ADR or superseding note.
- **Change control:** new feature requests go to P6 unless they replace a P0 requirement; PRD/PLAN updated first.

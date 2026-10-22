# jobPilot — PRD v1.0

**Product:** jobPilot
**Doc status:** Draft for build
**Source of truth:** `PLAN.md` v5.2 (this PRD derives from it; where they conflict, PLAN wins and this PRD is corrected)
**Date:** Oct 22, 2026
**Owner:** single user/developer (self-hosted, single-user v1)

---

## 1. Problem & vision

### Problem
Searching for internships/jobs across multiple countries and local job sites (Morocco: ReKrute, MarocAnnonces, Job.ma; global: LinkedIn, Indeed) is repetitive and fragmented. Every application needs a tailored resume and cover letter, and high-volume manual applications are error-prone. Existing "AI apply" services are cloud-hosted, opaque, and untrustworthy with personal accounts.

### Vision
A **self-hosted job-search operator** that runs on the user's own PC or VPS, drives a browser the user controls, finds and filters real jobs, produces honest tailored documents, and **never submits anything without a human click**. When a site challenges the session, it stops and hands control to the user immediately.

### Product principles
1. **Human in control** — prefill-only, approval-gated, freeze-on-verification.
2. **Honest documents** — every claim traceable to the user's real data.
3. **Show your work** — Doctor, full logs, live host status, trust score.
4. **No silent behavior** — no silent source failures, no silent model downgrades, no silent sync overwrites.
5. **Local-first & owned data** — SQLite export, delete-everything, BYO infrastructure.

---

## 2. Goals & non-goals

### Goals (v1)
- G1: User can go from install → first tailored application in **≤ 15 minutes** (onboarding ≤ 5 min).
- G2: Discover jobs across a user-defined **multi-site, multi-country/city** scope with layered fallbacks.
- G3: Produce honest, ATS-sane, LaTeX-quality PDFs per job (English/French/Arabic targets).
- G4: Make approval fast via a **triage queue**, bulk actions, and rule engine — not blind volume.
- G5: Run on **PC or user VPS**, with laptop-cookie migration and **PC↔VPS sync** that never silently overwrites.
- G6: **100% of captcha/OTP/security challenges** are frozen + notified with actionable context (site/URL/type/host).
- G7: Diagnosability: every failure is visible in Doctor or Logs with a plain-language cause + export bundle.

### Non-goals (v1)
- Multi-user accounts / sharing / SaaS hosting.
- Fully automatic submissions (auto-submit is prohibited by design).
- Universal "any website" scraper or "full internet" crawler.
- Auto-solving captchas / OTP bypass.
- Auto account creation on third-party sites.
- Calendar write access / automatic interview booking.
- Full plugin runtime for Skills (hardcoded built-ins only).
- Networking mode, referral emails, compensation researcher (deferred to P6).

---

## 3. Persona & context

**Primary persona — "Yassine", 22, Morocco.**
- Final-year student / junior, applying to internships and entry-level roles.
- Targets Morocco + France + UAE + UK/US/Canada; reads French/Arabic/English.
- Uses a Windows/Linux laptop daily, has an Android phone, may rent a small VPS.
- Values: not missing openings, not writing cover letters from scratch, not getting his LinkedIn banned.
- Technical comfort: can paste an API key, run an installer/Docker, edit settings; not a developer.

**Secondary persona — "power user" (same person later):**
- Wants logs, trust score, custom sites, model pickers, self-hosting.

**Environment assumptions**
- PC can sleep/shut down; VPS is 24/7; phone is the main approval surface.
- Home network + Tailscale; sites are logged-in personal accounts.
- LLM budget small; Ollama fallback acceptable but suspect.

---

## 4. Core user journeys

### J1 — First run (≤ 5 min onboarding)
Install → open web UI → paste OpenRouter key (default model auto-selected) → upload resume (parse + fit check) → pick job types + at least one city/country (defaults pre-filled) → agent browser setup: Brave detected/installed, **Forgetful Browsing OFF confirmed** → optional cookie import from laptop → "Run first scan".

### J2 — Define search scope
Settings → Search Scope: add sites (marocannonces.com, job.ma, rekrute.com, LinkedIn, Indeed) → per-site adapter status visible → add countries (multi) + cities (multi) + "Remote/anywhere" → save. Scope is editable from PWA.

### J3 — Run & discover
Trigger run (UI/PWA/schedule) → Scout queries adapters/APIs → classifieds noise filtered → results grouped by location with per-source counts → zero-result card offers tap-to-widen suggestions.

### J4 — Tailor & review
Job → tailored LaTeX resume + cover letter (PDF) → deterministic honesty/claims checks → reviewer loop (≤3 iterations) → arrives in triage queue (Ready / Needs-you / Skip-pile) with reviewer notes if it failed checks.

### J5 — Approve & apply
Triage queue → bulk approve top N or individual card review → "what employer sees" preview + language translation preview → prefill in real browser → **user clicks Submit** → status updates; history/dedupe updated.

### J6 — Verification interrupt (critical journey)
Agent hits captcha/OTP → **freezes immediately** → tier-1 push + in-app card: site, URL, type, host (PC/VPS), screenshot → user taps "Take control" → solves or enters OTP in the card (with "where to find the code" guidance) → "I finished — resume" → run continues from persisted state.

### J7 — PC ↔ VPS
Settings → Run location → choose PC/VPS → migration wizard imports laptop cookies/logins into agent profile on target host → status pills show green/yellow/red per host → both online → auto-sync via Host Link → data page shows event counts/last sync; conflicts produce cards, never silent overwrite.

### J8 — Something broke
Header shows Doctor warning / trust score change → Doctor page lists FAIL/WARN with fixes → Logs show run timeline + "explain this error" → export diagnostic bundle → fix → re-run.

### J9 — Tune & learn
Reject jobs with reason chips → weekly "What I learned" panel shows applied rules → edit/clear rules → documents improve.

---

## 5. Functional requirements

Priority: **P0** = v1 must; **P1** = v1 should; **P2** = effort permitting. Every requirement is testable.

### 5.1 Onboarding (ONB)
- **FR-ONB-01 (P0):** Onboarding completes in ≤5 minutes with sensible defaults; OpenRouter key is the only required secret; per-agent model pickers optional.
- **FR-ONB-02 (P0):** Resume upload (PDF/DOCX) → parsed into a structured profile; parse-fidelity check shown side-by-side; user can correct fields before continuing.
- **FR-ONB-03 (P0):** Job-type selector (full-time / internship / both) + multi-location picker with defaults for Morocco.
- **FR-ONB-04 (P0):** Agent browser setup includes a **hard gate**: "Forgetful browsing is OFF" must be confirmed before proceeding (Copy: *"One non-negotiable setting: turn off 'Forgetful browsing' in the agent profile, or the persistent logins/cookies that everything depends on get wiped on every close. And the W0 spike tests both anyway — Brave wins unless the spike shows a concrete break."*).
- **FR-ONB-05 (P0):** Explicit ToS/ban-risk acknowledgment (plain language) before first run.
- **FR-ONB-06 (P1):** Onboarding can be paused and resumed; all steps saved.

### 5.2 Agent browser (BRW)
- **FR-BRW-01 (P0):** Backend launches and owns Brave (Chromium) with a persistent dedicated profile; never attaches to the user's everyday browser.
- **FR-BRW-02 (P0):** Chrome is a config-swap fallback (executable path, no code changes).
- **FR-BRW-03 (P0):** Forgetful Browsing OFF enforced at setup and re-checked by Doctor.
- **FR-BRW-04 (P0):** Browser lease: TTL + heartbeat; boot-time orphan cleanup; `INTERRUPTED` recovery from last persisted state.
- **FR-BRW-05 (P0):** Human pacing: randomized dwell/scroll/typing; **no daily volume caps** (removed by product decision).
- **FR-BRW-06 (P1):** Version pin check with one-click "re-pin/install matching browser".
- **FR-BRW-07 (P1):** Cookie import wizard (laptop Chrome profile → agent profile) with per-account session test.
- **FR-BRW-08 (P2):** Per-site shield-level overrides when a login/submit flow misbehaves.

### 5.3 Search scope (SCP)
- **FR-SCP-01 (P0):** Sites list CRUD with per-site **extraction mode** (`adapter`/`generic`/`api`/`paste`, ADR-0018), enable/disable, status (working/blocked/dead), last scan, jobs found, adapter availability.
- **FR-SCP-02 (P0):** Sites without an adapter **and** without structured job data show "paste a URL instead" guidance; no silent failure.
- **FR-SCP-03 (P0):** Multi-country + multi-city selection (two-level picker) + "Remote/anywhere".
- **FR-SCP-04 (P0):** Scope editable from PWA and desktop; every job records source site + location.
- **FR-SCP-05 (P1):** Per-site preferences: job type, language, priority, apply mode (hand-to-user allowed).

### 5.4 Discovery (DSC)
- **FR-DSC-01 (P0):** L1 per-site adapters for W0-validated sites with pacing.
- **FR-DSC-02 (P0):** L2 API sources (Arbeitnow, Remotive, Adzuna, JSearch, Greenhouse/Lever as applicable).
- **FR-DSC-03 (P0):** L3 paste-URL extraction (single job link) from PC and PWA.
- **FR-DSC-04 (P0):** L4 degradation: per-source reason surfaced, source parked for the day, never dropped silently.
- **FR-DSC-05 (P0):** Scam filter + classifieds signal/noise scoring; low-signal bucket default-hidden with one-tap reveal and user-overridable thresholds.
- **FR-DSC-06 (P1):** WhatsApp/Facebook forwarded post ingestion (text + screenshot OCR).
- **FR-DSC-07 (P0):** Job type targeting (internship/full-time/both).
- **FR-DSC-08 (P0):** Zero-results ask-first card; suggestions are actionable taps; no silent broadening.
- **FR-DSC-09 (P0):** Dedupe by URL + fuzzy company/role/location; skip already-applied.
- **FR-DSC-10 (P1):** CSV history import + manual "mark applied".
- **FR-DSC-11 (P0):** **Generic extraction (ADR-0018):** any public job URL → structured job record via `application/ld+json` `JobPosting`, then OpenGraph, then conservative heuristics. No per-site code. Extracts only from a page it was pointed at — no crawling, no discovery. Per-platform hit rate measured in W0; the UI claim is limited to what that evidence supports.

### 5.5 Tailoring & review (TAL)
- **FR-TAL-01 (P0):** Per-job tailored resume + cover letter as PDF (Markdown→PDF path first; Tectonic LaTeX when ready).
- **FR-TAL-02 (P0):** Hard honesty invariant: every generated claim traces to real profile data; claims validator blocks unverifiable claims.
- **FR-TAL-03 (P0):** Deterministic review gate (claims, required fields, injected emails/URLs) + advisory LLM rubric.
- **FR-TAL-04 (P0):** Max 3 self-improvement iterations, then route to approval queue with reviewer notes.
- **FR-TAL-05 (P0):** "What employer sees" preview (document + application payload).
- **FR-TAL-06 (P1):** Document language policy: per-site default language (site UI language or JD language), with side-by-side translation preview when the user may not read it.
- **FR-TAL-07 (P1):** "Local-model draft" tagging for any Ollama-generated artifact + quality gate flag.

### 5.6 Approval & discipline (APR)
- **FR-APR-01 (P0):** Triage queue with Ready / Needs-you / Skip-pile grouping; bulk approve/snooze; per-item preview.
- **FR-APR-02 (P0):** Approve-each default; no auto-send; **prefill-only hard rule** (human clicks Submit).
- **FR-APR-03 (P0):** Content gate blocks agent-written commitments, dates, salary figures, availability statements; foreign-language docs require explicit review.
- **FR-APR-04 (P0):** Send-hours window + kill switch ("pause all agents").
- **FR-APR-05 (P0):** Live "what jobPilot is doing now" panel (site, page, last action, host) in web + PWA.
- **FR-APR-06 (P1):** Auto-approve rule engine (match threshold, age, job type, site, language) that only prepares prefills.
- **FR-APR-07 (P1):** Rejection taxonomy chips + optional edit; learning panel with per-rule visibility/clear.

### 5.7 Email (EML)
- **FR-EML-01 (P0):** Gmail or Outlook OAuth (send + read); SMTP optional (P1).
- **FR-EML-02 (P0):** Reply tracking + job matching; **unmatched-reply lane** never force-matched.
- **FR-EML-03 (P0):** Reply modes 1 (notify + draft, approve each) and 2 (auto small confirmations only); mode 3 deferred.
- **FR-EML-04 (P0):** Every auto-sent draft passes content gate + preview; blocked categories require human edit.
- **FR-EML-05 (P1):** Follow-up reminders (N-day) as drafts.
- **FR-EML-06 (P1):** Interview-scheduling handoff card (suggested reply + slot proposal; human sends).

### 5.8 Verification Center (VER) — hard invariant
- **FR-VER-01 (P0):** On any captcha, OTP, 2FA, Cloudflare/security challenge, or account-lock page, the agent **stops all actions** (no clicks, no retries, no auto-solve).
- **FR-VER-02 (P0):** Tier-1 push within ≤5 seconds of detection containing: site, full URL, verification type, host (PC/VPS), run/job context, timestamp, screenshot.
- **FR-VER-03 (P0):** In-app card with "Take control" (opens/points to paused browser on the right host) and "I finished — resume".
- **FR-VER-04 (P0):** OTP entry field in web + PWA with guidance: which account (Gmail/Outlook), search string, masked phone/email, validity window; code redacted from logs and discarded.
- **FR-VER-05 (P0):** Verification Center history per host with resume/abandon/re-check session.
- **FR-VER-06 (P0):** No auto-continue on timeout; run stays parked until user acts.

### 5.9 Credentials & vault (CRD)
- **FR-CRD-01 (P0):** Per-site credential manager (username, password, optional TOTP secret, notes); AES-256-GCM encrypted.
- **FR-CRD-02 (P0):** Plaintext credentials never enter LLM context or logs; every use audited.
- **FR-CRD-03 (P0):** Reveal/copy requires vault passphrase; recovery code shown once.
- **FR-CRD-04 (P0):** "Do you have an account on site X?" flow: manual login or stored creds; no account auto-creation.

### 5.10 Doctor & trust score (DOC)
- **FR-DOC-01 (P0):** Doctor runs at startup, before runs, and on demand; all checks with PASS/WARN/FAIL + explanation + fix.
- **FR-DOC-02 (P0):** Required FAIL blocks runs unless user explicitly overrides (override logged).
- **FR-DOC-03 (P0):** Browser trust score 0–100 with category breakdown and band labels (Safe/Caution/Risky), clearly marked heuristic; shown in header + Doctor; logged at run start.
- **FR-DOC-04 (P0):** Checks cover: Node/OS, SQLite integrity/WAL, disk, permissions, Tectonic, Playwright+browser versions, browser launch/profile, cookie health, Tailscale/HTTPS cert, VAPID push, OpenRouter key, Ollama, email OAuth scopes/token, vault state, clock/timezone, backup freshness, sync conflicts, log dir.
- **FR-DOC-05 (P1):** "Explain this error" from a Doctor/Log line with likely cause + fix.

### 5.11 Logging & diagnostics (LOG)
- **FR-LOG-01 (P0):** Structured app logs (JSON lines, rotating) + SQLite event log + per-run traces (runId/jobId/agentId).
- **FR-LOG-02 (P0):** Logs page: live tail via WebSocket, filters (host/level/agent/job/site/category/time/runId), search, copy, download.
- **FR-LOG-03 (P0):** Mandatory redaction (passwords, cookies, tokens, keys, OTPs, email bodies); OTP shown as "submitted (redacted)".
- **FR-LOG-04 (P0):** One-click diagnostic bundle export (redacted logs, recent events, Doctor report, versions, config snapshot).
- **FR-LOG-05 (P0):** All connection-state transitions (green/yellow/red) and verification events are logged.
- **FR-LOG-06 (P1):** Retention config (default 30 days app logs), purge from UI.
- **FR-LOG-07 (P1):** Per-run timeline replay view.

### 5.12 PC ↔ VPS & sync (SYN)
- **FR-SYN-01 (P0):** Host status pills for PC and VPS (green = connected/reachable/synced; yellow = connecting/reconnecting/syncing; red = offline/diverged), plus active run-host badge; click for detail.
- **FR-SYN-02 (P0):** Local-first SQLite per host; append-only event log is the source of truth; derived tables replay deterministically.
- **FR-SYN-03 (P0):** Sync over Tailscale WebSocket ("Host Link") with watermarks + hash verification; log deltas.
- **FR-SYN-04 (P0):** Only one host may run agents at a time; run-host handoff = drain → sync → switch.
- **FR-SYN-05 (P0):** Security-relevant settings conflicts produce a user-resolved conflict card; cosmetic settings use timestamp+hostId tiebreak; never silent overwrite.
- **FR-SYN-06 (P0):** Credentials sync only as E2E-encrypted blobs; decryption local on unlock.
- **FR-SYN-07 (P0):** "Where is my data" page: per-host DB size, event count, last sync, hash status, backup freshness.
- **FR-SYN-08 (P1):** Automatic reconnect/backoff and a "sync now" button.
- **FR-SYN-09 (P1):** Offline edits on both hosts merge without data loss; double-application prevention via synced dedupe + run-host lock.

### 5.13 Deployment (DEP)
- **FR-DEP-01 (P0):** Same codebase runs on PC (default) or user VPS; host choice in settings; relocatable.
- **FR-DEP-02 (P0):** VPS packaging (Docker or install script) with persistence for profile + DB + logs.
- **FR-DEP-03 (P0):** PWA over Tailscale `*.ts.net` + Let's Encrypt (self-signed forbidden) + VAPID keys; installable Android.
- **FR-DEP-04 (P0):** Migration wizard: laptop → target-host cookies/logins; PC → VPS DB/profile relocation.

### 5.14 PWA & notifications (PWA)
- **FR-PWA-01 (P0):** Installable PWA: approve/reject, status pills, verification cards + OTP entry, trigger run, paste URL, scope editing.
- **FR-PWA-02 (P0):** Push tiers: tier-1 critical (verification, lease conflict) instant; tier-2 daily digest (approvals/replies) at a chosen time; tier-3 silent in-app.
- **FR-PWA-03 (P0):** Quiet hours per tier; tier-1 bypasses quiet hours.
- **FR-PWA-04 (P1):** Android battery-optimization exemption setup screen with explanation of late pushes.

### 5.15 Data ownership (DAT)
- **FR-DAT-01 (P0):** Export everything (profile, jobs, applications, artifacts, memory, event log, logs, credential blobs) from both hosts; SQLite is the export format.
- **FR-DAT-02 (P0):** Delete everything on both hosts, including VPS artifacts.
- **FR-DAT-03 (P0):** Backups on by default (scheduled copy or litestream); freshness shown in Doctor.

---

## 6. Non-functional requirements

- **NFR-SEC-01:** Vault AES-256-GCM with passphrase-derived key; recovery code shown once; no plaintext secrets in logs/DB projections/LLM prompts.
- **NFR-SEC-02:** HTTPS only (Tailscale ts.net + Let's Encrypt); no self-signed in production flow.
- **NFR-SEC-03:** Redaction is enforced at the logging layer, not per-call-site.
- **NFR-PRV-01:** Single-user, no third-party backend besides user-chosen providers; data export/delete covers both hosts.
- **NFR-REL-01:** All state transitions persisted before side effects; every side effect idempotent or guarded by an outbox; crash recovery to `INTERRUPTED` with resume.
- **NFR-REL-02:** SQLite WAL + `busy_timeout=5000`; single-writer discipline; integrity check in Doctor.
- **NFR-OBS-01:** 100% of runs produce a run trace; every failure maps to a Doctor check or Log entry with a user-facing cause.
- **NFR-PERF-01:** UI interactions ≤200 ms p95 locally; log tail latency ≤1 s; verification notification dispatch ≤5 s.
- **NFR-PERF-02:** Resume compile ≤60 s per job on mid-range hardware; reruns skip recompilation when inputs unchanged.
- **NFR-I18N-01:** Document languages EN/FR/AR supported (UI in EN initially); per-site language policy; translation preview for review.
- **NFR-A11Y-01:** WCAG 2.1 AA for the chosen design; keyboard-operable triage queue; accessible status pills (text + color).
- **NFR-PORT-01:** Runs on Linux (primary), Windows 10/11, macOS; browser binary path configurable.
- **NFR-SCALE-01:** Designed for one user, up to ~10k jobs and ~1k applications without UI degradation.
- **NFR-MAINT-01:** Adapter contract + golden fixtures; adding a site adapter touches only `adapters/<site>`.
- **NFR-LEGAL-01:** Onboarding + per-site warnings state that automation may violate site ToS and bans can be permanent; no claims of immunity.

---

## 7. UX requirements — required screens

1. **Dashboard** — run status, triage summary, status pills, trust score, kill switch.
2. **Jobs / Results** — grouped by country/city, source counts, signal/noise buckets, zero-result card.
3. **Job detail** — posting, matched profile facts, tailor action, reviewer notes.
4. **Approval / Triage queue** — Ready / Needs-you / Skip-pile, bulk actions, preview drawer.
5. **"What employer sees"** — final PDF + application payload + translation preview.
6. **Verification Center** — active/past events, host tag, screenshot, OTP form, take-control, resume.
7. **Doctor** — checks + trust score breakdown + fixes + run-anyway (logged).
8. **Logs** — live tail, filters, run timeline, explain error, export bundle.
9. **Search Scope** — sites CRUD + locations multi-select + adapter status.
10. **Credentials** — per-site encrypted entries + audit trail.
11. **Data & Sync** — PC/VPS cards, sync status, conflict cards, backups, export/delete.
12. **Settings** — LLM keys/models, schedule, send-hours, language, deployment.
13. **Agent setup** — browser choice, Forgetful-OFF gate, cookie import guide.
14. **Onboarding wizard** — 5-minute path with defaults.
15. **PWA mirror** — approvals, verification/OTP, pills, run trigger, scope edit.

Required UX behaviors:
- Every long-running action shows progress + host + current site.
- No destructive action without explicit confirmation (delete, purge, run-anyway, abandon run).
- Empty states always explain what was checked and what to do next.
- Color is never the only signal (pills carry text labels).

---

## 8. Data model (overview)

**Domain tables:** `jobs`, `applications`, `artifacts` (resume/letter versions, hashes), `approvals`, `approval_rules`, `rejections` (chips), `memory_rules`, `settings`, `sites`, `scope_locations`, `credentials` (encrypted blobs), `verification_events`, `doctor_results`, `runs`, `run_steps`.
**Infrastructure:** `event_log` (append-only, `id`, `host_id`, `seq`, `type`, `payload`, `created_at`, `hash`), `sync_state` (per-table watermarks/hashes), `host_state` (heartbeat), `lease`.
**Projections:** all domain tables are derived from `event_log`; rebuild is supported and verified by hash.
**Artifacts:** PDFs + LaTeX sources stored on disk with content hashes; DB stores metadata.

---

## 9. Constraints & assumptions
- Single user; no accounts/auth beyond a local session + vault passphrase.
- PC may sleep; VPS may be slow; network may drop mid-run.
- LLM output is untrusted: always validated deterministically.
- Job sites change DOM without notice; adapters must fail loudly, not silently.
- No guarantee any browser configuration avoids bans; the product must say so.

## 10. Dependencies
- Node.js LTS, Express, SQLite (better-sqlite3), Playwright, Brave/Chrome binaries.
- Tectonic (optional initial), LaTeX templates.
- OpenRouter API; Ollama (optional).
- Gmail / Microsoft Graph OAuth apps (user-provided credentials).
- Tailscale + Let's Encrypt; web-push/VAPID.
- Optional: OCR engine for forwarded post screenshots.

## 11. Risks
See `PLAN.md` §13. PRD-level top risks: browser automation breakage, false sense of safety from trust score, approval fatigue mitigated by triage, sync conflicts, credential compromise. Each has a mitigation in PLAN and an ADR.

## 12. Success metrics
- **SM-1:** Onboarding completion ≤5 min for a new user; ≥90% of started onboardings finish.
- **SM-2:** Time from run trigger → first tailored application prefill ≤15 min (excluding human review).
- **SM-3:** Verification events notified ≤5 s; 100% frozen (0 auto-actions after detection).
- **SM-4:** Zero silent source failures: every failed source produces a UI reason + log entry.
- **SM-5:** Approval workload: median ≤2 min per application; bulk-approve used in ≥50% of sessions.
- **SM-6:** Sync: 0 silent data overwrites; every conflict surfaced; post-sync hash verification passes ≥99.9% of syncs.
- **SM-7:** Doctor explains ≥95% of blocked runs with an actionable fix.
- **SM-8:** Honesty: 0 unverifiable claims pass the deterministic gate (target 100% block rate in fixtures).

## 13. Release criteria (v1)
- All P0 FRs implemented and demoed end-to-end on both PC and VPS.
- W0 spike GO report archived; adapters for ≥2 local sites + ≥1 API source working; generic extraction measured on ≥4 public postings from different platforms.
- Verification freeze demonstrated with a real captcha/OTP (or controlled test fixture).
- Doctor has 0 FAIL on a clean install; Logs export bundle opens and is redacted.
- Sync tested with both hosts online/offline, including one forced conflict resolved via card.
- Export/delete verified on both hosts.
- No known P0 security defect (secret leakage, unencrypted credential, OTP in logs).

## 14. Out of scope / deferred (P6)
Full skills runtime; networking mode; referral emails; compensation researcher; full-auto apply; auto account creation; reply mode 3; calendar write; multi-user.

## 15. Open questions
1. Which VPS provider/OS does the user actually have (Docker availability)?
2. Which exact Moroccan sites are must-have adapters beyond rekrute/marocannonces/job.ma?
3. Target document languages: EN/FR/AR — is Arabic resume layout required in v1?
4. Monthly LLM budget and preferred OpenRouter models per agent?
5. Gmail vs Outlook as the primary mailbox for v1?
6. Is Ollama fallback required at launch or acceptable in P2?
7. Tectonic acceptable as a required binary, or must PDF work without it at launch? (Plan: Markdown→PDF first, Tectonic at P3.)
8. Does the user want the agent browser to run headless overnight on the VPS, or always headed (Xvfb)? (Default: headed when a display exists; Xvfb on headless VPS with documented trust-score impact.)

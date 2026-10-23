# jobPilot — PLAN v6 (PC-only; one local data store, Oct 22 2026)
**Status:** v6 supersedes v5.2's two-machine design. **The app runs on the user's PC only.** There is no remote-host deployment target, no multi-machine sync, no Host Link, no conflict cards, and no run-location setting in v1. If the user later wants to run the same app on another machine, he installs it there and that machine keeps its own local data; moving is a manual stop → copy/export → start, never a live merge.
**v6 principles:** (1) prove the browser drive works before any design; (2) NO artificial volume caps — pacing + send-hours + approval gate; (3) per-site adapters, not a magic universal scraper; (4) every crash state has a defined recovery; (5) the user approves everything by default; (6) the app must SHOW its own health and history (doctor + full logs); (7) when a human check appears (captcha/OTP/security challenge), the agent FREEZES and hands control to the user immediately — never auto-solves anything; (8) **one host, one local data set**: the append-only event log is the source of truth on this PC, with no second writer and no silent overwrite path.

**What changed in v6 (the only deltas that matter):**
- Backend target: **PC only**. No remote host is part of the v1 architecture, deployment, onboarding, or tests.
- Removed: multi-machine sync, Host Link, watermarks, conflict cards, multiple host pills, two-host data pages, run-host handoff, relocation wizard, remote-host packaging.
- Cookie import from a laptop is not needed: the agent browser runs on the same PC as the user's everyday browser. The v1 login story is **one manual login in the agent browser**, persisted in its own profile.
- Portability if the user ever changes machine: stop the app, copy `data/` (SQLite + artifacts) or use Export, start the app there. No merge, no live sync.
- Phone access remains: the PWA reaches the PC over the LAN or Tailscale while the PC is on. Push only fires while the PC is on; missed runs are offered once on wake.

---

## 1. What jobPilot is (per the user)
A Node.js + JavaScript web app. The backend runs on **the user's PC** (§2.4). It drives a **Chromium-family browser it launches and owns** — final pick **Brave** (§2.1) — via CDP. The user launches runs from the Android PWA or PC web UI. Agents find jobs/internships, write tailored LaTeX resumes + cover letters per job (honest — never fake seniority), review in a loop with a critic agent, and apply via **prefilled forms the user submits** or approved email. LLMs: OpenRouter with local Ollama fallback. Emails: Gmail or Outlook. Skills system included. The app ships with a **Doctor** (health self-check + browser trust score), **full logs** (viewable/exportable), a **live PC/browser status**, a **verification/OTP center**, and an **encrypted per-site credential manager**.

**Confirmed scope decisions:**
- Single-user for v1.
- Backend runs on the user's PC. If he later runs the same app on another machine, that machine has its own local data; there is no live sync.
- "Mostly JS, but a non-JS tool (e.g. LaTeX compiler binary) is OK where needed."

## 0. Feasibility spike — WEEK 0 GATE (before ALL design/build)
1. CDP drive of a launched-and-owned Chromium profile can log in + extract listings from `rekrute.com` + `marocannonces.com` with human pacing — **tested with BOTH Brave and Google Chrome (§2.1)**.
2. An L2 API (Arbeitnow/Adzuna) flow works.
3. Paste-URL extraction works on 1 LinkedIn posting + 1 ReKrute posting.
**If the spike fails, or LinkedIn blocks the test session → re-plan discovery (L2-heavy) BEFORE building anything.** Spike pins Playwright + browser versions, documents observed detection behavior, and compares Brave vs Chrome on: login success, DOM cleanliness (ads/junk), submit-flow integrity, detection quirks. No P0/P1 until the spike report says GO. **[v5.2] The spike also prototypes the Doctor's browser trust-score probes and the verification-freeze handoff.**

## 2. Architecture
```
Android PWA / PC Web UI  (live via WebSocket)
        │ HTTPS (localhost + LAN; Tailscale ts.net for the phone)
        ▼
Node.js backend (Express) — single user, runs on the user's PC
 ├─ SQLite in WAL mode, busy_timeout=5000 (jobs, applications, artifacts, memory,
 │   creds, settings, approvals, event_log, schedule, lease, host_state)
 ├─ Agent orchestrator (state machine; idempotent agents; every transition persisted
 │   BEFORE its side effect)
 ├─ Browser Driver (launches & OWNS Brave; Chrome config fallback on this PC; NEVER
 │   attaches to the user's everyday browser)
 ├─ Source layer (per-site adapters / APIs / URL capture) with layered fallbacks
 ├─ Email layer (Gmail/Outlook OAuth; send gated by content rules)
 ├─ PDF/LaTeX layer (Tectonic; Markdown→PDF first)
 ├─ Push notifications (web-push, VAPID, 3 tiers; verification alerts are tier 1)
 ├─ Doctor service (environment checks + browser trust score 0–100)
 ├─ Logging service (structured logs + event log + UI log viewer + export bundle)
 ├─ Verification Center (freeze → notify → user takes control → resume)
 ├─ Encrypted credential manager (per-site user/pass, never enters LLM context)
 └─ Skills runtime (P6; v1 built-ins are hardcoded prompt files)
```

### 2.1 Browser driver & crash semantics (final browser decision)
- **FINAL: agent browser = BRAVE**, launched and owned by the backend. Chromium → CDP/Playwright stack unchanged. Shields strip ad iframes/popups/interstitials/consent junk → cleaner DOM, faster parses, fewer broken selectors on ad-heavy local sites (marocannonces/job.ma/rekrute). UA mimics Chrome.
- **What Brave does NOT do (onboarding + docs state this plainly):** Shields give ZERO anti-detection protection. Detection keys on automation artifacts, behavior and login identity — not fingerprint noise. Ban mitigation = prefill-only hard rule, owned-browser isolation, human pacing, approval gate. Shields = **scraping-quality tooling only**.
- Shield config: Shields ON (default); **session-survival gate — NON-NEGOTIABLE** (hard UI gate, §10): `browser.clear_data.cookies_on_exit=false`, `browser.clear_data.browsing_history_on_exit=false`, `session.restore_on_startup=1`. Brave 1.98.60 has **no global "Forgetful Browsing" toggle**; the UI must never claim one. Per-site shield levels driver-managed if a flow misbehaves.
- Fallback: Google Chrome stable = one-line config swap. W0 spike runs both; **Brave wins unless the spike shows a concrete break.**
- **Ownership:** backend launches/owns its own browser process (persistent dedicated profile, `--remote-debugging-port`, pinned Playwright + pinned browser build, update policy handled). Never attaches to the user's everyday browser.
- Login seeding: the user signs in once inside the agent browser on this PC; no cookie import in v1.
- **Browser lease (backend-internal):** TTL + heartbeat; crash/PC-sleep → lease expires on boot; boot orphan check closes stale tabs and requeues interrupted runs.
- **Defined failure states:** browser killed mid-run → `INTERRUPTED`, resume from last persisted state (idempotent steps; payloads persisted first); PC sleep/power loss → same path, scheduled resume re-queues (never bursts); Playwright/browser version mismatch at startup → clear UI error + "re-pin/install matching browser" button.
- **Human-like pacing stays.** **ALL day-volume caps remain REMOVED by user decision.** Discipline = pacing + send-hours + approval gate.

### 2.2 Apply-depth modes
1. **Prefill only — HARD RULE for v1.** System auto-fills; the HUMAN always clicks Submit. Invariant for personal accounts, not a toggle. (Full-auto deferred beyond v1.)
2. **Hand-to-user** — clipboard/deep-link/assistant.

### 2.4 Run location: the PC
- **The backend runs on the user's PC.** Nothing else is a deployment target in v1.
- Runs happen while the PC is on. If the PC was asleep/off at a scheduled time, the next boot offers **"run the missed scan now?"** once; it never bursts or backfills silently.
- The agent browser is launched and owned by the backend on this PC, with its own persistent profile. It never attaches to the user's everyday browser.
- **Login story:** sign in once in the agent browser for each site that needs it; the session persists in the agent profile. If a site challenges it, the Verification Center freezes and hands control to the user (§2.8). No cookie-copy wizard in v1 — the browser is already on the same machine.
- **If the user later decides to run the app on another machine**, he installs the same code there. That machine keeps its own `data/` and its own agent profile. Moving means stop → copy `data/` (or Export) → start there. There is no live sync and no dual-write.
- **Security:** profile + SQLite on the user's own disk; secrets AES-256-GCM (§6); phone access over LAN or Tailscale `*.ts.net`; no third-party hosting.

### 2.5 Single local data store (no sync)
- One SQLite DB + one agent profile on this PC. The **append-only event log is the source of truth**; all tables (jobs, applications, memory, approvals, settings) are deterministic projections replayed from it. Memory is stored as events too (`memory.rule_added`, `memory.reject_reason`, etc.).
- **Crash recovery:** every state transition is persisted before its side effect; projections rebuild from the log on boot if missing.
- **Backup:** scheduled `VACUUM INTO`/file copy of the SQLite DB + artifacts; backup freshness is a Doctor check. A backup is not a sync target.
- **Export:** one archive with DB + artifacts + logs (secrets redacted where applicable). **Delete:** wipes the DB, artifacts, logs, and agent profile on this PC.
- No watermarks, hashes, conflict cards, host handoff, or remote mirror. A second machine is a separate install, not a peer.

### 2.6 [v5.2] Doctor — environment health + browser trust score
- **One "Doctor" page + one CLI/`doctor` check**, run at startup, before every agent run, and on demand. Every check returns: PASS / WARN / FAIL, what was checked, why it matters, and a one-click fix or exact instructions. FAIL on required items **blocks runs** (with an explicit "run anyway" that is logged).
- **Checks:** Node + OS versions; SQLite WAL/integrity (`PRAGMA integrity_check`), disk space; write permissions; Tectonic binary + LaTeX compile smoke test; Playwright + Brave/Chrome versions pinned and matching; browser launch + persistent profile writability; profile/cookie health (logged-out sites listed); LAN/Tailscale reachability + HTTPS cert validity/expiry for phone access; VAPID push keys + service worker registration; OpenRouter key validity + connectivity; Ollama installed/models/list; email OAuth token validity + send/read scope check; vault locked/unlocked; system clock + local timezone; backup freshness; log directory health.
- **Browser trust score 0–100%** (heuristic, explicitly labeled "an estimate, not a guarantee"):
  - Categories: (a) automation artifacts (`navigator.webdriver`, CDP listeners/debug state, `window.chrome` gaps, headless markers), (b) fingerprint consistency (UA ↔ platform ↔ WebGL/canvas/AudioContext coherence, screen metrics), (c) network/timezone coherence (timezone vs IP geo, WebRTC leaks), (d) session health (logged-in state, session age, recent challenges), (e) shield/config integrity (session-survival prefs, Shields state; no "Forgetful" toggle claim).
  - Bands: **80–100 Safe · 60–79 Caution · 0–59 Risky**; show the per-signal breakdown + concrete fixes ("your timezone doesn't match your network location → set the PC/browser timezone to X", "Headless flag detected → relaunch in headed mode").
  - Score is recorded at the start of every run, shown in the Doctor page and the UI header, and logged. **Low score warns but never silently blocks the user's decision** (blocking only for hard environment failures).
  - The score is never presented as a promise of ban-immunity; the UI states that bans are always possible (see §13).

### 2.7 [v5.2] Full logging & diagnostics
- **Three layers:** (1) structured app logs (JSON lines, pino-style, rotating files per day, size-capped) for everything — browser actions, navigation, selector matches/failures, network errors, LLM calls (model, tokens, cost, latency), email ops (send/read/match), verification events, Doctor results, user actions, push delivery; (2) the SQLite `event_log` as the domain history; (3) a lightweight `run_trace` grouping all log lines under runId/jobId/agentId so one run can be replayed end-to-end.
- **UI Logs page:** live tail via WebSocket; filters (level, agent, job, source site, category, time range, runId); search; copy line; "explain this error" (plain-language summary + likely cause + fix); per-run timeline view; download.
- **Export diagnostic bundle:** one click → zip with redacted logs, last N events, Doctor report, host state, versions, config snapshot (secrets redacted). A support-friendly artifact for "where did this come from?".
- **Redaction:** a mandatory redaction layer keeps passwords, cookies, tokens, API keys, OTP codes, and email contents out of logs. OTP values are logged only as "OTP submitted (value redacted)". Log retention configurable (default 30 days app logs, event_log kept; purge from UI).
- Every log entry carries: timestamp, hostId, runId, jobId, agent, level, event, url/site, duration. **All connection-state and verification events are logged too** (per user request).

### 2.8 [v5.2] Verification Center: captcha / OTP / security challenge
- **Hard rule: the agent FREEZES and never acts.** On any verification wall (captcha, Cloudflare challenge, SMS/email OTP, "unusual activity", 2FA, account lock, security question): it stops the flow immediately, captures nothing further, and **instantly** notifies (tier-1 push + in-app card + log entry). No auto-solve, no retry, no clicking through — by user design.
- **Notification + card contents (exactly what the user asked for):** website, full URL, verification type (captcha / email OTP / SMS OTP / security challenge / verification page), **which PC/browser it happened on**, run/job context, timestamp, screenshot, and a **"Take control"** action that opens/points at the paused browser tab (deep link to the agent browser on this PC).
- **Take-control flow:** user completes the check in the real browser (or via the card's OTP field), then presses "I finished — resume" and the agent resumes from the persisted state. If the user doesn't respond, the run stays parked (no timeout auto-continue).
- **OTP / code entry (web UI + PWA):** a form asking for the code, with guidance showing **where to find it**: which Gmail/Outlook account it went to, the search string to use ("from:no-reply@… newer:10m", "jobPilot verification"), masked destination phone/email (**which one** — e.g. "+212 6•••••••" or "h•••@gmail.com"), and how long it's valid. Submitting resumes the flow. Codes are never stored (value redacted in logs, discarded after use).
- Dedicated **Verification Center page** listing active + past events on this PC, with "resume", "abandon run", and "re-check session" actions.
- Verification events aggregate into Doctor/session-health signals and the browser trust score.

## 3. Discovery & layered fallback chain
1. **L1 — Real-browser scraping (primary):** per-site **adapters** for the user's chosen sites, human-paced. **[ADR-0018]** A site entry has a **mode**: `adapter` (search results/pagination/login walls), `generic` (no per-site code: `application/ld+json` JobPosting → OpenGraph → conservative heuristics; works on public job pages, cannot discover), `api`, or `paste`. Still no generic DOM-guessing scraper and no "full internet" mode — generic extraction reads only a page it was pointed at; sites without an adapter or structured data route to paste-URL with a clear UI note.
2. **L2 — Public APIs (fallback):** Arbeitnow, Remotive, Adzuna, JSearch, Greenhouse/Lever boards.
3. **L3 — Paste-URL capture:** paste any job link (PC UI or PWA) → browser opens & extracts. **WhatsApp/Facebook channel:** forward/paste text + screenshots from group postings → OCR + text parse.
4. **L4 — Notify & degrade:** surface per-source why (blocked/dead/unparsed), park it for the day, never silently drop.
- **Signal-vs-noise filter (Morocco-critical):** beyond scam patterns, classify classifieds-style quality (unpaid/underpaid internships, "stage non rémunéré", 12h/day, franchise offers) → scored, default-hidden "low signal" bucket with one-tap reveal and user-overridable thresholds.
- **Job type targeting:** full-time, internships, both.
- **Triggers:** manual-only or manual + scheduled; pause/stop anytime; calendar day-picker.
- **PC-off resilience:** missed-run detection on boot offers "run missed scan now?" once, never bursts.

### 3.1 Search scope: websites & locations (user-requested)
- **Websites (list):** editable (marocannonces.com, job.ma, rekrute.com, LinkedIn, Indeed…). Rows: **mode (adapter / generic / api / paste) [ADR-0018]**, enabled, status, last scan, jobs found. No adapter and no structured data → paste-URL note. (No full-internet toggle — L2 aggregates + generic extraction cover broad reach.)
- **Locations (multi-lists):** countries AND cities, multiple at once (Morocco + France + UAE + UK + USA + Canada; cities Casablanca/Paris/Dubai/London/New York in one run). Country multi-select + optional cities; "Remote/anywhere"; results grouped per location; per-location zero-result suggestions widen only that combo.

## 4. Agent pipeline
```
DISCOVERED ─▶ TAILORED ─▶ REVIEWED ─▶ AWAITING_APPROVAL ─▶ (user) SUBMITTED
                ▲              │ FAIL (max 3 iterations → approval queue + reviewer notes)
                └──────────────┘
```
1. **Scout** — §3 chain; normalizes; scam + signal/noise filters with visible reasons.
2. **Tailoring** — profile + parsed resume + JD → LaTeX resume/cover letter. **Honesty rule:** every claim traces to real data; gap jobs applied honestly, never fabricate.
3. **Reviewer** — deterministic checks (claims, required fields, injected emails/URLs) are the gate; LLM rubric advisory; max 3 iterations → approval queue with notes.
4. **Submission** — prefills only; human submits; send-gated content rules (§9).

### 4.1 LLM providers
- Primary OpenRouter (per-agent pickers), fallback local Ollama; both fail → pause + push. **NO mid-batch downgrade** — pause + notify instead.
- **Ollama docs are DRAFT-TIER:** approval queue only, tagged "local-model draft — review carefully"; per-document quality gate (fluency + language) flags weak outputs.

### 4.2 Skills: v1 = 8 starter skills as hardcoded prompt files with global enable/disable toggles (install-from-repo runtime deferred to P6).

### 4.3 Memory & rejection→learning loop
- **Rejection taxonomy:** 1–3 reason chips (`wrong sector / wrong seniority / bad format / too long / scam slipped / language / remote-vs-onsite / salary / spam`) + free text/optional edit. Stored with job + document version as memory events.
- **Learning triggers:** edits → diffed → style rules (claim/format/tone). Rejects-down company/sector → targeting weight down. Scam slip → filter pattern updated.
- **Observable learning:** weekly "What I learned" panel; reviewable/clearable rules.
- **Memory is event-logged**; the learning panel shows when each rule was recorded.

## 5. Email
- Gmail (OAuth) or Outlook (OAuth), SMTP optional.
- Reply tracking: reply → job match; **unmatched-reply lane** shown separately, never force-matched.
- Reply modes: (1) notify + draft, user approves every reply (default); (2) auto small confirmations only. **Content gate + preview mandatory; commitments/dates/salary/availability BLOCK auto-send.** Full-auto replies deferred.
- **Interview handoff:** recruiter proposes slots → card with suggested reply + "propose these slots"; booking via human click (no calendar write access in v1).
- Follow-ups: auto-drafted N-day nudges, user sends.

## 6. Accounts, credentials & vault [v5.2 expanded]
- **Per-site credential manager in Settings:** for every site, the user stores username + password (+ optional 2FA/TOTP secret, notes) — **AES-256-GCM encrypted**, indexed per site, never sent to any LLM, used only to fill the browser session when needed. Reveal/copy requires the vault passphrase; every use is audited (`credential.used` log entry + UI history).
- "Do you have an account on site X?" → yes: manual login at the moment needed, or stored creds (auto-filled); no: signup link (user does it in the agent window).
- Captcha/verification → Verification Center (§2.8): freeze, notify, user takes control, resume.
- Vault: AES-256-GCM, recovery code shown once, plaintext never in LLM context; audit log of every credential use.

## 7. Deduplication & history
Skip already-applied (URL + company+role+location fuzzy match), CSV import, live re-check before applying.

## 8. Zero results & empty states
Ask-first with concrete suggestions; each suggestion is a tap (apply + re-run). Empty state shows sources queried + counts + freshness.

## 9. Approval & discipline (replaces caps)
- **Triage queue:** AWAITING_APPROVAL grouped by (match score × honesty-fit) into **Ready / Needs-you / Skip-pile**. Bulk actions: "approve top 8", "snooze rest", per-group stamp review.
- **Auto-approve rule engine:** user-defined rules (e.g. "auto-approve internships ≤14d old, match > 80") — nothing auto-sends; auto-approve just prepares prefills.
- **Send-hours** (timezone-aware) + randomized human gaps stay; **daily caps removed.**
- **Content gate (hard rule):** no commitments, dates, salary figures, or availability statements in agent-written text the user didn't hand-type; foreign-language docs show a **side-by-side translation preview**.
- Kill-switch: "pause all agents" + live **"what jobPilot is doing now"** panel (site, page, last action, PC) off the event log, in web UI and PWA.

## 10. PWA, Web UI & notifications [v5.2 UI additions]
- **Status pills (always visible, web + PWA):** **PC** shows **🟢 green = app + browser healthy · 🟡 yellow = starting / reconnecting / Doctor warning · 🔴 red = offline / browser down / Doctor FAIL**. Plus a **PWA** pill (connected / reconnecting / offline) and a **browser** pill (running / stopped / frozen). Clicking a pill opens a detail panel (uptime, last heartbeat, event count, DB size, backup age). **Every state transition is logged** (§2.7). Same indicators in the Doctor.
- **Doctor page (§2.6):** all checks with PASS/WARN/FAIL, fixes, and the **browser trust score 0–100%** with signal breakdown, shown in the header too.
- **Logs page (§2.7):** live tail, filters, per-run timeline, error explainer, export diagnostic bundle.
- **Verification Center (§2.8):** active verification cards with site/URL/PC/screenshot/"Take control", resume button, **OTP entry field + "where to find the code" guidance (Gmail account, search term, masked phone/email)**.
- **Credentials page (§6):** per-site username/password manager, encrypted, audit trail.
- **Login guide (§2.4):** in-app, per-site checklist showing `signed_in / needs_login / challenged / unknown`; one-tap "open the agent browser and sign in"; note that the session lives in the agent profile and may expire. No cookie-copy wizard in v1. Also shown during onboarding.
- **Agent-profile setup screen (required copy):**
  > **Non-negotiable: this browser profile must keep its cookies between restarts. In Brave, open Settings → Privacy → Clear browsing data → On exit and untick Cookies and Browsing history; set On startup to "Continue where you left off". Brave 1.98.60 has no global "Forgetful Browsing" switch, so we verify these three real preferences and prove a cookie survives a restart.**
  The UI blocks "Next" until the server re-checks those preferences and the restart test passes, shows the browser pick (Brave default / Chrome config-swap on this PC), and links the per-site login checklist.
- **3 push tiers:** TIER-1 critical push: **verification/captcha/OTP, lease conflict**; TIER-2 daily digest, one push at a user-picked time: approvals, replies; TIER-3 silent in-app: zero-result follow-ups. Quiet hours per tier (tier-1 bypasses quiet hours). Push only fires while the PC is on; on wake the app offers a catch-up digest.
- Phone UI: approve/reject, status pills, Doctor summary, notifications, verification cards + OTP entry, trigger run, paste URL / forward WhatsApp post, Search Scope editing, PC/browser status.
- Desktop UI: profile editing, resume review, settings, skills, accounts/credentials, full Search Scope manager, learning panel, Doctor, Logs, Data/backup page.

## 11. Data ownership
Export/delete everything (profile, jobs, applications, resume versions, memory, event log, **logs, credential blobs**) from this PC. SQLite file = export format. Backups (scheduled file copy or litestream) on by default; backup status shown in Doctor. "Delete everything" wipes the DB, artifacts, logs, and agent profile on this PC.

## 12. Build phases
> **UI/UX rule (user-requested):** after the WEEK-0 spike passes, a dedicated design phase using UI skills produces **10 distinctly different design directions** (clickable mockups); user picks one (or mixes); that design system is used across PC web + PWA.

- **W0 — Feasibility spike (§0):** Brave + Chrome CDP scrape on rekrute/marocannonces, one L2 API, paste-URL; prototyped trust-score probes + verification freeze. **GO/NO-GO gate.**
- **P0 — UI/UX design phase:** 10 variants of (dashboard, triage queue, jobs list, approval card, settings/search-scope, "agent doing now", agent-profile setup + session-survival gate, **Doctor, Logs, status pills, Verification Center + OTP form, credentials manager, data/backup page**) as clickable mockups; user picks.
- **P1 — Core skeleton:** Node + SQLite (WAL, persistence-before-side-effects); PC web UI; **5-minute onboarding** (OpenRouter key + default model, resume upload/parse, city + job-type picker, site list); OpenRouter adapter; pipeline state machine + idempotency/lease recovery; **agent-browser first-run on the PC: Brave + persistent profile + session-survival gate**; manual run trigger; backups on; **Doctor (all env checks) + Logs page + live PC/browser status via WebSocket.**
- **P2 — Discovery:** L1 adapters for spike-validated sites; **[ADR-0018] generic structured-data extraction + per-site mode setting**; L2 APIs; L3 paste-URL; WhatsApp/Facebook paste-forward extraction; signal/noise + scam filters; zero-result ask-first; dedupe + history import; Ollama adapter + failover-pause; **browser trust score v1 wired to the header + run-start logs.**
- **P3 — Tailoring + review:** Markdown→PDF then Tectonic LaTeX; honesty checks; reviewer loop (3-iter → triaged queue); "what employer sees" preview; triage queue + rejection chips + learning panel.
- **P4 — Apply + verification:** prefill-in-browser (hard rule); approval cards + rule engine; email layer + content gate + translation previews; send-hours + kill-switch + "doing now" panel; **Verification Center + OTP entry + take-control handoff**; credential manager UI; minimal vault; **PC start-on-boot (Windows/Linux), missed-run-on-wake offer, backup restore test.**
- **P5 — Polish:** skills toggles; reply tracking + modes 1–2; interview handoff; unmatched-reply lane; follow-ups; export/delete (this PC); Android push tiers; analytics; log retention/rotation polish; diagnostic bundle export. **P6 deferred:** full skills runtime, networking, referral emails, compensation researcher, full-auto apply, auto account creation, any remote-host packaging.

## 13. Known risks & mitigations
- **Account bans:** risk accepted ("middle" appetite) — prefill-only hard rule, owned/isolated agent browser, human pacing, no auto-submit, per-site risk badges + plain-language onboarding notice ("automation can breach ToS; bans can be permanent"), content gate. Caps removed; pacing + approval gate carry the discipline.
- **Browser/CDP breakage:** Brave only if W0 passes; Chrome = config fallback; pinned versions; UI pin-repair flow; Firefox/extension-assist fallback remains possible via driver abstraction.
- **Trust score misuse:** it is a heuristic, not a guarantee — labeled as such everywhere; a high score never promises immunity; low score warns, and the user can still choose to run (logged).
- **Machine change:** if the app is ever installed on another machine, it is a separate local install with its own data; moving means stop → copy `data/` or Export → start there. No sync, no merge, no conflict cards.
- **PC asleep/off:** scheduled runs can be missed. The app offers the missed scan once on wake (never a burst); push only works while the PC is on.
- **Local disk loss/corruption:** WAL + `VACUUM INTO` backups on by default; Doctor shows backup age; restore is tested. A single PC is a single point of failure by design.
- **LLM downtime/cost:** pause + notify (never mid-batch downgrade); draft-tier tagging; cost tracking.
- **Small local model quality:** draft-tier only; quality gate; never auto-sent.
- **Scraping treadmill:** adapters for validated sites only; everything else → paste-URL (no false "any site" promise).
- **Over-complication:** single-user; no companion extension; no Composio; no background scraping daemon; no full-internet crawler.

## 14. v6 doc sync — complete (2026-10-22)
The downstream docs now match this PC-only plan. What changed:

- **PRD.md:** removed the two-machine journey and all sync/deployment requirements; the run target is the PC, the phone is a client, and moving installs is copy/export → start.
- **MILESTONES.md:** P1 uses the session-survival gate, P4 is apply/verification/phone access, and P5 is PC-only.
- **ADRs:** ADR-0010 is Superseded; ADR-0012 and ADR-0018 are PC-only; ADR-0020 records “PC is the only run host”; ADR-0021 records the session-survival gate.
- **README.md / DESIGN-DECISION.md / design mockups:** no remote-host, sync, conflict-card, cookie-import, or “Forgetful Browsing” UI remains.

## 15. Open blockers for the next slice
- **[USER] Phone access:** same LAN only, or Tailscale `*.ts.net`? Drives the TLS/auth requirement. Default recommendation: Tailscale Serve, tailnet-only, no public tunnel.
- **[AGENT] Auth before remote access:** the current server is loopback-only with no auth; if the phone reaches it over LAN/Tailscale, add token auth + Trusted Host allowlist + CSRF first.
- **[AGENT] Next code slice — decided:** the browser session-survival gate first (M1). Onboarding then uses the real gate instead of a fake checkbox.

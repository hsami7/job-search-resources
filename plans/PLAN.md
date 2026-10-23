# Plan: PC-only P1 — browser session-survival gate on Omarchy

## Goal

Make jobPilot runnable and verifiable on the user's **Omarchy Linux (Arch-based, Hyprland/Wayland, i7 x86_64) PC**, with an owned Brave profile that survives restarts, and finish the P1 browser gate that onboarding depends on.

## Context

- **Decisions now fixed:** `PLAN.md` v6 is PC-only. No remote-host deployment target, no multi-machine sync, no Host Link, no conflict cards, no run-location setting, no laptop cookie-import wizard. If the app is ever installed elsewhere, that machine has its own `data/`; moving is stop → copy `data/` or Export → start there.
- **W0:** GO. Brave 1.98.60 on headless aarch64 Ubuntu, Xvfb, CDP, adapters, freeze, take-control all proven (`SPIKE-REPORT.md`). Chrome could not be tested there (no Linux arm64 build); that test moves to this PC.
- **P0:** 01 Command Deck chosen; tokens frozen (`DESIGN-DECISION.md`).
- **P1 today:** event log + profile projection + resume storage + profile page. `npm test` = 13/13, `npm run test:e2e` = 54/54 on the PC with the hardened harness (CDP 9333, extensions disabled, foreign-port refusal). No settings, no browser, no onboarding, no pipeline, no Doctor/Logs, no auth.
- **Target PC:** Omarchy Linux (Arch), i7, Hyprland/Wayland, headed browser. Verified over SSH on 2026-10-22:
  - host `neger7lost-archlinux`, Tailscale `100.71.69.111`; the development machine's SSH key `~/.ssh/omarchy_fix` is authorized.
  - Node **v26.12.0** (`/usr/bin/node`), npm 12.2.1; `node:sqlite` smoke test passes (`DatabaseSync`, create/insert/select).
  - Brave **1.98.60** (`brave-bin`): `/usr/bin/brave` wrapper → `/opt/brave-bin/brave`; no `~/.config/brave-flags.conf`.
  - **Chromium 155.0.8059.84** is installed; **Google Chrome is not** (no `google-chrome` package). Use Chromium for the non-Brave W0b arm, or install `google-chrome` from the AUR if exact Chrome parity matters.
  - `yay`, `pdftotext`, `tailscale`, `ufw`, `rsync` present; **`tectonic` missing** (needed later for LaTeX, not for the browser gate).
  - Disk 952G, 830G free; root is **LUKS** (`crypto_LUKS` → btrfs). Home is `0700`.
  - Hyprland session on tty1, `XDG_SESSION_TYPE=wayland`, socket `/run/user/1000/wayland-1`; SSH does **not** inherit `WAYLAND_DISPLAY`/`HYPRLAND_INSTANCE_SIGNATURE`, so browser tests over SSH must export `XDG_RUNTIME_DIR=/run/user/1000 WAYLAND_DISPLAY=wayland-1`, and the server itself should start from the graphical session (`uwsm-app` or a systemd user unit after `graphical-session.target`).
  - Repo now at `~/Work/jobPilot`; port 4319 is free; no git remote in the repository.
- **Known correction:** Brave 1.98.60 has **no global "Forgetful Browsing" toggle**. The real gate is `browser.clear_data.cookies_on_exit=false`, `browser.clear_data.browsing_history_on_exit=false`, `session.restore_on_startup=1`, plus a behavioural cookie-survives-restart test. The UI must never claim a toggle that does not exist.
- **No git remote** is configured in this repo. History moves to the PC as a `git bundle`; a remote is convenient but not required.
- **Phone access** is still undecided: same LAN only, or Tailscale `*.ts.net`. If the phone is to reach the PC, authentication must land before binding to anything but loopback.
- **Baseline on Omarchy (verified 2026-10-22, final):** the source tree and full `.git` history are at `/home/neger7lost/Work/jobPilot`; `npm ci` installed 1 package. With only `DISPLAY=:0 XDG_RUNTIME_DIR=/run/user/1000`, **`npm test` = 13/13** and **`npm run test:e2e` = 54/54**. Harness fixes in `788b114` and `18af507`: resolve Brave from Linux candidates, default to CDP **9333** (never 9222), probe the TCP port and refuse any occupied listener, use XWayland instead of spawning Xvfb on a desktop, and launch with `--disable-extensions --disable-component-extensions-with-background-pages --disable-save-password-bubble --password-store=basic` so the take-control fixture cannot trigger 1Password. `spike/08-take-control-test.js` is still discovered by `npm test`; it now starts its own browser safely and passes. The e2e hostname assertion was fixed in `4993e55` (hard-coded name → `os.hostname()`).

## Approach

**Browser-first, on the PC.** The only P1 unknown with a measured failure mode is the owned browser's lifecycle and session survival. W0 proved launch/extract/freeze on a headless test host; it did not prove the same on a Wayland desktop, and it did not test Chrome. Close that first, then onboarding can use a real gate instead of a fake checkbox.

**Docs first, then one vertical slice.** The PRD/MILESTONES/ADRs still describe the removed dual-host design. Sync them before code so the acceptance contract matches `PLAN.md` v6. Then build the smallest end-to-end browser slice: settings → launch/status → real prefs → cookie restart test → server-side gate → Browser screen → e2e.

**No secrets in this slice.** Settings hold browser choice/state only. The OpenRouter key, vault, and onboarding secrets come after the vault exists (ADR-0011). This avoids writing a permanent secret into the append-only event log.

### Considered Alternatives

- **Onboarding first (rejected):** steps 1–3 need an encrypted key store, a resume parser, and a search-scope model that do not exist. Step 4 would be a fake gate. It produces UI, not a verified capability.
- **Cookie import from the user's everyday browser (rejected):** Windows `v20`/DPAPI, macOS Keychain, and DBSC device-bound sessions make it unreliable; on the same PC the honest path is one manual login in the agent browser. The spike already moved import to P4 importance.
- **Remote-host-first with take-control (rejected by user):** removed from v6. No sync, no remote host.
- **Full browser lease + pipeline together (rejected for this slice):** a pid/profile marker + single-flight launch is enough to prove lifecycle. The SQLite lease/heartbeat belongs with the pipeline state machine.
- **Trust score / Doctor page now (deferred):** the score is advisory and environment-dependent. The gate needs hard checks, not a 0–100 number. Doctor v1 comes after the browser slice.

## Milestones

### Milestone 0: Doc sync + PC baseline — every downstream doc says PC-only, and the repo runs on the PC
Deliverable: PRD/MILESTONES/ADRs/README match `PLAN.md` v6; `npm test` and `npm run test:e2e` are green on Omarchy; Brave vs Chrome is measured on the PC.

- [x] 0.1 ADRs: ADR-0010 is now `0010-single-host-local-data.md`, **Superseded by ADR-0020**; ADR-0012 is PC-hosted PWA transport; ADR-0018 no longer has a run-host setting; `0020-pc-is-the-only-run-host.md` and `0021-browser-session-survival-gate.md` are added.
- [x] 0.2 `PRD.md` — removed the two-machine journey and all sync/deployment requirements; the run target is the PC, the phone is a client, and moving installs is copy/export → start.
- [x] 0.3 `MILESTONES.md` — P1 uses the session-survival gate, P4 is apply/verification/phone access, P5 is PC-only, and the timeline no longer has a sync/deploy phase.
- [x] 0.4 `README.md` + `DESIGN-DECISION.md` + `design/` — removed remote-host/deployment language, the two-host data screen, conflict cards, cookie import, and the "Forgetful Browsing" claim.
- [x] 0.5 Node decision: **Node 26.12.0 accepted** — `node:sqlite` and both suites pass; `.node-version` records it and `playwright-core` is pinned to the exact resolved version `1.64.1`. Revisit `22.22.1` only if a Node 26-specific regression appears.
- [x] 0.6 PC setup: repo copied to `~/Work/jobPilot`, `npm ci` done, and both suites pass (13/13, 54/54). Tests run over SSH with `DISPLAY=:0 XDG_RUNTIME_DIR=/run/user/1000`; `BRAVE_PATH`/`CDP_PORT`/`WAYLAND_DISPLAY` are no longer required. Brave is at `/opt/brave-bin/brave`; Chromium 155 remains the non-Brave arm.
- [x] 0.7 Fix the test harness (safety parts): `spike/lib/browser.js` resolves Linux Brave candidates, defaults to CDP **9333**, probes the TCP port and refuses any occupied listener, uses XWayland when present, disables extensions/password bubbles in the test profile, and `spike/02-trust-score.js` no longer defaults to 9222. Commits `788b114`, `18af507`. Still open: e2e still uses the shared `spike/profile/brave` + a fixed 9333 rather than a throwaway temp profile/free port; M1.1.7's browser tests own that.
- [ ] 0.8 W0b on the PC (partial): smoke (`01`), freeze (`05`), Arbeitnow (`03`), and generic extraction (`04`, 4/4 JSON-LD) pass with Brave. Trust (`02`) launches Brave on 9333 and reads prefs, but `https://www.marocannonces.com/` timed out after 45 s — an external-site/anti-bot result, not a harness failure. The Chromium arm has not been run; record it in `SPIKE-REPORT.md` and update ADR-0001 once done.

### Milestone 1: Owned browser + session-survival gate — the P1 browser gate is real
Deliverable: from a clean `data/`, the user launches the agent browser, sees the three real prefs, passes a cookie-survives-restart test, and the gate is stored as an event. A forced FAIL keeps the gate closed.

- [ ] 1.1 `server/db.js` — migration 2: `settings(id INTEGER PRIMARY KEY CHECK(id=1), data TEXT, version INTEGER, updated_at TEXT)`. No secret columns.
- [ ] 1.2 `server/settings.js` (new) — defaults (`browser.kind='brave'`, `browser.executable` resolved server-side, `browser.profileDir` derived from `DATA_DIR`, `browser.cdpPort=0`, `onboarding.browserGate='pending'`), `getSettings`, `patchSettings` (known keys, shallow, one event per changed key), `rebuildSettings`, reject keys matching `/secret|token|key|password/i`. Event `settings.changed`.
- [ ] 1.3 `server/browser.js` (new) — port only the flags/probe logic from `spike/lib/browser.js`; rewrite lifecycle:
  - executable allowlist: `$BRAVE_PATH`, `/usr/bin/brave`, `/usr/bin/brave-browser`, `/opt/brave-bin/brave`, `/opt/brave.com/brave/brave-browser`; Chrome: `/usr/bin/google-chrome-stable`, `/usr/bin/google-chrome`, `/opt/google/chrome/chrome`. No free-form path from the API.
  - profile `DATA_DIR/agent-profile` (mode `0700`); runtime marker `DATA_DIR/runtime/browser.json` (mode `0600`) with pid, port, profile, startedAt.
  - free CDP port on `127.0.0.1`, `--remote-debugging-address=127.0.0.1`, `--remote-debugging-port`, `--user-data-dir`, `--no-first-run`, `--no-default-browser-check`, `--disable-sync`, `--disable-translate`, `--password-store=basic` (documented as obfuscation, not encryption; rely on LUKS).
  - single-flight launch; no adoption of a CDP endpoint whose pid/cmdline does not match the marker; `proc.once('error')` fast-fail; `stop()` SIGTERM → wait → SIGKILL; clear marker on exit.
  - `status()` (running/stopped/frozen, pid, port, profile, version), `openPage(url)`, `readPrefs()` via `chrome.settingsPrivate.getAllPrefs`, `checkPersistence()`.
  - no Xvfb: if no `WAYLAND_DISPLAY` and no `DISPLAY`, return `no_display` with a clear fix.
- [ ] 1.4 `server/browser-checks.js` (new) — pure `evaluateSessionPrefs(prefs)` returning `{id, status, detail, fix}`:
  - FAIL if `cookies_on_exit !== false`; WARN for history/site-settings; WARN for `restore_on_startup !== 1` (1 = continue where you left off; 4/5 are not the same); FAIL closed if `settingsPrivate` is unavailable.
  - persisted gate record `{gate:'prefs-v1', passedAt, checksHash, engine}`; no cookie values.
- [ ] 1.5 `server/app.js` + `server/http.js` — endpoints and guards:
  - `GET /api/browser/status` (cheap, never launches), `POST /api/browser/launch`, `POST /api/browser/stop`, `POST /api/browser/checks`, `POST /api/browser/persistence`, `POST /api/onboarding/browser/confirm`.
  - loopback-only (`socket.remoteAddress`), `Host` allowlist (`127.0.0.1:4319`, `localhost:4319`), same-origin check on every POST, no GET side effects, `405` for wrong methods.
  - confirm re-runs the checks + persistence server-side; refuses on any FAIL; writes `settings.changed` + `onboarding.browser_gate.passed` only on PASS.
- [ ] 1.6 `web/` — route switcher (~40 lines, hash routes `#profile` / `#browser`) so the existing Profile app does not bind when its fields are absent. Browser screen in 01 Command Deck style: detected browser, profile path, running/stopped, three checks with worded PASS/WARN/FAIL, "Re-check", "Open browser", "Run restart test", gate button disabled until server PASS. Enable the Browser nav item; leave Jobs/Doctor/Logs/Settings disabled.
- [ ] 1.7 Tests — `test/settings.test.js` (defaults, one event per key, 409 stale version, rebuild, secret-key 422, cross-origin 403); `test/browser-checks.test.js` (pass/fail/missing fixtures); `test/browser.test.js` (opt-in real Brave: launch → status → second launch reuses pid → `kill -9` recovers → SIGTERM closes); `e2e/browser.e2e.mjs` (own temp DB/profile/free port: not set up → launch → checks → gate → reload keeps pass → forced fail keeps gate closed → 390 px, no console errors).
- [ ] 1.8 `README.md` — endpoints, the gate, `data/agent-profile` as credential material, `0700`/`0600`, no-auth/loopback warning, and the Omarchy/Brave path.

### Milestone 2: Onboarding shell — the first-run path uses the real gate (outline)
Deliverable: a resumable 5-step onboarding that stores no secrets until the vault exists.

- [ ] 2.1 Onboarding state in `settings` (step, completed flags); `GET/PATCH /api/onboarding`.
- [ ] 2.2 Step 2 resume: upload exists; add a parser decision (PDftotext/Tectonic? or manual confirm-v1) and side-by-side confirmation.
- [ ] 2.3 Step 3: job type + multi-location picker stored in settings (no secrets).
- [ ] 2.4 Step 5: ToS/ban-risk acknowledgement stored as an event; first-run CTA blocked until gate + ack.
- [ ] 2.5 Step 1 (OpenRouter key) and the vault: implement AES-256-GCM secrets at rest **before** storing the key; never write it to `event_log`.

### Milestone 3: Pipeline + OpenRouter (outline)
- [ ] 3.1 Pipeline state machine (`DISCOVERED → TAILORED → REVIEWED → AWAITING_APPROVAL → SUBMITTED`) with persisted-before-side-effect transitions and `INTERRUPTED` recovery.
- [ ] 3.2 Browser lease (TTL + heartbeat) + boot orphan cleanup; manual run trigger.
- [ ] 3.3 OpenRouter adapter with structured-output validation; pause on failure (no mid-batch downgrade).
- [ ] 3.4 WebSocket status + Logs v1 + Doctor v1 + backups.

## Verification

**On the Omarchy PC:**
```bash
node -v                      # v26.12.0 (accepted)
npm ci
DISPLAY=:0 XDG_RUNTIME_DIR=/run/user/1000 npm test       # 13/13
DISPLAY=:0 XDG_RUNTIME_DIR=/run/user/1000 npm run test:e2e  # 54/54

# Browser gate (after M1)
npm start                    # http://127.0.0.1:4319
# open #browser: launch → checks PASS → restart test PASS → gate stored
# forced-fail profile (cookies_on_exit=true): gate stays closed

npm run test:browser         # real Brave lifecycle + persistence
npm run test:e2e:browser     # temp DB/profile, 390 px, no console errors
```

**Test results — 2026-10-22, Omarchy PC (Brave 1.98.60, XWayland `:0`):**

| Check | Result | Notes |
|---|---|---|
| `npm test` | **13/13 PASS** | includes `spike/08-take-control-test.js`; no 1Password prompt |
| `npm run test:e2e` | **54/54 PASS** | profile flow, conflict, resume, validation |
| `spike/01-smoke.js` | PASS | launch, CDP, screenshot; Brave process outlives the CDP client |
| `spike/05-freeze.js` | PASS | 4/4 actions blocked, no false freeze |
| `spike/03-arbeitnow.js` | PASS | 300 fetched, 300 normalized |
| `spike/04-generic-extract.js` | PASS | 4/4 records via JSON-LD |
| `spike/02-trust-score.js` | PARTIAL | Brave launches on 9333; marocannonces.com timed out (external) |
| `spike/06-adapters.js` | NOT RUN | live sites/login; not part of the repeatable baseline |

**Manual checks:**
- Close the agent browser, relaunch: same profile, cookie test still passes.
- `kill -9` the owned browser: next status says stopped/crashed, relaunch works, no stale marker.
- `curl -s -o /dev/null -w '%{http_code}' -X GET http://127.0.0.1:4319/api/browser/launch` → `405`.
- `curl -H 'Host: evil.example' http://127.0.0.1:4319/api/browser/status` → `403`.
- `stat -c '%a %n' data data/agent-profile data/runtime/browser.json` → `700`, `700`, `600`.
- `ss -lntp | grep -E ':4319|:9222'` → both `127.0.0.1`.

## Blockers

- **[USER] Phone access:** same LAN only, or Tailscale `*.ts.net`? If the phone reaches the PC, token auth + Trusted Host + CSRF must land before binding beyond loopback. Not needed for M0/M1 if everything stays loopback.
- **[USER] Repo transfer — resolved:** no remote is configured, so the repository history is carried to the PC as a `git bundle`; the PC branch `planning/20261022-213623-pc-only-v6` now includes the harness fixes and this plan. A remote is still nice-to-have, not required.
- **[AGENT] Omarchy specifics — resolved:** Brave binary is `/opt/brave-bin/brave` (the `/usr/bin/brave` wrapper is safe but reads a global flags file; launch the real binary for the owned profile). Chromium 155 is the non-Brave arm; Google Chrome is not installed. `tectonic` must be installed before the LaTeX slice.
- **[AGENT] Node version — resolved:** Node 26.12.0 is installed, `node:sqlite` works, and both suites pass. Keep 26; `.node-version` records it.
- **[AGENT] Wayland launch env — tests resolved:** `ensureDisplay()` uses an existing XWayland `:0`, so SSH tests only need `DISPLAY=:0 XDG_RUNTIME_DIR=/run/user/1000`. The production server should still start from the graphical session (`uwsm-app` or a systemd user unit after `graphical-session.target`), not a bare SSH shell.
- **[AGENT] Cookie store:** v1 keeps `--password-store=basic` (deterministic, obfuscated at rest, not encrypted) under LUKS + `0700`; document the tradeoff in M1. The test harness already uses it.
- **[AGENT] `browser.close()` behaviour — resolved:** closing the Playwright CDP connection does **not** terminate Brave. The spike tests leave the browser process alive; M1 `stop()` must SIGTERM/SIGKILL the owned pid and clear the runtime marker. Never kill a browser whose cmdline does not contain `data/agent-profile`.

## Plan Review Notes

The earlier recommendation ("browser gate first on the remote host") was challenged by four subagents and then superseded by the user's decision to run **100% on the PC**. What changed:

- **Remote-host work removed** (user decision): no deployment, sync, conflict cards, host pills, run-location, cookie migration. `PLAN.md` v6 records it; §14 records the completed doc sync.
- **Cookie import rejected as a v1 path** (all four agents): OS-bound encryption, DBSC, IP-bound `cf_clearance`, session cookies. On the same PC, one manual login in the agent browser is simpler and honest.
- **"Forgetful Browsing OFF" corrected:** the toggle does not exist; the gate is the three prefs + a restart test. The earlier UI copy and PRD requirement would have shipped a lie.
- **Onboarding moved behind the gate:** steps 1–3 depend on stores that do not exist; a fake step 4 is worse than no wizard.
- **Full lease/pipeline deferred:** this slice proves lifecycle with a pid/profile marker + single-flight; the SQLite lease/heartbeat belongs with the pipeline.
- **Test collisions caught:** the current e2e imports the spike harness on port 9222 with `spike/profile/brave`; the new browser tests must use a free port + temp profile or they will fight a real Brave session.
- **Open challenge:** whether the PC's Wayland session behaves differently from the headless Xvfb runs (native Wayland vs XWayland, GPU/WebGL, keyring). M0.8 measures it before M1 hardens the lifecycle.

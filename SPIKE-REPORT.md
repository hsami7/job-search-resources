# SPIKE-REPORT — W0 feasibility spike

**Date:** 2026-10-22
**Host:** development test host — Ubuntu 26.04.1 LTS, **aarch64**, headless (no display)
**Verdict:** **GO**, with 3 conditions (§7). Local discovery works on both target sites without a login, the freeze handoff holds, and generic extraction reaches most global boards.

---

## 1. Pinned versions

| Component | Version | Notes |
|---|---|---|
| Node.js | 20.20.2 | |
| Brave Browser | **1.98.60** | native arm64, `/opt/brave.com/brave/brave-browser` |
| Brave/Chromium engine | **156.0.8078.48** | from `brave://version` over CDP |
| CDP protocol | 1.3 | `--remote-debugging-port=9222` |
| playwright-core | **1.64.1** | `connectOverCDP` only — no bundled browser used |
| Chromium (snap) | 155.0.8059.84 | **proxy only** — see §6 |
| Xvfb | system package | `1440x900x24`, `DISPLAY=:99` |
| Tectonic | not installed | not needed until P3 |
| Docker | 29.7.2 | present, unused by the spike |

Launch flags that matter: `--remote-debugging-port`, `--user-data-dir` (dedicated), `--no-first-run`, `--no-default-browser-check`, `--disable-sync`, `--disable-translate`.

UA observed: `Mozilla/5.0 (X11; Linux x86_64) … Chrome/156.0.0.0 Safari/537.36` — matches a normal Chrome, no `Brave` token, no `Headless`.

---

## 2. Results against the W0 exit criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | ≥2 local sites, ≥2 consecutive runs each | **PASS** | ReKrute 10 cards × 3 runs, 100% ID overlap; MarocAnnonces 21 cards (20 valid) × 3 runs, 100% overlap |
| 2 | Paste-URL works on both test links | **PASS (scope note)** | Generic extractor run on 6 real postings; ReKrute + MarocAnnonces both parsed. **LinkedIn deliberately not tested** — see §6 |
| 3 | Freeze prototype stops all interactions | **PASS** | 4/4 actions blocked after detection, OTP field untouched, page unchanged |
| 4 | Versions pinned & documented | **PASS** | §1 |

### Local adapters

| Site | Cards/run | Valid | Location parsed | Company parsed | Stability | Wall time/run |
|---|---|---|---|---|---|---|
| ReKrute | 10 | 10 | 10/10 | 9/10 | 100% overlap ×3 | 5.5–7.5 s |
| MarocAnnonces | 21 | 20 | 20/20 | **0/21** | 100% overlap ×3 | 5.1–6.5 s |

Selectors verified (2026-10-22):

- **ReKrute** — card `.post-id`; job link `a.titreJob`; employer from `…-emploi-recrutement-<id>.html`; contract/experience/study/sector are `a[href*="contractType"]`, `workExperienceId`, `studyLevelId`, `sectorId`.
- **MarocAnnonces** — card `ul.cars-list > li`; job link `a[href*="/annonce/"]`; city is line 2; salary/study are `Salaire:`, `Niveau d'études souhaité:` lines.

### L2 API (Arbeitnow)

300 records fetched, 300 normalized. **37 (12%)** are missing title/company/location — the normalizer reports the gap instead of inventing a value. 43/300 flagged remote.

### Generic extraction (ADR-0018)

| URL host | Strategy | Completeness |
|---|---|---|
| arbeitnow.com (×2) | `jsonld` | 4/4 |
| remoteok.com | `jsonld` | 4/4 |
| weworkremotely.com | `jsonld` | 4/4 |
| rekrute.com | `opengraph` | 2/4 (no location, no company) |
| marocannonces.com | `opengraph` | 2/4 (no location, no company) |

**Conclusion:** the "any job page" claim holds for boards that publish `JobPosting` structured data (3 platforms, 4/4 fields). It does **not** replace local adapters: ReKrute's `ld+json` contains only `WebSite`/`Organization`, and MarocAnnonces' block is **malformed JSON** (unparsable). This confirms the ADR-0018 split rather than undermining it.

### Trust score

Same probes, two states:

| State | Score | Band | Failing signals |
|---|---|---|---|
| Headed Brave under Xvfb | **76/100** | Caution | no WebGL context at all; timezone `UTC` vs IP geolocation `Europe/Berlin` |
| (first instrumented run, before fixing a null-handling bug) | 100/100 | Safe | — **the score lied**; a `null` WebGL context was scored as a pass |

The second row is the more useful result: it reproduced PLAN §13's "trust score misuse" risk inside the spike. The instrument now fails closed on missing data.

Fixes it recommends, which are exactly the Doctor's one-click fixes:

- **No WebGL:** plain Xvfb has no GL driver. `--enable-unsafe-swiftshader` produces a context, but the renderer string becomes `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)) …)` — a signature that appears in every headless CI. The honest fix is Mesa/llvmpipe (`libgl1-mesa-dri`) as a documented deployment dependency, not a UA patch.
- **Timezone:** set `TZ` to the region that owns the egress IP, or accept the mismatch knowingly.

### Take-control (verification handoff on a headless host)

Prototype at `spike/take-control/`: CDP screencast → SSE → browser panel, with mouse/keyboard forwarded back through `Input.*`. No VNC, no X viewer, no extra daemon, works over the same HTTPS/Tailscale path the PWA already uses.

- frame stream: OK (~20 KB first chunk)
- coordinate mapping: **exact** — a click at the centre of the displayed image landed at `720,408` on a `1439×818` viewport
- login flow: typed credentials + Tab + Enter drove a real form submit remotely: **OK**

**Limitation, stated plainly:** screenshots show the page viewport only — not browser chrome, tab bar, or native dialogs. If a flow needs those, fall back to Xvfb + x11vnc + noVNC (websockify is already present; neither x11vnc nor noVNC is installed, and I did not install system packages).

---

## 3. Findings that change the plan

1. **"Forgetful Browsing OFF" is not a global setting on Brave desktop 1.98.60.** `chrome.settingsPrivate.getAllPrefs()` exposes no `forgetful` pref. The only "forget" surface is the **per-site** shield toggle *"Forget me when I close this site"*. The cookie-wipe risk the plan cares about is governed by `browser.clear_data.cookies_on_exit` (**false**), `browser.clear_data.browsing_history_on_exit` (**false**), and `session.restore_on_startup` (**1 = continue where you left off**).
   → **P1 action:** the onboarding hard gate must verify *those* prefs, not a toggle that does not exist. The §10 UI copy needs rewording (ADR needed at P1, not now).
2. **Local discovery does not require a login.** Both listings are public and server-rendered. Login/cookie-import work is **only** on the critical path for *applying*, not for *discovering*. This removes a week of assumed dependency from P2 and makes login seeding a P1 concern; v6 uses one manual login in the owned profile (ADR-0021), not a cookie-import wizard.
3. **ReKrute and MarocAnnonces cannot be covered by generic extraction** (§2). Adapters stay; that is now measured, not assumed.
4. **MarocAnnonces cards never name the employer** (0/21). Employer requires a detail-page fetch per job. Budget for that in the adapter contract: `collectFromListing` + `enrichDetail`.
5. **ReKrute serves 10 cards per listing page.** Full coverage needs pagination + dedupe, not one fetch.
6. **Pasting a LinkedIn URL was not tested on this host.** A datacenter IP plus an anonymous job view produces a challenge that proves nothing; the plan already routes LinkedIn to paste-only. Test it from the PC in W0b.

---

## 4. What the freeze guard protects

Detection combines URL, title, DOM widgets (`g-recaptcha`, `.cf-turnstile`, `#challenge-form`, OTP fields) and page text (`verify you are human`, `we sent a code`, `unusual activity`, account-locked). All interactions route through a guard that throws `FROZEN` once tripped.

Test result: **4/4** attempted actions blocked; the OTP input stayed empty; the URL did not change; a screenshot + context were captured. A normal form on the same fake host did **not** trip it, so the guard does not burn runs on false positives.

Not proven: detection accuracy on **live** Cloudflare/reCAPTCHA pages. I refused to trigger a real challenge on purpose, and a false negative there is the one failure that costs an account. P1 should add a fixture corpus and treat "unknown page after N seconds" as freeze.

---

## 5. Honest gaps (not done, on purpose)

- **Google Chrome column of the Brave-vs-Chrome table:** impossible here — Google ships no Linux arm64 build. Chromium snap 155 is a proxy; the real comparison must run on the x86 PC.
- **LinkedIn paste-URL:** deferred to the PC (§3.6).
- **WebGL/mesa fix:** requires a system package install; not performed.
- **Take-control over Tailscale TLS:** proven on `127.0.0.1` only.
- **MarocAnnonces screenshot:** `page.screenshot()` timed out at 30 s on that page even after fonts loaded (heavy/lazy content). Rendering for the take-control panel needs a timeout + JPEG-quality fallback at P1.
- **No captcha was ever solved, bypassed, or retried.** No account was created. The dedicated profile is `spike/profile/brave`; the user's own browser was never touched.

---

## 6. Recommendation

**GO.** Discovery on the two local sites is proven, stable across runs, and does not need a login; the API path works at volume; generic extraction is measured at 4/4 fields on three international platforms; the freeze guard and the remote take-control handoff both work on a headless host.

Conditions:

1. **P0 design may start**, but the agent-profile screen must describe the real cookie-persistence checks (§3.1), not "turn off Forgetful Browsing".
2. **Chrome comparison + LinkedIn paste test happen on the x86 PC** before the browser decision is written into an ADR as final.
3. **The trust score ships with the fail-closed instrument** and the band copy from §2, or not at all.

---

## 7. Reproduction

```bash
npm install                     # playwright-core only
npm run spike:smoke             # launch own Brave, CDP, screenshot
npm run spike:trust             # trust score + Brave prefs (HEADLESS=1 for the comparison)
npm run spike:arbeitnow         # L2 API -> 300 normalized records
npm run spike:generic           # generic extraction across 6 postings
npm run spike:freeze            # freeze guard vs fixture + false-positive check
npm run spike:rekrute           # 3 runs, selector stability
npm run spike:marocannonces     # 3 runs, selector stability
```

Raw output, screenshots and per-run JSON land in `spike/out/` (gitignored). Golden fixtures for adapter regression live in `spike/fixtures/golden/`.

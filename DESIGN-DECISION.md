# P0 — Design decision record

**Status:** BUILT, awaiting your review · **Date:** 2026-10-22 · **Gate:** P0 (blocking P1)
**Decision needed:** pick one direction (or name a mix) and sign at the bottom. P1 does not start until this is signed.

---

## 1. What was built

Ten clickable mockups, each covering the **fourteen** drawing units that cover all fifteen P0 screens (PRD #3 job detail and #5 employer preview are one screen) with its own layout, navigation model, density and visual language. **01 Command Deck is the chosen direction** and carries the extra screen 16 (Profile). All ten render the **same real records** captured during the W0 spike (`spike/fixtures/golden` → `design/shared/data.js`): Auto Hall, Alten Maroc, AKDITAL, the unnamed MarocAnnonces classifieds, the banner-ad row with no title, the frozen `rekrute.com` challenge, and the real trust score of 76 (no WebGL, UTC vs Berlin).

Open `design/index.html` in a browser, or a single direction directly:

```
design/variants/01-command-deck/index.html
```

Screens are hash routes: `#dashboard #jobs #job #triage #verification #doctor #logs #scope #agent #profile #credentials #data #onboarding #pwa #settings`.
Every screen works at 390 px. Buttons are deliberately inert — they raise a "not wired in P0" toast — except the Profile form, which saves locally. P1 rebuilds the chosen direction properly.

Screenshots: `design/shots/<variant>-<screen>.png` and `<variant>-mobile.png` (regenerate with `node design/shoot.js`).

---

## 2. The ten directions

| # | Direction | Navigation model | Density | Type | Palette | Signature | Main trade-off |
|---|---|---|---|---|---|---|---|
| 01 | **Command Deck** | ⌘K command palette + icon rail + function keys | very dense (≈14 rows) | monospace throughout | graphite / cool blue | keyboard-first, log tail on the home screen | cold for a first-time user; icons need tooltips |
| 02 | **Le Dossier** | section sidebar + running head, single 68ch column | comfortable (1 record per block) | serif body, editorial | cool newsprint / ink blue / vermilion | reads like a personnel file, margin notes | slow to scan 20+ listings; no side-by-side compare |
| 03 | **Pipeline** | stage bar with counts, kanban board as home | medium (cards) | humanist sans | white / slate / violet | the state machine *is* the interface | cards hide detail; 4 columns fight for width |
| 04 | **Ops Terminal** | F1–F12 bar (one key per screen) | very dense | monospace, amber phosphor | charcoal / amber / red | answers "what is it doing and what broke" at 3am | intimidating; amber narrows the palette |
| 05 | **Swiss Ledger** | numbered sections, 7 per row, hairline rules | dense (tables + big numerals) | grotesk, tight tracking | black / white / one red | information design as the aesthetic | severe; no warmth, no iconography |
| 06 | **Soft Stack** | pill row on desktop, bottom tabs on phone | airy (large targets) | system sans | off-white / lilac / mint | one-thumb approval on Android | low information density on desktop |
| 07 | **Split Inspector** | tree navigator + content + inspector + status bar | very dense (IDE-like) | 12 px system sans | #fafafa / blue | list and detail visible at once; nothing moves | three columns need ≥1100 px; right pane is secondary on phone |
| 08 | **Guided** | 14-step stepper with progress ticks | airy (one decision per screen) | large sans (38 px headings) | white / teal | turns stress moments (OTP, freeze) into one clear action | slow for routine scanning; stepper implies false linearity |
| 09 | **Nightwatch** | floating segmented control + right drawer | medium (big numerals) | sans, tabular figures | #0e1116 / blue / glow | ambient monitoring of a VPS that runs while you sleep | dark-only; glow can read as decoration |
| 10 | **Sheet** | workbook tab strip at the bottom + formula bar | very dense (spreadsheet) | 12 px sans + mono figures | white / grid grey / blue | every field visible, sortable, editable in place | hostile at 390 px (columns collapse to label + action) |

### Mobile behaviour (390 px)

- 01 hides the icon rail, adds a scrollable text nav under the bar.
- 02 collapses the sidebar into a wrapping section list.
- 03 stacks the board vertically, stage bar scrolls.
- 04 keeps all twelve function keys, 4 per row, pinned bottom.
- 05 keeps the numbered grid at 6 per row; mast metadata drops out.
- 06 *is* the mobile design: bottom tabs, stacked cards.
- 07 tree becomes a horizontal chip strip; inspector moves below content.
- 08 unchanged by design — it is already phone-shaped.
- 09 segmented control scrolls; drawer falls below content.
- 10 keeps row label + row action, hides middle columns.

---

## 3. Decision

**Chosen: 01 Command Deck** — product owner, 2026-10-22. Keyboard-first operator console: ⌘K palette, icon rail, dense tables, monospace throughout. It wins because the product is an operator tool used in short bursts on a PC, and 01 makes every screen reachable from the keyboard without a new layout per task. The profile editor was then added in the same language (§5, screen 16).

**Not taken:** the earlier hybrid recommendation (07 + 09 + 06) — kept below for the record. If the phone proves cramped once real data lands, 06's card stack is the fallback for the PWA only.

**Recorded recommendation (superseded):** 07's structure and density + 09's status numerals and blocked banner + 06's phone screens.

---

## 4. Design tokens — frozen for 01 Command Deck

P1 builds these. Names are the contract; values can still be nudged for contrast, but not for taste.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#15171a` | app background |
| `--panel` | `#1c1f24` | panels, tables |
| `--panel-2` | `#22262c` | raised rows, active control |
| `--ink` | `#e8eaed` | primary text |
| `--dim` | `#8b93a1` | secondary text, labels, metadata |
| `--line` | `#2b3037` | borders, table rules |
| `--accent` | `#7aa2f7` | focus, selection, primary action |
| `--ok` | `#9ece6a` | pass, synced, ready |
| `--warn` | `#e0af68` | needs-you, warnings, conflicts, unsaved |
| `--bad` | `#f7768e` | frozen, blocked, destructive |
| `--radius` | `3px` (panels, inputs) / `4px` (panels) | corners; no pills except status chips |
| `--space-1…5` | `4 8 10 14 16` | layout scale |
| `--text-xs…lg` | `11 12 13 15` | type scale; headings 15 px, KPI 26 px |
| `--row-h` | `26px` | dense table row (10 px cell padding) |
| `--mono` | `ui-monospace, "SF Mono", Menlo` | everything |
| `--font-ui` | same mono stack | intentional: no second family |

Hard rules carried into P1, from the PRD: colour is never the only signal (every pill carries a word); every long-running action names its host and current site; destructive actions require typing or an explicit second click; secrets never render in mockups, logs or prompts.

---

## 5. Component inventory — mapped to PRD §7

Drawn in all ten directions unless stated.

| PRD §7 screen | Components | Seen in |
|---|---|---|
| 1 Dashboard | AppShell, RunStatusCard (state/site/page/elapsed/progress), StatTile, StatusPill, TrustBadge, BlockedBanner, KillSwitch | all ten |
| 2 Jobs / Results | FilterBar, SavedFilterChip, RecordTable or JobCard, GroupHeader (country→city), SourceCount, SignalTag, LowSignalBucket, **ZeroResultCard** (what was checked + next action) | all ten |
| 3 Job detail | JobHeader, FactGrid, FitBreakdown, TailorAction, ReviewerNotes, SourceLink, RawPostingDisclosure | all ten — same screen as #5 |
| 4 Triage / Approval | QueueGroup (Ready / Needs-you / Skip), BulkActionBar, ApprovalCard, HonestyBadge, SkipReason, PreviewDrawer | all ten |
| 5 What the employer sees | DocumentPreview (PDF frame), PayloadFieldTable, TranslationPreview, SubmitWarning | all ten — right half of the job screen |
| 6 Verification | FreezeBanner, PausedTabScreenshot, OTPInput, GuidanceList (account/search/phone/validity), TakeControl, Resume, AbandonConfirm, VerificationHistory, PushNotice | all ten |
| 7 Doctor | CheckTable (state / why / fix), TrustScore + signal breakdown, RunAnywayConfirm (logged), FixAction, CopyDiagnostics | all ten |
| 8 Logs | LogRow (time/level/agent/site/msg/duration), LevelBadge, Filters, RunTimeline, ExplainError, ExportBundle, RedactionNote | all ten |
| 9 Search Scope | SiteTable, ModeChip (`adapter`/`generic`/`api`/`paste`), AdapterState, LastScan, LocationPicker (country→city), AddSite, **NoCrawlNotice** | all ten |
| 10 Credentials | CredentialRow (masked), Reveal + audit, VaultLock, RotatePassphrase, NeverInPromptNotice | all ten |
| 11 Data & Sync | HostCard (state/heartbeat/db/events), SyncStatus, ConflictCard (both values, keep one), BackupFreshness, ExportAll, DeleteAllConfirm, ReplayNote | all ten |
| 12 Settings | SettingsSection, KeyField, ModelSelect, ScheduleEditor, SendHoursEditor, LanguageSelect, DeploymentTarget, SaveBar + restart notice | all ten |
| 13 Agent setup | BrowserChoice (Brave/Chrome), ProfilePath, SessionSurvivalChecklist (cookies / history / restore), Recheck, SignedOutList, RiskNote | all ten |
| 14 Onboarding | Stepper, SetupStepCard, ProgressBar, DefaultsNote (editable later), RiskAcknowledgement, FirstRunCTA | all ten |
| 15 PWA mirror | PhoneFrame, BottomTabs, CompactApprovalCard, FreezeCard, OTPEntry, TrustPill, PushTest | all ten |
| 16 Profile / my data | ProfileForm (identity, links), RoleChips (add/remove), TargetSelects, ResumeDrop, ParsedFactTable, VersionTable, SaveBar (save / revert / export JSON / reset) | **01 only** — added after sign-off, at the product owner's request |

**Coverage:** all 15 PRD §7 screens, in 14 screens per direction (job detail and employer preview are one screen), plus **screen 16 Profile** drawn in 01 at the owner's request. All 141 variant/screen pairs render without a JS error (`node design/check.js`).
`job` is reached from a listing row; `settings` from the nav, or from the Browser screen in 04 and 05 where the fixed F-key / numbered-section model has no spare slot. That is an IA decision, not a gap: a detail view is a drill-down, and 04's twelve function keys are the point of 04.
`profile` is the only screen with behaviour: edits save to `localStorage` (this browser), Export downloads the JSON, Reset clears it. In P1 the same shape writes to the event log and the resume file is parsed server-side.

---

## 6. Review checklist — result

| Check | Result |
|---|---|
| Navigation model differs, not just colour | 5 distinct models: palette/rail, sidebar, stage bar, function keys, tree+inspector, stepper, segmented control, sheet tabs |
| Density varies ≥3× | yes — 07/10 ≈ 14 rows per screen, 08 ≈ 2 decisions per screen |
| Typeface families differ | monospace (01, 04), serif (02), grotesk (05), system sans (03, 06, 07, 08, 09, 10) |
| Radius and borders differ | 0 px (04, 05, 10) → 4 px (01, 07) → 12–18 px (03, 06, 08) → 26 px phone frames |
| Dashboard answers a different question first | 01 "what is running", 02 "what needs a signature", 03 "where is the work", 04 "what broke", 05 "the numbers", 06 "what needs you", 07 "run 41", 08 "one next action", 09 "is it healthy", 10 "the whole dataset" |
| Verification cannot be reached by accident | every direction freezes and blocks navigation to a submit action |
| Status never colour-only | every pill carries a word (`PASS`, `frozen`, `READY`, `sync`, …) |
| 390 px without horizontal page scroll | verified in screenshots for all ten; 10 collapses spreadsheet columns by design |
| Keyboard focus visible | default focus rings kept; 01/04 additionally advertise shortcuts |
| No direction is a recolour of another | confirmed against the table above |

---

## 7. Known limits of the mockups

- Data is a fixture; nothing reads or writes a database.
- "Take control" is a still frame — in the product it is a CDP screencast with forwarded input (see `SPIKE-REPORT.md` §5).
- Trust score 76 comes from the real headless host; on your x86 PC with Mesa the same screen will show a different number.
- The Brave "Forgetful Browsing" copy is the corrected version: three real preferences (`cookies_on_exit`, `browsing_history_on_exit`, `restore_on_startup`), not a toggle that does not exist. An ADR is owed at P1.
- No dark/light twin: each direction commits to one. 07 and 09 are the natural pair if you want both.
- 01's Profile form is the one screen that does something: values persist in `localStorage` for that browser and origin. It is not a database, it does not sync, and it will be replaced by the event log in P1 without changing the field names.

---

## 8. Sign-off

Fill this in (or reply in chat with the same information):

```
Chosen direction: 01 Command Deck ........................................  (2026-10-22)

Mix:               none. 01 as-is; phone layout to be revisited with real data
                   (06 Soft Stack stays the fallback for the PWA only).

Keep:              ⌘K palette, icon rail, dense tables, monospace, dark surface,
                   status chips that always carry a word.

Change:            Profile / my data added as screen 16 — identity, target roles,
                   resume file, parsed facts. Live locally in the mockup.

Signed:            product owner (chat)   Date: 2026-10-22
```

Once signed: tokens above are frozen, the component inventory becomes the P1 build order, and no new screens are added without a PRD change.

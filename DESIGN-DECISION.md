# P0 — Design decision record

**Status:** BUILT, awaiting your review · **Date:** 2026-10-22 · **Gate:** P0 (blocking P1)
**Decision needed:** pick one direction (or name a mix) and sign at the bottom. P1 does not start until this is signed.

---

## 1. What was built

Ten clickable mockups, each covering the twelve P0 screens with its own layout, navigation model, density and visual language. All ten render the **same real records** captured during the W0 spike (`spike/fixtures/golden` → `design/shared/data.js`): Auto Hall, Alten Maroc, AKDITAL, the unnamed MarocAnnonces classifieds, the banner-ad row with no title, the frozen `rekrute.com` challenge, and the real trust score of 76 (no WebGL, UTC vs Berlin).

Open `design/index.html` in a browser, or a single direction directly:

```
design/variants/07-split-inspector/index.html
```

Screens are hash routes: `#dashboard #jobs #triage #verification #doctor #logs #scope #agent #credentials #data #onboarding #pwa`.
Every screen works at 390 px. Buttons are deliberately inert — they raise a "not wired in P0" toast — so nothing here pretends to be product code. P1 rebuilds the chosen direction properly.

Screenshots: `design/shots/<variant>-<screen>.png` and `<variant>-mobile.png` (regenerate with `node design/shoot.js`).

---

## 2. The ten directions

| # | Direction | Navigation model | Density | Type | Palette | Signature | Main trade-off |
|---|---|---|---|---|---|---|---|
| 01 | **Command Deck** | ⌘K command palette + icon rail + function keys | very dense (≈14 rows) | monospace throughout | graphite / cool blue | keyboard-first, log tail on the home screen | cold for a first-time user; icons need tooltips |
| 02 | **Le Dossier** | section sidebar + running head, single 68ch column | comfortable (1 record per block) | serif body, editorial | cool newsprint / ink blue / vermilion | reads like a personnel file, margin notes | slow to scan 20+ listings; no side-by-side compare |
| 03 | **Pipeline** | stage bar with counts, kanban board as home | medium (cards) | humanist sans | white / slate / violet | the state machine *is* the interface | cards hide detail; 4 columns fight for width |
| 04 | **Ops Terminal** | F1–F12 bar (one key per screen) | very dense | monospace, amber phosphor | charcoal / amber / red | answers "what is it doing and what broke" at 3am | intimidating; amber narrows the palette |
| 05 | **Swiss Ledger** | numbered 12-column top sections | dense (tables + big numerals) | grotesk, tight tracking | black / white / one red | information design as the aesthetic | severe; no warmth, no iconography |
| 06 | **Soft Stack** | pill row on desktop, bottom tabs on phone | airy (large targets) | system sans | off-white / lilac / mint | one-thumb approval on Android | low information density on desktop |
| 07 | **Split Inspector** | tree navigator + content + inspector + status bar | very dense (IDE-like) | 12 px system sans | #fafafa / blue | list and detail visible at once; nothing moves | three columns need ≥1100 px; right pane is secondary on phone |
| 08 | **Guided** | 12-step stepper with progress ticks | airy (one decision per screen) | large sans (38 px headings) | white / teal | turns stress moments (OTP, freeze) into one clear action | slow for routine scanning; stepper implies false linearity |
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

## 3. Recommendation

**Primary: 07 Split Inspector.** Reasons: the product's core loop is *scan → inspect → approve*, which is exactly list + detail side by side; a power user on a PC will have 20–60 live records, and only 07 lets you compare without losing your place; the persistent status bar carries the run/host/trust information the PRD demands on every screen; and its component vocabulary (rows, panels, status pills) is the cheapest to implement in P1.

**Mobile: 06 Soft Stack**, used only for the PWA mirror. 07 at 390 px degrades exactly where it matters least (the phone is for approvals and unblocking), while 06's card stack and bottom tabs are built for that.

**Monitoring flavour: 09 Nightwatch**, borrowed as a *treatment*, not a layout — big tabular numerals, a pulse on the live run, and the blocked banner at the top of the dashboard. It answers "is the VPS healthy" faster than any table.

**Proposed hybrid:** 07's structure and density + 09's status numerals and blocked banner + 06's phone screens. Everything else (sidebar nav, kanban, stepper) is dropped.

If you prefer a single direction unmodified, say so and I will build exactly that.

---

## 4. Design tokens (provisional, for the 07 + 09 + 06 hybrid)

Filled in P1 once the direction is signed; names are the contract, values are the starting point.

| Token | Value | Use |
|---|---|---|
| `--surface` | `#fafafa` | app background (desktop) |
| `--panel` | `#ffffff` | rows, panels, cards |
| `--ink` | `#1f2328` | primary text |
| `--muted` | `#656d76` | secondary text, metadata |
| `--line` | `#d8dee4` | borders, table rules |
| `--accent` | `#1a73e8` | primary action, selection, links |
| `--ok` | `#1a7f37` | pass, synced, ready |
| `--warn` | `#9a6700` | needs-you, warnings, conflicts |
| `--danger` | `#cf222e` | frozen, blocked, destructive |
| `--radius` | `4px` (desktop) / `16px` (phone cards) | panel corners |
| `--space-1…6` | `4 8 12 16 24 32` | layout scale |
| `--text-xs…xl` | `11 12 14 16 22` | type scale |
| `--row-h` | `26px` | dense table row |
| `--mono` | `ui-monospace, Menlo` | ids, hashes, timestamps, figures |
| `--status-dark` | `#0e1116 / #58a6ff` | Nightwatch dashboard surface |

Hard rules carried into P1, from the PRD: colour is never the only signal (every pill carries a word); every long-running action names its host and current site; destructive actions require typing or an explicit second click; secrets never render in mockups, logs or prompts.

---

## 5. Component inventory — mapped to PRD §7

Drawn in all ten directions unless stated.

| PRD §7 screen | Components | Seen in |
|---|---|---|
| 1 Dashboard | AppShell, RunStatusCard (state/site/page/elapsed/progress), StatTile, StatusPill, TrustBadge, BlockedBanner, KillSwitch | all ten |
| 2 Jobs / Results | FilterBar, SavedFilterChip, RecordTable or JobCard, GroupHeader (country→city), SourceCount, SignalTag, LowSignalBucket, **ZeroResultCard** (what was checked + next action) | all ten |
| 3 Job detail | JobHeader, FactGrid, FitBreakdown, TailorAction, ReviewerNotes, SourceLink, RawPostingDisclosure | **specified, not drawn** — composed from rows/panels above |
| 4 Triage / Approval | QueueGroup (Ready / Needs-you / Skip), BulkActionBar, ApprovalCard, HonestyBadge, SkipReason, PreviewDrawer | all ten |
| 5 What the employer sees | DocumentPreview (PDF frame), PayloadFieldTable, TranslationPreview, SubmitWarning | **specified, not drawn** — PDF frame + field table |
| 6 Verification | FreezeBanner, PausedTabScreenshot, OTPInput, GuidanceList (account/search/phone/validity), TakeControl, Resume, AbandonConfirm, VerificationHistory, PushNotice | all ten |
| 7 Doctor | CheckTable (state / why / fix), TrustScore + signal breakdown, RunAnywayConfirm (logged), FixAction, CopyDiagnostics | all ten |
| 8 Logs | LogRow (time/level/agent/site/msg/duration), LevelBadge, Filters, RunTimeline, ExplainError, ExportBundle, RedactionNote | all ten |
| 9 Search Scope | SiteTable, ModeChip (`adapter`/`generic`/`api`/`paste`), AdapterState, LastScan, LocationPicker (country→city), AddSite, **NoCrawlNotice** | all ten |
| 10 Credentials | CredentialRow (masked), Reveal + audit, VaultLock, RotatePassphrase, NeverInPromptNotice | all ten |
| 11 Data & Sync | HostCard (state/heartbeat/db/events), SyncStatus, ConflictCard (both values, keep one), BackupFreshness, ExportAll, DeleteAllConfirm, ReplayNote | all ten |
| 12 Settings | SettingsSection, KeyField, ModelSelect, ScheduleEditor, SendHoursEditor, LanguageSelect, DeploymentTarget, SaveBar + restart notice | **specified, not drawn** — plain form rows; send-hours already appears in the sync conflict card |
| 13 Agent setup | BrowserChoice (Brave/Chrome), ProfilePath, SessionSurvivalChecklist (cookies / history / restore), Recheck, SignedOutList, RiskNote | all ten |
| 14 Onboarding | Stepper, SetupStepCard, ProgressBar, DefaultsNote (editable later), RiskAcknowledgement, FirstRunCTA | all ten |
| 15 PWA mirror | PhoneFrame, BottomTabs, CompactApprovalCard, FreezeCard, OTPEntry, TrustPill, PushTest | all ten |

**Coverage:** 12 of 15 drawn, 3 (job detail, employer preview, settings) specified as compositions of components that already exist in every direction. P0 scope froze the twelve drawn screens, so these three were not invented. Say the word and I will draw them in the chosen direction (≈2–3 hours) before P1 starts.

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

---

## 8. Sign-off

Fill this in (or reply in chat with the same information):

```
Chosen direction: ................................................  (07 recommended)

Mix:               primary ............  + status from ............  + phone from ............

Keep:              ..............................................................................

Change:            ..............................................................................

Draw the three missing screens first?   [ ] yes   [ ] no, specify in P1

Signed:            ............................................   Date: ......................
```

Once signed: tokens above are frozen, the component inventory becomes the P1 build order, and no new screens are added without a PRD change.

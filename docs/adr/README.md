# Architecture Decision Records (ADRs)

Format: [Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) style. One decision per file. Status values: Proposed · Accepted · Superseded by ADR-XXXX · Deprecated.

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-brave-as-agent-browser.md) | Brave as the agent browser, Chrome as one-line fallback | Accepted |
| [0002](0002-owned-browser-never-attach.md) | Backend owns and launches its browser; never attaches to the user's browser | Accepted |
| [0003](0003-prefill-only-human-submit.md) | Prefill-only apply; the human always clicks Submit | Accepted |
| [0004](0004-no-volume-caps.md) | Remove daily volume caps; rely on pacing, send-hours and the approval gate | Accepted |
| [0005](0005-per-site-adapters-no-universal-scraper.md) | Per-site adapters + paste-URL; no universal scraper or "full internet" mode | Accepted |
| [0006](0006-llm-failover-pause-not-downgrade.md) | Failover pauses the run instead of downgrading mid-batch; Ollama is draft-tier | Accepted |
| [0007](0007-verification-freeze-and-handoff.md) | Verification walls freeze the agent and hand control to the user | Accepted |
| [0008](0008-doctor-and-heuristic-trust-score.md) | Doctor environment checks + heuristic browser trust score (non-blocking) | Accepted |
| [0009](0009-event-sourced-local-first-data.md) | Event-sourced core with local-first SQLite on every host | Accepted |
| [0010](0010-pc-vps-host-link-sync.md) | PC↔VPS sync via WebSocket Host Link, single run-host, conflict cards | Accepted |
| [0011](0011-secrets-encryption-and-redaction.md) | AES-256-GCM vault, E2E-encrypted sync blobs, enforced log redaction | Accepted |
| [0012](0012-deployment-and-pwa-transport.md) | BYO PC/VPS deployment; Tailscale + Let's Encrypt + VAPID for PWA | Accepted |
| [0013](0013-latex-tectonic-and-pdf-path.md) | LaTeX via Tectonic, with Markdown→PDF as the first shipping path | Accepted |
| [0014](0014-triage-queue-and-rejection-taxonomy.md) | Triage queue + rejection taxonomy instead of raw approval cards | Accepted |
| [0015](0015-delivery-gates-spike-and-design.md) | W0 feasibility spike gate; P0 design gate with 10 variants | Accepted |
| [0016](0016-notification-tiers.md) | Three notification tiers with quiet hours | Accepted |
| [0017](0017-skills-v1-hardcoded.md) | Skills v1 are hardcoded prompt packs; runtime deferred | Accepted |
| [0018](0018-generic-extraction-and-run-host-setting.md) | Generic extraction as a third mode; run host + per-site mode are settings (supersedes part of 0005) | Accepted |
| [0019](0019-p1-runtime-node-sqlite-no-framework.md) | P1 runtime uses built-in `node:sqlite` + `node:http`; no framework, no native module | Accepted |

**Adding an ADR:** copy the template in any file, use the next number, add a row above. Never edit an accepted decision's substance — supersede it with a new ADR.

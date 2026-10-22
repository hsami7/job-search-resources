# ADR-0005 — Per-site adapters + paste-URL; no universal scraper or "full internet" mode

- **Status:** Accepted — superseded in part by [ADR-0018](0018-generic-extraction-and-run-host-setting.md) (generic structured-data extraction added as a third mode; "no universal scraper / no full-internet mode" still stands)
- **Date:** 2026-10-22
- **Related:** PLAN §3/§3.1, PRD FR-SCP-01/02, FR-DSC-01..05

## Context
v4 promised user-added arbitrary sites plus a "full internet" mode. Critique: unbounded selector maintenance for a single developer, low signal, and a false promise of universal scraping. L2 APIs cover only a fraction of Moroccan listings.

## Decision
1. **Per-site adapters** for a validated, hand-maintained set of sites (spike-validated first: ReKrute, MarocAnnonces; global via L2).
2. Sites the user adds without an adapter are **routed to paste-URL capture** with an explicit UI explanation — never a silent failure.
3. **"Full internet" mode is removed.** Broad coverage is provided by L2 APIs (Arbeitnow/Remotive/Adzuna/JSearch/Greenhouse/Lever), not an open-web crawler.
4. Paste-URL is a **first-class source**, available from PC and PWA, plus forwarded WhatsApp/Facebook post ingestion (text + optional screenshot OCR).
5. Classifieds noise is handled by a **signal-vs-noise filter** (unpaid internships, 12h/day, franchise offers) with a default-hidden low-signal bucket and user-overridable thresholds.

## Consequences
- Positive: honest scope; maintainable surface; adapters fail loudly with an alternative path; better signal quality on classifieds sites.
- Negative: coverage limited to supported sites + pasted links; new site adapters cost development time.
- Mitigation: adapter contract + golden fixtures so adding a site is isolated; user-visible adapter status.

## Alternatives considered
- Generic DOM-based universal scraper: rejected (fragile, low precision).
- Full-internet crawler: rejected (detection, ToS, maintenance, noise).

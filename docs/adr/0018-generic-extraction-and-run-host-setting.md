# ADR-0018 — Generic extraction as a third mode; run host + per-site mode are settings

- **Status:** Accepted
- **Date:** 2026-10-22
- **Related:** ADR-0005 (superseded in part), ADR-0002, ADR-0010, PLAN §2.4/§3/§3.1, PRD FR-SCP-01/02, FR-DSC-01/02/03

## Context
ADR-0005 limited discovery to hand-written per-site adapters plus paste-URL, and explicitly rejected a "generic DOM-based universal scraper". Recorded consequence: *"coverage limited to supported sites + pasted links"*. The user's requirement is broader: the tool should reach as many job sites as possible, not two.

The ADR-0005 rejection reasoning was aimed at DOM-guessing (find the title / find the salary by heuristics), which is fragile and low precision. It did not consider extraction from **published structured data**: many job pages embed `application/ld+json` with `@type: JobPosting` (a schema.org vocabulary maintained for Google-for-Jobs) and OpenGraph metadata. Reading a published standard is not guessing.

Separately, the plan already has a "run location" card (PLAN §2.4) and a per-site status list (PLAN §3.1), but not as a single explicit setting that onboarding asks for and the user can change later.

## Decision
1. **Three extraction modes, one paste mode.** Every site entry carries a mode:
   - `adapter` — per-site code; required for search-results pages, pagination, login walls (ReKrute, MarocAnnonces, job.ma).
   - `generic` — no per-site code: `application/ld+json` `JobPosting` → OpenGraph → conservative main-content heuristics. Works on public job pages that publish structured data (most global/ATS sites).
   - `api` — L2 providers (Arbeitnow, Remotive, Adzuna, JSearch, Greenhouse/Lever boards).
   - `paste` — a URL (or forwarded post) supplied by the user; extraction uses the `generic` path.
2. **Generic extraction does not discover.** It extracts from a page it was pointed at. It is not a crawler and gives no open-web search. ADR-0005 §3 ("full internet mode removed") stands.
3. **Run host is a setting, asked once, changeable.** Onboarding asks "where should jobPilot search from?" (PC / VPS); the answer persists in settings and is editable in Settings → Deployment. Changing it follows the ADR-0010 handoff (drain → sync → switch run host).
4. **Per-site mode and enable/disable are user-editable** in Settings → Search Scope (web + PWA), with adapter status shown per site.
5. **Honest labels.** The UI must not claim "any website". Allowed claim: "your sites + job APIs + any job link you give it". Generic extraction failures surface per-source with the paste fallback, never silently.

## Consequences
- Positive: coverage scales without linear adapter cost; the "search all the web" expectation gets a truthful, testable middle answer; the setting model the user asked for is explicit.
- Negative: still not open-web search; generic mode yields nothing on classifieds sites without structured data; more sites touched means more ToS/ban surface, consistent with the accepted "middle" risk appetite (PLAN §13).
- Mitigation: W0 measures the generic hit rate per platform and reports it; the claim is narrowed to whatever that evidence supports. Extraction is read-only and human-paced; prefill-only and freeze-on-challenge rules are unchanged.

## Alternatives considered
- Keep adapters + paste only (ADR-0005 as-is): rejected — leaves the user's coverage requirement unmet, and paste-only is too manual for global sites.
- Generic DOM-guessing scraper: still rejected (ADR-0005 reasons hold).
- Open-web crawler / "full internet" mode: still rejected (detection, ToS, maintenance, noise).

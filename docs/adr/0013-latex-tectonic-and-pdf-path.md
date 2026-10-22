# ADR-0013 — LaTeX via Tectonic, with Markdown→PDF as the first shipping path

- **Status:** Accepted
- **Date:** 2026-10-22
- **Related:** PLAN §4 (Tailoring), PRD FR-TAL-01/05, NFR-I18N-01

## Context
The user wants Overleaf-quality resumes/cover letters. Tectonic compiles LaTeX locally without a browser, but template engineering (especially Arabic RTL) and compile debugging are heavy. A working pipeline is needed before LaTeX polish.

## Decision
1. **Phase A (P3 start):** generate documents from structured data → Markdown → PDF (simple, reliable template). Unblocks tailoring, approval and submission.
2. **Phase B (P3):** add **Tectonic** + LaTeX template set for the chosen design; artifacts become LaTeX source + compiled PDF.
3. Deterministic validation (claims/required fields/injected URLs) runs on the **structured content**, independent of renderer, so honesty checks are not tied to LaTeX.
4. Artifacts are versioned with content hashes; unchanged inputs skip recompilation.
5. Arabic/French support follows NFR-I18N-01 with per-language templates; Arabic LaTeX layout is validated by a dedicated fixture before being offered.
6. If Tectonic is missing, Doctor reports WARN and Phase-A rendering remains available.

## Consequences
- Positive: pipeline works on day one; LaTeX quality added without blocking; PDF output is consistent; tests target content, not layout.
- Negative: two renderers to maintain during P3; template styling iteration needed; Arabic support may lag.
- Mitigations: single content model + template adapter interface; golden PDF fixtures per language.

## Alternatives considered
- LaTeX-only from day one: rejected (schedule risk).
- HTML→PDF (puppeteer print): viable fallback; kept behind the same renderer interface.
- Drive Overleaf via browser: rejected in v4 (fragile, ToS).

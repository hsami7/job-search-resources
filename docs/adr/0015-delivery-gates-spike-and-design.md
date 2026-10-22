# ADR-0015 — W0 feasibility spike gate; P0 design gate with 10 variants

- **Status:** Accepted
- **Date:** 2026-10-22
- **Related:** PLAN §0/§12, PRD §4, MILESTONES W0/P0

## Context
The entire product rests on browser-driven discovery against anti-bot sites, but the plan originally started with UI design. Review also warned that 10 design mockups could delay learning without real data — the user still wants 10 options.

## Decision
1. **W0 (blocking, 1 week):** a throwaway spike proves CDP browsing on ReKrute + MarocAnnonces in **both Brave and Chrome**, paste-URL extraction, one L2 API, trust-score probes, and the freeze-on-challenge behavior. Output is a GO/NO-GO report with pinned versions. **No design or production code starts before GO.**
2. **P0 (blocking):** after GO, produce **10 distinctly different UI/UX directions** as clickable mockups of the PRD screens. User picks one (or mixes). Deliverable includes design tokens and a component inventory (`DESIGN-DECISION.md`).
3. If the spike is NO-GO, discovery is re-planned (L2 + paste-URL primary) and the plan is revised before proceeding.

## Consequences
- Positive: kills the biggest unknown first; evidence-based browser choice; design exploration happens against a known-feasible product.
- Negative: a week with no product artifact; design choice can still be partly wrong once real data exists.
- Mitigations: spike uses real target sites; P0 mockups use realistic sample data; design tokens flexible enough to iterate.

## Alternatives considered
- Design-first (original plan): rejected (risk).
- No design phase (stock UI): rejected — user explicitly wants 10 options.
- More than 10 variants: rejected (diminishing returns, delay).

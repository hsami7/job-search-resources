# ADR-0014 — Triage queue + rejection taxonomy instead of raw approval cards

- **Status:** Accepted
- **Date:** 2026-10-22
- **Related:** PLAN §9/§4.3, PRD FR-APR-01, FR-APR-06/07

## Context
With caps removed and multi-country discovery, a good day can produce 30–80 tailored applications. Flat approve-each cards cause fatigue, blind approvals and abandonment. Learning was asserted but unspecified.

## Decision
- **Triage queue** groups approvals by (match score × honesty-fit): **Ready / Needs-you / Skip-pile**.
- Bulk actions: "approve top N", "snooze rest", per-group stamp review; always with a preview drawer.
- **Rule engine** allows auto-approval rules (job type, age, match threshold, site, language) — auto-approve only **prepares prefills**; it never sends (ADR-0003).
- **Rejection taxonomy:** rejecting a job/document requires 1–3 reason chips (+ optional edit/free text): wrong sector, seniority, format, too long, scam slipped, language, remote-vs-onsite, salary, spam.
- Rejections/edits become **typed memory events**; the learning panel shows applied rules weekly and lets the user clear them.
- Nothing is auto-sent from the rule engine.

## Consequences
- Positive: manageable daily workload; explicit feedback signals; observable learning; audit trail of decisions.
- Negative: rules can misclassify; more UI surface; users may bulk-approve carelessly.
- Mitigations: rules are editable and reviewable; "What I learned" transparency; preview always available; logs record bulk actions.

## Alternatives considered
- Flat card list (v4): rejected (fatigue).
- Fully automated approval: rejected (safety).
- No learning loop: rejected (product value).

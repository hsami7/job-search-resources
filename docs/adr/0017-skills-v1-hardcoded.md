# ADR-0017 — Skills v1 are hardcoded prompt packs; runtime deferred

- **Status:** Accepted
- **Date:** 2026-10-22
- **Related:** PLAN §4.2, PRD §2 non-goals, P6

## Context
v4 planned a Skills system with manifests, install-from-repo, tool bindings and per-agent toggles. Review flagged it as a plugin framework built before the core pipeline works — high effort, low early value for a single user.

## Decision
- v1 ships the eight starter capabilities (`humanizer`, `latex-templates`, `ats-checker`, `scam-detector`, `reply-assistant`, `follow-ups`, `referral-emails`, `compensation-researcher` where applicable) as **versioned, hardcoded prompt/template packs** with global enable/disable toggles.
- No manifest format, no remote install, no tool-binding sandbox in v1.
- The internal interface keeps skills separable (prompt pack + optional deterministic hooks) so a runtime can be added later without rewriting agents.
- Full runtime is deferred to P6.

## Consequences
- Positive: faster path to a working product; fewer security surfaces (no remote code execution); simpler testing.
- Negative: no third-party skill sharing in v1; adding a skill means a release.
- Mitigation: keep packs data-driven (files, not code) so later migration to a runtime is mostly packaging.

## Alternatives considered
- Full plugin runtime in v1: rejected (scope, security).
- No skills concept at all: rejected — prompts still benefit from named packs and toggles.

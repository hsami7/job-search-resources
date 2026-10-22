# ADR-0006 — Failover pauses the run instead of downgrading mid-batch; Ollama output is draft-tier

- **Status:** Accepted
- **Date:** 2026-10-22
- **Related:** PLAN §4.1, PRD FR-TAL-07, FR-DSC (Ollama adapter)

## Context
v4 auto-fell back from OpenRouter to local Ollama. Risk: a mid-batch downgrade at night could send a small-model cover letter to a real recruiter under the user's name.

## Decision
- OpenRouter is primary; Ollama is the declared fallback, with per-agent model pickers.
- **No mid-batch downgrade.** If OpenRouter fails or runs out of credit during a run, the run **pauses** and notifies. The user decides whether to continue on Ollama.
- **Ollama-produced documents are draft-tier**: they go only to the approval queue, are visibly tagged ("local-model draft — review carefully"), and can never be auto-sent.
- A per-document **quality gate** (LLM-judged fluency + language check) flags weak outputs before they reach the queue.
- If both providers fail, the pipeline pauses + push notification.

## Consequences
- Positive: no silent quality collapse reaching employers; transparent cost/quality tradeoff; predictable behavior.
- Negative: runs may pause overnight and lose time; user attention required.
- Observability: model, tokens, cost and latency are logged per call; the run trace shows the pause reason.

## Alternatives considered
- Silent auto-switch (v4): rejected.
- Ollama-only: rejected on quality.
- Queue-and-retry with exponential backoff indefinitely: rejected (could stall without user awareness); pause + notify instead.

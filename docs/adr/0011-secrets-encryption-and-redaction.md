# ADR-0011 — AES-256-GCM vault and enforced log redaction

- **Status:** Accepted (amended 2026-10-22: local-only)
- **Date:** 2026-10-22
- **Related:** PLAN §2.7/§6, PRD FR-CRD-01..04, FR-LOG-03, NFR-SEC-01..03

## Context
The system handles site credentials, OAuth tokens, API keys, OTPs, cookies, and application/email content. Leakage would be severe, and logs multiply exposure surfaces.

## Decision
- **Vault:** per-site credentials (username, password, optional TOTP secret, notes) encrypted with **AES-256-GCM** using a passphrase-derived key (scrypt/Argon2id). Recovery code shown once. Reveal/copy requires passphrase. Every use audited.
- **LLM isolation:** plaintext credentials never enter prompts, model context, memory, or logs.
- **One store:** the vault lives in the PC's local `data/` directory. There is no credential replication or sync path.
- **Logging:** a mandatory redaction layer at the logging boundary removes passwords, cookies, tokens, API keys, OTP values and email bodies. OTPs log as "submitted (redacted)".
- **Diagnostic bundles** are produced through the same redaction pipeline; a test asserts no secret patterns appear.
- Cookies/profile data are file-protected and only included in export when the user explicitly chooses a full-profile export.

## Consequences
- Positive: strong at-rest secrecy; auditable credential use; safe shareable diagnostics; no second copy to protect.
- Negative: passphrase loss = vault loss (recovery code mitigates); redaction can occasionally over-redact useful diagnostics.
- Mitigations: recovery code; vault audit page; redaction allowlist for non-secret fields; regular redaction fixture tests.

## Alternatives considered
- OS keychain only: rejected (no deterministic test parity; the vault needs its own portable recovery path).
- Plaintext SQLite with file permissions: rejected.
- Third-party secret manager: rejected (self-hosted requirement, extra dependency).

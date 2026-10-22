# ADR-0012 — BYO PC/VPS deployment; Tailscale + Let's Encrypt + VAPID for PWA

- **Status:** Accepted
- **Date:** 2026-10-22
- **Related:** PLAN §2.4/§10, PRD FR-DEP-01..04, FR-PWA-01..04

## Context
The backend can run on the user's PC or VPS, is controlled from an Android PWA, and must send push notifications (especially captcha/verification alerts). Self-signed certs silently break PWA install, service workers and push.

## Decision
- **Deployment:** the same codebase runs on PC (default) or user-owned VPS; Docker or an install script; persistent volumes for profile, SQLite, artifacts, logs. Host choice is a setting; relocation is supported via export/import + sync.
- **Transport:** Tailscale `*.ts.net` name with **Let's Encrypt certificates** (no self-signed in the production path). Localhost + LAN also supported.
- **Push:** web-push with **VAPID keys committed at P1**; service worker verified by Doctor; Android battery-optimization exemption setup screen with explanation of late pushes.
- **Push availability truth:** push only fires while the host is on. On a VPS this is 24/7; on a PC the UI states the limitation and offers a catch-up digest on wake.
- **Verification alerts are tier-1** and bypass quiet hours.

## Consequences
- Positive: installable PWA, reliable pushes with a VPS, no certificate surprises, user-owned infrastructure.
- Negative: Tailscale dependency; OAuth redirect URLs must be registered against the ts.net domain; VPS costs.
- Mitigations: Doctor checks cert expiry/reachability and push registration; documented fallback to LAN/localhost.

## Alternatives considered
- Self-signed certs: rejected (breaks PWA/push silently).
- Cloud relay/backend: rejected (privacy, self-hosted requirement).
- Native Android app: rejected for v1 scope.

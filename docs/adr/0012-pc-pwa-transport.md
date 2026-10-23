# ADR-0012 — PC-hosted PWA transport: Tailscale Serve or LAN, trusted TLS, VAPID

- **Status:** Accepted (amended 2026-10-22: PC-only)
- **Date:** 2026-10-22
- **Related:** PLAN §2.4/§10, PRD FR-DEP-01..04, FR-PWA-01..04, ADR-0020

## Context
The backend runs only on the user's PC. The phone is an approval and verification client while the PC is on. A PWA needs a trusted HTTPS origin for service workers, installability, and push. Self-signed certificates break those silently.

## Decision
- **Host:** the PC only. The server stays bound to `127.0.0.1` by default and has no remote-host deployment mode.
- **Transport:** `tailscale serve` provides a tailnet-only HTTPS name under `*.ts.net` with a trusted certificate and proxies to `127.0.0.1:4319`. A same-LAN HTTPS option is allowed. Tailscale **Funnel** (public internet) is not used.
- **Auth:** Tailscale is the network layer, not the app's authentication. Token/session auth, a Trusted Host allowlist, and CSRF protection land before any non-loopback bind.
- **Push:** web-push with VAPID keys; the service worker is verified by Doctor; Android battery-optimization guidance is shown. Push only fires while the PC is on, and the UI says so.
- **Verification alerts** are tier-1 and bypass quiet hours.

## Consequences
- Positive: installable PWA with a trusted certificate, no open router port, no public exposure, one data store.
- Negative: Tailscale dependency; the phone must be on the tailnet; OAuth redirect URLs must be registered for the `ts.net` name; push stops when the PC sleeps.
- Mitigations: Doctor checks certificate expiry/reachability and push registration; documented LAN fallback; missed-run offer once on wake.

## Alternatives considered
- Self-signed certificates: rejected (break PWA/push silently).
- Public tunnel or public port-forward: rejected (exposes a single-user app; Funnel is not used).
- Native Android app: rejected for v1 scope.
- A second always-on host: rejected by the user; the PC is the only host.

# ADR-0021 — Browser session-survival gate; no v1 cookie import

- **Status:** Accepted
- **Date:** 2026-10-22
- **Related:** PLAN §2.1/§2.4, PRD FR-ONB-04/FR-BRW-01..03, ADR-0001, ADR-0002

## Context
The agent browser must keep site logins between restarts. Brave 1.98.60 has no global "Forgetful Browsing" toggle; the earlier UI copy referred to a setting that does not exist. Importing cookies from the user's everyday browser is unreliable across OS keychains and device-bound sessions, and the agent browser runs on the same PC anyway.

## Decision
1. **Hard gate:** onboarding verifies the three real preferences:
   - `browser.clear_data.cookies_on_exit = false`
   - `browser.clear_data.browsing_history_on_exit = false`
   - `session.restore_on_startup = 1` ("Continue where you left off")
2. **Behavioural proof:** the gate also runs a cookie-survives-restart test. Preferences alone are not enough.
3. **Fail closed:** if `chrome.settingsPrivate` is unavailable or any required preference is wrong, the gate stays closed. The user sees the exact fix.
4. **Stored as an event:** a PASS records `{gate: 'prefs-v1', passedAt, checksHash, engine}` in the settings/onboarding projection. No cookie values are stored.
5. **Login story:** one manual login per site inside the owned agent profile. No cookie-import wizard in v1.
6. **No false UI:** never present a "Forgetful Browsing" toggle or claim that one exists.

## Consequences
- Positive: the gate is testable, honest, and tied to the actual browser version; no secret cookies are copied around.
- Negative: the user must log in manually once per site; a site can still expire the session.
- Mitigation: the profile is persistent, the gate is re-checked by Doctor, and the Verification Center handles challenges.

## Alternatives considered
- A "Forgetful Browsing OFF" checkbox: rejected (the toggle does not exist).
- Cookie import from the everyday browser: rejected for v1 (OS keychains, DBSC, device-bound sessions).
- Trusting preferences without a restart test: rejected (does not prove persistence).

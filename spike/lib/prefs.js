// Reads Brave's own preference state through the settingsPrivate WebUI API.
// This is how the Doctor will verify browser config without parsing prefs files.
import { connect } from './browser.js';

export async function readBravePrefs(port) {
  const { browser, context } = await connect(port);
  const page = await context.newPage();
  try {
    await page.goto('brave://settings/shields', {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });
    await page.waitForTimeout(1500);
    const prefs = await page.evaluate(async () => {
      const all = await new Promise((res) => chrome.settingsPrivate.getAllPrefs(res));
      const pick = (key) => all.find((p) => p.key === key)?.value ?? null;
      return {
        clearCookiesOnExit: pick('browser.clear_data.cookies_on_exit'),
        clearHistoryOnExit: pick('browser.clear_data.browsing_history_on_exit'),
        clearCacheOnExit: pick('browser.clear_data.cache_on_exit'),
        clearSiteSettingsOnExit: pick('browser.clear_data.site_settings_on_exit'),
        restoreOnStartup: pick('session.restore_on_startup'),
        thirdPartyCookies: pick('generated.third_party_cookie_blocking_setting'),
        cookieDefault: pick('generated.cookie_default_content_setting'),
        shieldsStatsBadge: pick('brave.shields.stats_badge_visible'),
        hasForgetfulPref: all.some((p) => /forgetful/i.test(p.key)),
      };
    });
    return { ok: true, ...prefs };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    await page.close();
    await browser.close();
  }
}

// The onboarding gate the plan calls "Forgetful Browsing OFF" does not exist as a
// global pref on Brave desktop 1.98.60. The equivalent guarantees are checked here.
export function evaluateShieldChecks(p) {
  const checks = [];
  const add = (id, pass, detail, fix) =>
    checks.push({ id, status: pass ? 'PASS' : 'FAIL', detail, fix });

  add(
    'cookies-survive-close',
    p.clearCookiesOnExit === false,
    `browser.clear_data.cookies_on_exit = ${p.clearCookiesOnExit}`,
    'Settings → Privacy → Clear browsing data → On exit: untick Cookies. Persistent logins depend on this.',
  );
  add(
    'history-survives-close',
    p.clearHistoryOnExit === false,
    `browser.clear_data.browsing_history_on_exit = ${p.clearHistoryOnExit}`,
    'Untick "Browsing history" under clear-on-exit.',
  );
  add(
    'session-restore',
    [1, 4, 5].includes(p.restoreOnStartup),
    `session.restore_on_startup = ${p.restoreOnStartup}`,
    'Settings → On startup → "Continue where you left off".',
  );
  add(
    'no-global-forgetful-pref',
    p.hasForgetfulPref === false,
    `global "Forgetful Browsing" pref present = ${p.hasForgetfulPref}`,
    'Informational: this Brave build has no global forgetful switch; per-site "Forget me when I close this site" must stay unset.',
  );
  return checks;
}

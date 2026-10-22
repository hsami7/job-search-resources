// Verification-wall detection + a hard freeze guard (PLAN §2.8, ADR-0007).
// Detection is deliberately broad and fails SAFE: anything that looks like a human
// check stops the agent, because a false freeze costs a click and a false continue
// costs the account.
const URL_PATTERNS = [
  /captcha/i,
  /\/challenge\b/i,
  /checkpoint/i,
  /\/verify\b/i,
  /verification/i,
  /\/otp\b/i,
  /two-?factor/i,
  /\/2fa\b/i,
  /security[-_]?check/i,
  /account[-_]?lock/i,
  /unusual[-_]?activity/i,
];

const TITLE_PATTERNS = [
  /just a moment/i,
  /attention required/i,
  /security check/i,
  /verify you are human/i,
  /are you a robot/i,
  /unusual activity/i,
  /two-factor/i,
  /verification code/i,
  /confirm your identity/i,
  /access denied/i,
];

export async function detectChallenge(page) {
  const url = page.url();
  const title = await page.title().catch(() => '');

  const dom = await page
    .evaluate(() => {
      const q = (sel) => document.querySelector(sel);
      const signals = [];
      if (q('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], .g-recaptcha, .cf-turnstile, [data-sitekey]'))
        signals.push('captcha-widget');
      if (q('#challenge-form, #cf-wrapper, .cf-browser-verification, #cf-please-wait'))
        signals.push('cloudflare-block');
      if (q('input[name*="otp" i], input[id*="otp" i], input[autocomplete="one-time-code"]'))
        signals.push('otp-field');
      if (q('form[action*="challenge" i], form[action*="verify" i]')) signals.push('challenge-form');
      const text = document.body?.innerText?.slice(0, 4000) ?? '';
      for (const phrase of [
        /verify you are human/i,
        /enter the (verification|security) code/i,
        /we sent (a|an) (code|otp|link)/i,
        /complete the security check/i,
        /unusual activity/i,
        /your account (has been|is) (locked|temporarily locked)/i,
      ]) {
        if (phrase.test(text)) signals.push(`text:${phrase.source.slice(0, 30)}`);
      }
      return { signals, hasPasswordField: Boolean(q('input[type="password"]')) };
    })
    .catch(() => ({ signals: [], hasPasswordField: false }));

  const hits = [];
  if (URL_PATTERNS.some((re) => re.test(url))) hits.push('url');
  if (TITLE_PATTERNS.some((re) => re.test(title))) hits.push('title');
  if (dom.signals.length) hits.push('dom');

  if (!hits.length) return { challenge: false, url, title };

  const type = dom.signals.includes('otp-field')
    ? 'otp'
    : dom.signals.some((s) => s.startsWith('text:') && /code|otp/i.test(s))
      ? 'otp'
      : dom.signals.includes('captcha-widget')
        ? 'captcha'
        : dom.signals.includes('cloudflare-block')
          ? 'cloudflare'
          : 'security-challenge';

  return { challenge: true, type, url, title, hits, signals: dom.signals };
}

// Wraps a page so every interaction goes through the gate. Once frozen, nothing runs.
export function createGuard(page, onFreeze = () => {}) {
  let frozen = null;
  const check = () => {
    if (frozen) {
      const err = new Error(`AGENT FROZEN (${frozen.type}) — no further actions allowed`);
      err.code = 'FROZEN';
      throw err;
    }
  };

  return {
    get frozen() {
      return frozen;
    },
    async freeze(reason) {
      frozen = { ...reason, at: new Date().toISOString() };
      await onFreeze(frozen);
      return frozen;
    },
    async click(selector) {
      check();
      return page.click(selector);
    },
    async fill(selector, value) {
      check();
      return page.fill(selector, value);
    },
    async press(key) {
      check();
      return page.keyboard.press(key);
    },
    async goto(url) {
      check();
      return page.goto(url, { waitUntil: 'domcontentloaded' });
    },
  };
}

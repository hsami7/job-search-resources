// W0 step 8: prove a detected challenge stops every action, and that a normal page
// does not trigger a false freeze. Fixtures are served through page.route(), so no
// real captcha is ever triggered.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { launchBrave, connect, shot, OUT_DIR } from './lib/browser.js';
import { detectChallenge, createGuard } from './lib/freeze.js';

const { port } = await launchBrave();
const { browser, context } = await connect(port);
const page = context.pages()[0] ?? (await context.newPage());

// Serve local fixtures at fake sites instead of touching a live challenge.
const challengeHtml = readFileSync('spike/fixtures/challenge.html', 'utf8');
const normalHtml = readFileSync('spike/fixtures/form.html', 'utf8');
await page.route('**/fixture-host/**', (route) => {
  const body = route.request().url().includes('challenge') ? challengeHtml : normalHtml;
  route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body });
});

const events = [];
const guard = createGuard(page, async (frozen) => {
  events.push({ event: 'frozen', ...frozen });
  await shot(page, 'freeze-capture');
});

// --- 1. challenge page must freeze
await page.goto('https://bank.example/fixture-host/challenge.html', { waitUntil: 'domcontentloaded' });
const detection = await detectChallenge(page);
console.log(`[freeze] challenge page detected: ${detection.challenge} type=${detection.type} hits=${JSON.stringify(detection.hits)} signals=${JSON.stringify(detection.signals)}`);

let blocked = 0;
if (detection.challenge) {
  await guard.freeze(detection);
  for (const action of [
    () => guard.click('#c'),
    () => guard.fill('#c', '7KQ2'),
    () => guard.press('Enter'),
    () => guard.goto('https://example.com'),
  ]) {
    try {
      await action();
      console.log('[freeze] FAIL: action ran while frozen');
    } catch (err) {
      if (err.code === 'FROZEN') blocked++;
      else throw err;
    }
  }
}
const inputValue = await page.evaluate(() => document.getElementById('c')?.value ?? '<gone>');
console.log(`[freeze] actions blocked: ${blocked}/4, otp input untouched: ${inputValue === '' ? 'yes' : `NO (${inputValue})`}`);
console.log(`[freeze] still on page: ${page.url()}`);

// --- 2. normal page must NOT freeze (false positives burn runs)
const guard2 = createGuard(page);
await page.goto('https://bank.example/fixture-host/form.html', { waitUntil: 'domcontentloaded' });
const normal = await detectChallenge(page);
console.log(`[freeze] normal page detected as challenge: ${normal.challenge} (want false)`);
if (!normal.challenge) {
  await guard2.fill('#u', 'yassine');
  const v = await page.inputValue('#u');
  console.log(`[freeze] normal flow still usable: ${v === 'yassine' ? 'yes' : 'no'}`);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/freeze.json`, JSON.stringify({ detection, blocked, inputValue, normal, events }, null, 2));
await browser.close();

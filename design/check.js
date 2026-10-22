// Smoke-checks every variant/screen pair for JS errors and rendered content.
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { launchBrave, connect } from '../spike/lib/browser.js';

// Screens every direction must declare. 'profile' is Command Deck only for now.
const REQUIRED = ['dashboard', 'jobs', 'job', 'triage', 'verification', 'doctor', 'logs',
  'scope', 'agent', 'credentials', 'data', 'onboarding', 'pwa', 'settings'];

const { port } = await launchBrave();
const { browser, context } = await connect(port);
const page = await context.newPage();
let failures = 0;

for (const dir of readdirSync('design/variants').sort()) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const base = `file://${path.resolve(`design/variants/${dir}/index.html`)}`;
  await page.goto(base, { waitUntil: 'load' });
  const ids = await page.evaluate(() => Object.keys(window.VARIANT.screens));
  for (const s of REQUIRED) {
    if (!ids.includes(s)) { console.log(`MISSING ${dir} ${s}`); failures++; }
  }
  for (const s of ids) {
    await page.goto(`${base}#${s}`, { waitUntil: 'load' });
    await page.waitForTimeout(60);
    const chars = await page.evaluate(() => document.body.innerText.trim().length);
    const title = await page.title();
    if (chars < 200) { console.log(`EMPTY ${dir} #${s} (${chars} chars)`); failures++; }
    if (!title.includes(s)) { console.log(`TITLE  ${dir} #${s} → ${title}`); failures++; }
  }
  if (errors.length) { console.log(`ERRORS ${dir}: ${errors.slice(0, 3).join(' | ')}`); failures++; }
  else console.log(`ok ${dir} (${ids.length} screens)`);
}
console.log(failures ? `FAILURES: ${failures}` : 'all variants ok');
await browser.close();
process.exit(failures ? 1 : 0);

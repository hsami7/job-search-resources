// W0 step 4: browser trust score against a real page + Brave config checks.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchBrave, connect, OUT_DIR, PROFILE_DIR } from './lib/browser.js';
import { collectSignals, scoreSignals } from './lib/probes.js';
import { readBravePrefs, evaluateShieldChecks } from './lib/prefs.js';

const headless = process.env.HEADLESS === '1';
const port = Number(process.env.CDP_PORT || (headless ? 9223 : 9333));

const geo = await fetch('https://ipinfo.io/json')
  .then((r) => r.json())
  .catch(() => null);

const host = {
  timezone: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone,
  ipTimezone: geo?.timezone ?? null,
  ipCountry: geo?.country ?? null,
};

const { version } = await launchBrave({
  port,
  headless,
  userDataDir: headless ? path.join(PROFILE_DIR, '..', 'brave-headless') : PROFILE_DIR,
});
const { browser, context } = await connect(port);
const page = context.pages()[0] ?? (await context.newPage());
await page.goto('https://www.marocannonces.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(2000);

const signals = await collectSignals(page);
const result = scoreSignals(signals, host);

console.log(`\nMode: ${headless ? 'headless' : 'headed'}  Browser: ${version.Browser}`);
console.log(`IP geo: ${geo?.ip ?? '?'} ${host.ipCountry ?? '?'} ${host.ipTimezone ?? '?'}`);
console.log(`Score: ${result.score}/100 (${result.band})\n`);
for (const c of result.categories) {
  console.log(`${c.name}  ${c.earned.toFixed(1)}/${c.weight}`);
  for (const i of c.items) console.log(`  [${i.status}] ${i.label} — ${i.detail}`);
}

const prefs = await readBravePrefs(port);
const shieldChecks = prefs.ok ? evaluateShieldChecks(prefs) : [{ id: 'prefs', status: 'FAIL', detail: prefs.error }];
console.log('\nBrave config checks:');
for (const c of shieldChecks) console.log(`  [${c.status}] ${c.id} — ${c.detail}`);
console.log(`  prefs raw: ${JSON.stringify(prefs)}`);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  `${OUT_DIR}/trust-score-${headless ? "headless" : "headed"}.json`,
  JSON.stringify({ browser: version.Browser, host, signals, result, prefs, shieldChecks }, null, 2),
);
console.log(`\nwritten: ${OUT_DIR}/trust-score-${headless ? 'headless' : 'headed'}.json`);

await browser.close();

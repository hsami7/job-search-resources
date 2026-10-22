// Screenshots the mockups for review. Usage: node design/shoot.js [variantDir ...]
import { mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { launchBrave, connect } from '../spike/lib/browser.js';

const SHOTS = path.resolve('design/shots');
mkdirSync(SHOTS, { recursive: true });

const only = process.argv.slice(2);
const dirs = readdirSync('design/variants').filter((d) => !only.length || only.some((o) => d.includes(o)));
const screens = ['dashboard', 'jobs', 'job', 'triage', 'verification', 'doctor', 'logs',
  'scope', 'agent', 'profile', 'credentials', 'data', 'settings', 'pwa'];

const { port } = await launchBrave();
const { browser, context } = await connect(port);
const page = await context.newPage();
const cdp = await context.newCDPSession(page);

for (const dir of dirs) {
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  const base = `file://${path.resolve(`design/variants/${dir}/index.html`)}`;
  await page.goto(base, { waitUntil: 'load' });
  const ids = await page.evaluate(() => Object.keys(window.VARIANT.screens));
  // capture the fixture defaults, not whatever was typed in a previous demo run
  await page.evaluate(() => { try { localStorage.removeItem('jobpilot.profile'); } catch { /* ignore */ } });
  for (const screen of screens.filter((s) => ids.includes(s))) {
    await page.goto(`${base}#${screen}`, { waitUntil: 'load' });
    await page.waitForTimeout(220);
    await page.screenshot({ path: `${SHOTS}/${dir}-${screen}.png`, timeout: 15000 });
  }
  // phone width check
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
  });
  await page.goto(`file://${path.resolve(`design/variants/${dir}/index.html`)}#dashboard`, { waitUntil: 'load' });
  await page.waitForTimeout(220);
  await page.screenshot({ path: `${SHOTS}/${dir}-mobile.png`, timeout: 15000 });
  console.log(`shot ${dir}`);
}

await cdp.send('Emulation.clearDeviceMetricsOverride');
await page.goto(`file://${path.resolve('design/index.html')}`, { waitUntil: 'load' });
await page.waitForTimeout(300);
await page.screenshot({ path: `${SHOTS}/00-gallery.png`, fullPage: true, timeout: 20000 });
console.log('shot gallery');
await browser.close();

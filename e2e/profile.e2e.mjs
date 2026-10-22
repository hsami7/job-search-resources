// End-to-end user flow: boots its own server on a throwaway database, drives
// Brave like a person would, and checks the profile, resume, conflict,
// validation, keyboard and mobile paths.
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { launchBrave, connect } from '../spike/lib/browser.js';

const root = path.resolve(import.meta.dirname, '..');
const dataDir = mkdtempSync(path.join(os.tmpdir(), 'jobpilot-e2e-'));
const pdfPath = path.join(dataDir, 'cv-e2e.pdf');
writeFileSync(pdfPath, '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

const freePort = () => new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.on('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

const appPort = await freePort();
const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/main.js'], {
  cwd: root,
  env: { ...process.env, PORT: String(appPort), HOST: '127.0.0.1', JOBPILOT_DATA: dataDir },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk; });
server.stderr.on('data', (chunk) => { serverLog += chunk; });
server.on('exit', (code) => { if (code !== 0) console.error(`server exited with ${code}\n${serverLog}`); });

const BASE = `http://127.0.0.1:${appPort}/`;
for (let attempt = 0; attempt < 100; attempt += 1) {
  try {
    const response = await fetch(`${BASE}api/health`);
    if (response.ok) break;
  } catch { /* not up yet */ }
  if (attempt === 99) throw new Error(`server did not start\n${serverLog}`);
  await new Promise((resolve) => setTimeout(resolve, 100));
}

process.on('exit', () => {
  server.kill('SIGTERM');
  try { rmSync(dataDir, { recursive: true, force: true }); } catch { /* already gone */ }
});
const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  — ${extra}` : ''}`);
};
let failures = 0;

const { port } = await launchBrave();
const { browser, context } = await connect(port);
try {
  const page = await context.newPage();
  const consoleErrors = [];
  const badResponses = [];
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/status of 409|status of 422/.test(text)) return; // expected conflict/validation
    consoleErrors.push(`console: ${text}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) badResponses.push(`${r.request().method()} ${new URL(r.url()).pathname} → ${r.status()}`);
  });

  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

  const api = async (path) => (await fetch(BASE + path)).json();
  const fieldValue = (id) => page.inputValue(id);
  const stateText = () => page.locator('#save-state').innerText();
  const chipTexts = () => page.locator('#roles .chip').allInnerTexts();

  // ---------- first run ----------
  await page.goto(BASE, { waitUntil: 'networkidle' });
  check('first run shows an empty profile', (await fieldValue('#f-name')) === '' && (await page.isDisabled('#save')));
  check('empty resume state is honest', (await page.locator('#resume-current').innerText()).includes('No resume stored yet'));
  check('empty facts show placeholders', (await page.locator('#facts').innerText()).includes('—'));
  check('health pills loaded', (await page.locator('#db-pill').innerText()).startsWith('db ok') && (await page.locator('#host-pill').innerText()) === 'server1');

  // ---------- typing like a user ----------
  await page.click('#f-name');
  await page.type('#f-name', 'Yassine El Mansouri', { delay: 12 });
  check('typing marks the form dirty', (await stateText()) === 'unsaved changes');
  check('save becomes available', !(await page.isDisabled('#save')));

  await page.fill('#f-headline', 'Service advisor · 2 years');
  await page.fill('#f-email', 'yassine@example.com');
  await page.fill('#f-phone', '+212 6 12 34 56 78');
  await page.fill('#f-city', 'Casablanca');
  await page.fill('#f-country', 'Morocco');
  await page.fill('#f-links', 'linkedin.com/in/yassine-m\ngithub.com/yassine-m');

  for (const role of ['Conseiller de service', 'Business développeur', 'Chef de projet']) {
    await page.click('#role-input');
    await page.type('#role-input', role, { delay: 8 });
    await page.press('#role-input', 'Enter');
  }
  check('three roles added', (await chipTexts()).length === 3, JSON.stringify(await chipTexts()));
  await page.locator('#roles .chip button').last().click();
  check('role removed via its ×', (await chipTexts()).length === 2 && !(await page.locator('#roles').innerText()).includes('Chef de projet'));
  check('duplicate role is ignored', await (async () => {
    await page.type('#role-input', 'business développeur');
    await page.press('#role-input', 'Enter');
    return (await chipTexts()).length === 2;
  })());

  await page.selectOption('#f-contract', 'CDI');
  await page.selectOption('#f-seniority', 'Junior, 1–3 years');
  await page.selectOption('#f-remote', 'Hybrid');
  await page.fill('#f-languages', 'French, English, Arabic');

  // ---------- save ----------
  const saveResponse = page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().endsWith('/api/profile'));
  await page.click('#save');
  const saved = await saveResponse;
  check('save returns 200', saved.status() === 200);
  await page.waitForTimeout(400);
  check('save bar confirms version', /saved · v1 · \d\d:\d\d:\d\d/.test(await stateText()), await stateText());
  check('chain is verified and shown', (await page.locator('#chain').innerText()) === 'chain ok · 1');
  check('event log records the save', (await page.locator('#events tr').count()) === 1);

  let server = await api('api/profile');
  check('server has the saved profile', server.version === 1 && server.profile.name === 'Yassine El Mansouri', JSON.stringify({ v: server.version, name: server.profile.name }));
  check('server has the roles', JSON.stringify(server.profile.titles) === JSON.stringify(['Conseiller de service', 'Business développeur']));
  check('links keep their newline', server.profile.links.includes('\n'));

  // ---------- reload = persistence ----------
  await page.reload({ waitUntil: 'networkidle' });
  check('values survive reload', (await fieldValue('#f-name')) === 'Yassine El Mansouri' && (await fieldValue('#f-city')) === 'Casablanca');
  check('roles survive reload', (await chipTexts()).length === 2);
  check('save is disabled when nothing changed', await page.isDisabled('#save'));
  check('resume slot is still empty', (await page.locator('#resume-current').innerText()).includes('No resume stored yet'));

  // ---------- export ----------
  const downloadPromise = page.waitForEvent('download');
  await page.click('#export');
  const download = await downloadPromise;
  const exported = JSON.parse(readFileSync(await download.path(), 'utf8'));
  check('export downloads the profile JSON', exported.name === 'Yassine El Mansouri' && exported.titles.length === 2 && download.suggestedFilename() === 'jobpilot-profile.json');

  // ---------- resume ----------
  await page.setInputFiles('#resume-file', pdfPath);
  await page.waitForFunction(() => document.querySelector('#resume-current')?.textContent?.includes('cv-e2e.pdf'), null, { timeout: 8000 });
  check('resume shows filename, size and hash', /cv-e2e\.pdf/.test(await page.locator('#resume-current').innerText()) && /sha256 [a-f0-9]{12}…/.test(await page.locator('#resume-current').innerText()));
  check('resume history has one row marked in use', (await page.locator('#resume-history').innerText()).includes('in use'));
  const resumeLink = await page.locator('#resume-history a').first().getAttribute('href');
  const resumeResponse = await fetch(BASE.replace(/\/$/, '') + resumeLink);
  const resumeBytes = Buffer.from(await resumeResponse.arrayBuffer());
  check('stored resume downloads byte-for-byte', resumeResponse.status === 200 && resumeBytes.equals(readFileSync(pdfPath)));
  server = await api('api/profile');
  check('resume bumped the version', server.version === 2 && server.profile.resume.bytes === readFileSync(pdfPath).length, `v${server.version}`);
  check('save bar shows v2', /saved · v2/.test(await stateText()), await stateText());

  // ---------- validation ----------
  await page.fill('#f-name', '');
  await page.click('#save');
  await page.waitForFunction(() => document.querySelector('[data-err="name"]')?.textContent?.length > 0, null, { timeout: 5000 });
  check('empty name shows an inline error', /required/.test(await page.locator('[data-err="name"]').innerText()));
  check('empty name marks the input invalid', (await page.getAttribute('#f-name', 'aria-invalid')) === 'true');
  check('nothing was saved on validation failure', (await api('api/profile')).version === 2);
  await page.fill('#f-name', 'Yassine El Mansouri');
  check('inline error clears when the value is fixed', (await page.locator('[data-err="name"]').innerText()) === '');
  check('save is disabled again because nothing changed', await page.isDisabled('#save'));
  check('validation retry is still v2', (await api('api/profile')).version === 2);

  // ---------- conflict: load theirs ----------
  const page2 = await context.newPage();
  await page2.goto(BASE, { waitUntil: 'networkidle' });
  await page2.fill('#f-headline', 'Headline from tab 2');
  await page2.click('#save');
  await page2.waitForTimeout(400);
  check('second tab saved v3', /saved · v3/.test(await page2.locator('#save-state').innerText()), await page2.locator('#save-state').innerText());

  await page.bringToFront();
  await page.fill('#f-headline', 'Headline from tab 1');
  await page.click('#save');
  await page.waitForTimeout(400);
  check('stale save shows the conflict banner', /Version 3 is newer/.test(await page.locator('#banner').innerText()));
  check('local edit was not overwritten', (await fieldValue('#f-headline')) === 'Headline from tab 1');
  check('server still has tab 2 value', (await api('api/profile')).profile.headline === 'Headline from tab 2');
  page.once('dialog', (d) => d.accept());
  await page.click('text=Load v3');
  await page.waitForTimeout(500);
  check('Load v3 brings the server value in', (await fieldValue('#f-headline')) === 'Headline from tab 2');
  check('conflict banner is gone after load', await page.locator('#banner').isHidden());

  // ---------- conflict: overwrite with mine ----------
  await page.fill('#f-headline', 'Tab 1 wins');
  await page.click('#save');
  await page.waitForTimeout(400);
  check('tab 1 now saved v4', /saved · v4/.test(await stateText()), await stateText());

  await page2.bringToFront();
  await page2.fill('#f-headline', 'Tab 2 tries');
  await page2.click('#save');
  await page2.waitForTimeout(400);
  check('tab 2 sees the conflict', /Version 4 is newer/.test(await page2.locator('#banner').innerText()));
  page2.once('dialog', (d) => d.accept());
  await page2.click('text=Overwrite with mine');
  await page2.waitForTimeout(700);
  check('overwrite saved tab 2 edits as v5', /saved · v5/.test(await page2.locator('#save-state').innerText()), await page2.locator('#save-state').innerText());
  server = await api('api/profile');
  check('server holds the overwriting value', server.version === 5 && server.profile.headline === 'Tab 2 tries');
  check('event log chain survives conflicts', (await api('api/profile/events?limit=50')).chain.ok === true);

  // ---------- beforeunload guard ----------
  await page.bringToFront();
  await page.fill('#f-city', 'Rabat');
  let sawBeforeUnload = false;
  page.once('dialog', async (d) => { sawBeforeUnload = d.type() === 'beforeunload'; await d.dismiss(); });
  await page.reload({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(400);
  check('leaving with unsaved edits asks first', sawBeforeUnload);
  check('dismissing the prompt keeps the page', (await fieldValue('#f-city')) === 'Rabat');
  page.once('dialog', (d) => d.accept());
  await page.click('#revert');
  await page.waitForTimeout(400);
  check('Revert reloads the saved profile', (await fieldValue('#f-city')) === 'Casablanca');

  // ---------- keyboard ----------
  await page.focus('#f-name');
  await page.keyboard.press('Tab');
  check('Tab moves to the next field', (await page.evaluate(() => document.activeElement?.id)) === 'f-headline');
  await page.focus('#resume-file');
  check('resume picker is keyboard reachable', (await page.evaluate(() => document.activeElement?.id)) === 'resume-file');

  // ---------- mobile ----------
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const sizes = await page.evaluate(() => [innerWidth, document.documentElement.scrollWidth]);
  check('no horizontal scroll at 390 px', sizes[0] === 390 && sizes[1] === 390, sizes.join('/'));
  check('rail is replaced by the compact bar on mobile', await page.locator('.rail').isHidden());
  check('hash columns are hidden on mobile', await page.locator('#events th.col-hash').isHidden());
  const nameBox = await page.locator('#f-name').boundingBox();
  const headlineBox = await page.locator('#f-headline').boundingBox();
  check('form is one column on mobile', Math.abs(nameBox.x - headlineBox.x) < 2 && headlineBox.y > nameBox.y);
  await page.bringToFront();
  await page.screenshot({ path: path.join(dataDir, 'final-mobile.png'), fullPage: true });

  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(dataDir, 'final-desktop.png'), fullPage: true });

  check('no unexpected console errors', consoleErrors.length === 0, consoleErrors.join(' | '));
  const expected = ['PUT /api/profile → 409', 'PUT /api/profile → 409', 'PUT /api/profile → 422'];
  const unexpected = badResponses.filter((r) => !expected.includes(r));
  check('no unexpected 4xx/5xx responses', unexpected.length === 0, unexpected.join(' | '));

} finally {
  await browser.close();
  server.kill('SIGTERM');
  rmSync(dataDir, { recursive: true, force: true });
}
failures = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failures}/${results.length} user-flow checks passed`);
process.exit(failures ? 1 : 0);

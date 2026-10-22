// Proves the take-control handoff end to end: a viewer page in its own tab can drive
// the owned browser (coordinate mapping, typing, submit) with no VNC and no display.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { connect } from './lib/browser.js';

const PORT = 8099;
const TOKEN = 'spike-token';
const BASE = `http://127.0.0.1:${PORT}`;

const srv = spawn('node', ['spike/take-control/server.js'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, TC_PORT: String(PORT), TC_TOKEN: TOKEN },
});
srv.stdout.on('data', (d) => process.stdout.write(`  [server] ${d}`));
srv.stderr.on('data', (d) => process.stdout.write(`  [server:err] ${d}`));

const post = (ev) =>
  fetch(`${BASE}/input?token=${TOKEN}`, { method: 'POST', body: JSON.stringify(ev) });
const state = () => fetch(`${BASE}/state?token=${TOKEN}`).then((r) => r.json());

try {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`${BASE}/state?token=${TOKEN}`)).ok) break;
    } catch {}
    await sleep(250);
  }
  // 1. frame stream delivers pixels
  const frames = await fetch(`${BASE}/frames?token=${TOKEN}`);
  const reader = frames.body.getReader();
  const { value } = await reader.read();
  reader.cancel();
  const chunk = new TextDecoder().decode(value ?? new Uint8Array());
  console.log(`[test] frame stream: ${chunk.includes('"png"') ? 'OK' : 'EMPTY'} (${chunk.length} bytes)`);

  // 2. coordinate mapping: drive the panel from a real viewer tab, not raw CDP
  const { browser, context } = await connect();
  const viewer = await context.newPage();
  await viewer.goto(`${BASE}/?token=${TOKEN}`, { waitUntil: 'load' });
  await viewer.waitForFunction(() => document.getElementById('v').naturalWidth > 0, null, { timeout: 15000 });

  await post({ type: 'goto', url: `${BASE}/fixtures/clickmap.html?token=${TOKEN}` });
  await viewer.waitForFunction(() => document.getElementById('v').naturalWidth > 0, null, { timeout: 10000 });
  await sleep(1200);

  const img = await viewer.locator('#v').boundingBox();
  const target = { x: img.x + img.width * 0.5, y: img.y + img.height * 0.5 };
  await viewer.mouse.click(target.x, target.y);
  await sleep(600);
  const after = await state();
  const m = /click (\d+),(\d+) at (\d+)x(\d+)/.exec(after.text);
  const okX = m && Math.abs(Number(m[1]) - after.inner[0] / 2) < 12;
  const okY = m && Math.abs(Number(m[2]) - after.inner[1] / 2) < 12;
  console.log(`[test] click mapping: ${okX && okY ? 'OK' : 'FAIL'} — ${after.text}`);

  // 3. login flow: type into focused field, tab, type, submit
  await post({ type: 'goto', url: `${BASE}/fixtures/form.html?token=${TOKEN}` });
  await sleep(600);
  await post({ type: 'type', text: 'yassine' });
  await post({ type: 'key', key: 'Tab' });
  await post({ type: 'type', text: 'secret-pw' });
  await post({ type: 'key', key: 'Enter' });
  await sleep(700);

  const s = await state();
  const submitted = /submitted: yassine/.test(s.text);
  console.log(`[test] typed+submitted remotely: ${submitted ? 'OK' : 'FAIL'} — ${JSON.stringify(s.text.slice(0, 40))}`);

  if (!(okX && okY && submitted)) process.exitCode = 1;
  await viewer.close();
  await browser.close();
} finally {
  srv.kill();
}
process.exit(process.exitCode ?? 0);

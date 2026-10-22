// Spike-only browser harness: launches the real Brave binary under Xvfb and
// attaches over CDP. Never attaches to the user's everyday profile.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

export const BRAVE =
  process.env.BRAVE_PATH || '/opt/brave.com/brave/brave-browser';
export const PROFILE_DIR = path.resolve('spike/profile/brave');
export const OUT_DIR = path.resolve('spike/out');
const DEFAULT_PORT = Number(process.env.CDP_PORT || 9222);

export function ensureDisplay(display = process.env.SPIKE_DISPLAY || ':99') {
  if (process.env.DISPLAY) return process.env.DISPLAY;
  const sock = `/tmp/.X11-unix/X${display.replace(':', '')}`;
  if (!existsSync(sock)) {
    const xvfb = spawn(
      'Xvfb',
      [display, '-screen', '0', '1440x900x24', '-nolisten', 'tcp'],
      { detached: true, stdio: 'ignore' },
    );
    xvfb.unref();
  }
  process.env.DISPLAY = display;
  return display;
}

async function cdpVersion(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function launchBrave({ port = DEFAULT_PORT, timeoutMs = 25000 } = {}) {
  ensureDisplay();
  mkdirSync(OUT_DIR, { recursive: true });
  const existing = await cdpVersion(port);
  if (existing) return { port, version: existing, proc: null, reused: true };

  mkdirSync(PROFILE_DIR, { recursive: true });
  const log = openSync(path.join(OUT_DIR, 'brave.log'), 'a');
  const proc = spawn(
    BRAVE,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${PROFILE_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-sync',
      '--disable-translate',
      '--window-size=1440,900',
      'about:blank',
    ],
    { detached: true, stdio: ['ignore', log, log] },
  );
  proc.unref();

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const version = await cdpVersion(port);
    if (version) return { port, version, proc, reused: false };
    await sleep(250);
  }
  throw new Error(
    `Brave did not expose CDP on :${port} within ${timeoutMs}ms — see spike/out/brave.log`,
  );
}

export async function connect(port = DEFAULT_PORT) {
  const { chromium } = await import('playwright-core');
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context = browser.contexts()[0];
  return { browser, context };
}

export async function stopBrave(port = DEFAULT_PORT) {
  try {
    await fetch(`http://127.0.0.1:${port}/json/close`, { method: 'PUT' });
  } catch {}
}

export async function shot(page, name) {
  mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

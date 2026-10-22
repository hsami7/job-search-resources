// Spike-only browser harness: launches the real Brave binary under Xvfb and
// attaches over CDP. Never attaches to the user's everyday profile.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const BRAVE_CANDIDATES = [
  process.env.BRAVE_PATH,
  '/opt/brave-bin/brave',
  '/usr/bin/brave',
  '/opt/brave.com/brave/brave-browser',
].filter(Boolean);
export const BRAVE = BRAVE_CANDIDATES.find((candidate) => existsSync(candidate)) ?? BRAVE_CANDIDATES[0];
export const PROFILE_DIR = path.resolve(process.env.SPIKE_PROFILE_DIR || 'spike/profile/brave');
export const OUT_DIR = path.resolve('spike/out');
const DEFAULT_PORT = Number(process.env.CDP_PORT || 9333);

export function ensureDisplay(display = process.env.SPIKE_DISPLAY || ':99') {
  if (process.env.DISPLAY) return process.env.DISPLAY;
  // A Wayland desktop with XWayland already has an X socket; never spawn Xvfb there.
  if (process.env.WAYLAND_DISPLAY && existsSync('/tmp/.X11-unix/X0')) {
    process.env.DISPLAY = ':0';
    return ':0';
  }
  const sock = `/tmp/.X11-unix/X${display.replace(':', '')}`;
  if (!existsSync(sock)) {
    if (!existsSync('/usr/bin/Xvfb') && !existsSync('/bin/Xvfb')) {
      throw new Error('no DISPLAY/WAYLAND_DISPLAY and Xvfb is not installed; run inside a graphical session or install Xvfb');
    }
    const xvfb = spawn(
      'Xvfb',
      [display, '-screen', '0', '1440x900x24', '-nolisten', 'tcp'],
      { detached: true, stdio: 'ignore' },
    );
    xvfb.on('error', () => {});
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

export async function launchBrave({ port = DEFAULT_PORT, timeoutMs = 25000, headless = false, userDataDir = PROFILE_DIR } = {}) {
  ensureDisplay();
  mkdirSync(OUT_DIR, { recursive: true });
  const existing = await cdpVersion(port);
  if (existing) {
    throw new Error(
      `CDP port ${port} is already in use; refusing to attach to a foreign browser. ` +
        'Close it or set CDP_PORT to a free port.',
    );
  }

  mkdirSync(userDataDir, { recursive: true });
  const log = openSync(path.join(OUT_DIR, 'brave.log'), 'a');
  const proc = spawn(
    BRAVE,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-sync',
      '--disable-translate',
      '--disable-extensions',
      '--disable-component-extensions-with-background-pages',
      '--disable-save-password-bubble',
      '--password-store=basic',
      '--window-size=1440,900',
      ...(headless ? ['--headless=new'] : []),
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

export async function shot(page, name) {
  mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}.png`);
  // Heavy/lazy pages can stall a PNG capture; JPEG with a timeout is the fallback.
  try {
    await page.screenshot({ path: file, timeout: 15000 });
  } catch {
    const jpeg = file.replace(/\.png$/, '.jpg');
    await page.screenshot({ path: jpeg, type: 'jpeg', quality: 70, timeout: 15000 });
    return jpeg;
  }
  return file;
}

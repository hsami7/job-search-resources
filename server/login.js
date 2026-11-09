// Human-in-the-loop login handoff. The app opens a real browser at the login
// page, notifies the operator, and waits for them to finish logging in. No
// credentials are ever collected by the server; the browser session is real.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const CHROMIUM = process.env.JOBPILOT_CHROMIUM ?? '/usr/bin/chromium';

let session = null; // { context, page, status, loginUrl, successUrl, startedAt, error }

export function loginStatus() {
  if (!session) return { status: 'idle' };
  return {
    status: session.status,
    loginUrl: session.loginUrl,
    successUrl: session.successUrl,
    startedAt: session.startedAt,
    error: session.error ?? null,
  };
}

function notify(title, body) {
  try {
    const child = spawn('notify-send', ['-u', 'normal', '-a', 'jobPilot', title, body], { stdio: 'ignore', detached: true });
    // A missing notify-send surfaces asynchronously as an 'error' event; without
    // a listener it becomes an uncaught exception and takes the server down.
    child.on('error', () => { /* notification is best-effort */ });
    child.unref();
  } catch { /* spawn failed synchronously; nothing to do */ }
}

export async function startLogin({ loginUrl, successUrl, profileDir }) {
  if (session && session.status === 'waiting') {
    return { status: 'already_waiting', ...loginStatus() };
  }
  if (!loginUrl) throw new Error('loginUrl is required');
  if (!successUrl) throw new Error('successUrl is required');

  mkdirSync(profileDir, { recursive: true });
  session = { status: 'launching', loginUrl, successUrl, startedAt: new Date().toISOString(), error: null };

  try {
    const context = await chromium.launchPersistentContext(profileDir, {
      executablePath: CHROMIUM,
      headless: false,
      viewport: { width: 1280, height: 900 },
      args: ['--no-first-run', '--no-default-browser-check'],
    });
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    session.context = context;
    session.page = page;
    session.status = 'waiting';
    notify('jobPilot — login needed', `Log in at ${loginUrl}. jobPilot resumes when you reach ${successUrl}.`);

    // Poll until the operator reaches the success URL or the timeout expires.
    const deadline = Date.now() + 15 * 60 * 1000;
    while (Date.now() < deadline) {
      if (session.status === 'cancelled') return loginStatus();
      const current = page.url();
      if (current.includes(successUrl)) {
        session.status = 'success';
        notify('jobPilot — login complete', 'Continuing where we left off.');
        await context.close().catch(() => {});
        session.context = null;
        return loginStatus();
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    session.status = 'failed';
    session.error = 'login timed out after 15 minutes';
    await context.close().catch(() => {});
    session.context = null;
    return loginStatus();
  } catch (error) {
    if (session) {
      session.status = 'failed';
      session.error = String(error?.message ?? error);
    }
    return loginStatus();
  }
}

export async function cancelLogin() {
  if (!session) return loginStatus();
  session.status = 'cancelled';
  if (session.context) await session.context.close().catch(() => {});
  session.context = null;
  return loginStatus();
}

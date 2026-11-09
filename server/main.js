// Entry point: open the database, rebuild the profile projection if needed,
// serve web/ + /api on loopback.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { countEvents } from './events.js';
import { rebuildProfile } from './profile.js';
import { createApp } from './app.js';
import { buildDigest, digestLine } from './digest.js';
import { listJobs } from './jobs.js';
import { listSubmissions } from './submissions.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const PORT = Number(process.env.PORT ?? 4319);
const HOST = process.env.HOST ?? '127.0.0.1';
const DATA_DIR = path.resolve(process.env.JOBPILOT_DATA ?? path.join(root, 'data'));
const WEB_DIR = path.join(root, 'web');
const ARTIFACTS_DIR = path.join(DATA_DIR, 'artifacts');

const log = (entry) => console.log(JSON.stringify({ t: new Date().toISOString(), ...entry }));

const db = openDb(path.join(DATA_DIR, 'jobpilot.db'));

// The log is the source of truth: if the projection is missing (restored
// backup, interrupted migration) rebuild it instead of showing a blank profile.
const projected = Number(db.prepare('SELECT COUNT(*) AS n FROM profile').get().n);
const logged = countEvents(db);
if (projected === 0 && logged > 0) {
  const rebuilt = rebuildProfile(db);
  log({ level: 'info', msg: 'profile projection rebuilt from event log', events: logged, version: rebuilt.version });
}

const server = createServer(
  createApp({ db, artifactsDir: ARTIFACTS_DIR, webDir: WEB_DIR, hostName: os.hostname() }),
);

server.on('error', (error) => {
  log({ level: 'error', msg: 'server failed', error: String(error?.message ?? error) });
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const loopback = HOST === '127.0.0.1' || HOST === '::1' || HOST === 'localhost';
  log({ level: 'info', msg: 'listening', url: `http://${HOST}:${PORT}`, data: DATA_DIR, loopback });
  if (!loopback) {
    log({ level: 'warn', msg: 'bound to a non-loopback address; there is no authentication yet — put it behind a private network' });
  }
  notifyDigest();
  setInterval(notifyDigest, 6 * 60 * 60 * 1000).unref();
});

// One desktop notification a day, at boot and then every six hours. The date
// stamp lives next to the database so a restart does not re-notify; the stamp
// is written before the call so a failing notifier cannot spam retries.
function notifyDigest() {
  try {
    const stampFile = path.join(DATA_DIR, 'digest.json');
    const today = new Date().toISOString().slice(0, 10);
    let last = null;
    try { last = JSON.parse(readFileSync(stampFile, 'utf8')).date ?? null; } catch { /* first run */ }
    if (last === today) return;

    const digest = buildDigest({
      jobs: listJobs(db, { limit: 1000, offset: 0, state: 'all' }),
      submissions: listSubmissions(db),
    });
    const line = digestLine(digest);
    writeFileSync(stampFile, JSON.stringify({ date: today, line }));
    if (!line) return;

    const child = spawn('notify-send', ['-u', 'normal', '-a', 'jobPilot', 'jobPilot — today', line], {
      stdio: 'ignore',
      detached: true,
    });
    child.on('error', (error) => log({ level: 'warn', msg: 'digest notification failed', error: String(error?.message ?? error) }));
    child.unref();
  } catch (error) {
    log({ level: 'warn', msg: 'digest failed', error: String(error?.message ?? error) });
  }
}

let closing = false;
function shutdown(signal) {
  if (closing) return;
  closing = true;
  log({ level: 'info', msg: 'shutting down', signal });
  server.close(() => {
    try {
      // Fold the WAL back into the main database so a copy/backup of the file
      // is complete after shutdown.
      db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    } catch { /* checkpoint is best-effort */ }
    try { db.close(); } catch { /* already closed */ }
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

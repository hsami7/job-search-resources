import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../server/db.js';
import { appendEvent, countEvents, listEvents, verifyChain } from '../server/events.js';
import { getProfile, rebuildProfile, saveProfile } from '../server/profile.js';
import { MAX_RESUME_BYTES, storeResume } from '../server/resume.js';
import { createApp } from '../server/app.js';

function tempDir(t) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'jobpilot-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function profile(overrides = {}) {
  return {
    name: 'Yassine M.',
    headline: 'Service advisor',
    email: 'yassine@example.com',
    phone: '+212 6 00 00 00 00',
    city: 'Casablanca',
    country: 'Morocco',
    links: 'linkedin.com/in/yassine',
    titles: ['Advisor', 'Business developer'],
    contract: 'CDI',
    seniority: 'Junior, 1–3 years',
    salary: '',
    remote: 'Hybrid',
    languages: 'French, English, Arabic',
    ...overrides,
  };
}

function pdf(body = 'resume') {
  return Buffer.from(`%PDF-1.4\n${body}\n%%EOF`);
}

test('the event log is append-only and hash-chained', (t) => {
  const db = openDb(':memory:');
  t.after(() => db.close());

  appendEvent(db, { type: 'profile.saved', payload: { changed: ['name'], before: { name: '' }, after: { name: 'A' } } });
  appendEvent(db, { type: 'profile.saved', payload: { changed: ['name'], before: { name: 'A' }, after: { name: 'B' } } });

  const chain = verifyChain(db);
  assert.equal(chain.ok, true);
  assert.equal(chain.count, 2);
  assert.equal(countEvents(db), 2);

  const [newest] = listEvents(db, { limit: 1 });
  assert.equal(newest.payload.after.name, 'B');
  assert.match(newest.hash, /^[a-f0-9]{64}$/);

  db.prepare('UPDATE event_log SET payload = ? WHERE seq = 1').run(
    JSON.stringify({ changed: ['name'], before: { name: '' }, after: { name: 'tampered' } }),
  );
  const broken = verifyChain(db);
  assert.equal(broken.ok, false);
  assert.equal(broken.brokenAt, 1);
});

test('saving writes one event and projects the profile', (t) => {
  const db = openDb(':memory:');
  t.after(() => db.close());

  assert.equal(getProfile(db).version, 0);
  assert.deepEqual(getProfile(db).profile.titles, []);

  const saved = saveProfile(db, { profile: profile(), version: 0, host: 'test' });
  assert.equal(saved.status, 'ok');
  assert.equal(saved.version, 1);
  assert.deepEqual(saved.changed.sort(), ['city', 'contract', 'country', 'email', 'headline', 'languages', 'links', 'name', 'phone', 'remote', 'seniority', 'titles']);

  const current = getProfile(db);
  assert.equal(current.version, 1);
  assert.equal(current.profile.name, 'Yassine M.');
  assert.deepEqual(current.profile.titles, ['Advisor', 'Business developer']);

  const events = listEvents(db);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'profile.saved');
  assert.equal(events[0].host, 'test');
  assert.deepEqual(events[0].payload.changed.includes('name'), true);
  assert.equal(events[0].payload.after.name, 'Yassine M.');
});

test('a stale version is a 409-shaped conflict and appends nothing', (t) => {
  const db = openDb(':memory:');
  t.after(() => db.close());

  const first = saveProfile(db, { profile: profile(), version: 0, host: 'a' });
  assert.equal(first.status, 'ok');

  const stale = saveProfile(db, { profile: profile({ name: 'Someone else' }), version: 0, host: 'b' });
  assert.equal(stale.status, 'conflict');
  assert.equal(stale.current.version, 1);
  assert.equal(stale.current.profile.name, 'Yassine M.');

  assert.equal(countEvents(db), 1);
  assert.equal(getProfile(db).profile.name, 'Yassine M.');

  const winning = saveProfile(db, { profile: profile({ name: 'Yassine M.' }), version: 1, host: 'b' });
  assert.equal(winning.status, 'unchanged');
  assert.equal(countEvents(db), 1, 'no event when nothing changed');
});

test('validation rejects bad input with field errors', (t) => {
  const db = openDb(':memory:');
  t.after(() => db.close());

  const missingName = saveProfile(db, { profile: profile({ name: ' ' }), version: 0 });
  assert.equal(missingName.status, 'invalid');
  assert.match(missingName.errors.name, /required/);

  const badEmail = saveProfile(db, { profile: profile({ email: 'not-an-email' }), version: 0 });
  assert.equal(badEmail.status, 'invalid');
  assert.match(badEmail.errors.email, /valid email/);

  const manyTitles = saveProfile(db, {
    profile: profile({ titles: Array.from({ length: 21 }, (_, i) => `Role ${i}`) }),
    version: 0,
  });
  assert.equal(manyTitles.status, 'invalid');
  assert.match(manyTitles.errors.titles, /max 20/);

  const badVersion = saveProfile(db, { profile: profile(), version: 'x' });
  assert.equal(badVersion.status, 'invalid');
  assert.match(badVersion.errors.version, /version/);

  assert.equal(countEvents(db), 0);
  assert.equal(getProfile(db).version, 0);
});

test('duplicate titles are de-duplicated and trimmed', (t) => {
  const db = openDb(':memory:');
  t.after(() => db.close());

  const saved = saveProfile(db, {
    profile: profile({ titles: ['  Advisor ', 'advisor', 'Engineer', ''] }),
    version: 0,
  });
  assert.equal(saved.status, 'ok');
  assert.deepEqual(saved.profile.titles, ['Advisor', 'Engineer']);
});

test('the profile survives a reopen of the database file', (t) => {
  const dir = tempDir(t);
  const file = path.join(dir, 'jobpilot.db');

  const first = openDb(file);
  saveProfile(first, { profile: profile(), version: 0, host: 'test' });
  first.close();

  const second = openDb(file);
  t.after(() => second.close());
  const current = getProfile(second);
  assert.equal(current.version, 1);
  assert.equal(current.profile.email, 'yassine@example.com');
  assert.equal(verifyChain(second).ok, true);
});

test('the projection can be rebuilt from the event log alone', (t) => {
  const db = openDb(':memory:');
  t.after(() => db.close());

  saveProfile(db, { profile: profile({ name: 'First' }), version: 0, host: 'test' });
  saveProfile(db, { profile: profile({ name: 'Second', city: 'Rabat' }), version: 1, host: 'test' });
  storeResume(db, { buffer: pdf('rebuild'), filename: 'cv.pdf', artifactsDir: tempDir(t), host: 'test' });

  const before = getProfile(db);
  db.prepare('DELETE FROM profile').run();
  assert.equal(getProfile(db).version, 0);

  const rebuilt = rebuildProfile(db);
  assert.equal(rebuilt.version, before.version);
  assert.equal(rebuilt.profile.name, 'Second');
  assert.equal(rebuilt.profile.city, 'Rabat');
  assert.equal(rebuilt.profile.resume.sha256, before.profile.resume.sha256);
  assert.deepEqual(getProfile(db), before);
});

test('resume files are content-addressed, type-checked and traversal-safe', (t) => {
  const db = openDb(':memory:');
  const artifacts = path.join(tempDir(t), 'artifacts');
  t.after(() => db.close());

  const stored = storeResume(db, {
    buffer: pdf('hello'),
    filename: '../../etc/passwd.pdf',
    artifactsDir: artifacts,
    host: 'test',
  });
  assert.equal(stored.status, 'ok');
  assert.equal(stored.resume.filename, 'passwd.pdf');
  assert.match(stored.resume.sha256, /^[a-f0-9]{64}$/);
  assert.equal(stored.resume.bytes, pdf('hello').length);
  assert.equal(stored.resume.contentType, 'application/pdf');

  const filePath = path.join(artifacts, `${stored.resume.sha256}.pdf`);
  assert.equal(existsSync(filePath), true);
  assert.deepEqual(readFileSync(filePath), pdf('hello'));
  assert.equal(path.dirname(path.resolve(filePath)), path.resolve(artifacts));
  assert.equal(getProfile(db).profile.resume.sha256, stored.resume.sha256);
  assert.equal(getProfile(db).version, 1);

  const again = storeResume(db, { buffer: pdf('hello'), filename: 'cv.pdf', artifactsDir: artifacts, host: 'test' });
  assert.equal(again.status, 'unchanged');
  assert.equal(getProfile(db).version, 1, 're-uploading the same bytes does not bump the version');

  const badType = storeResume(db, { buffer: Buffer.from('MZ'), filename: 'virus.exe', artifactsDir: artifacts });
  assert.equal(badType.status, 'invalid');

  const fakePdf = storeResume(db, { buffer: Buffer.from('not a pdf'), filename: 'cv.pdf', artifactsDir: artifacts });
  assert.equal(fakePdf.status, 'invalid');
  assert.match(fakePdf.error, /PDF/);

  const huge = storeResume(db, {
    buffer: Buffer.alloc(MAX_RESUME_BYTES + 1),
    filename: 'cv.pdf',
    artifactsDir: artifacts,
  });
  assert.equal(huge.status, 'invalid');
  assert.match(huge.error, /8 MB/);

  assert.equal(getProfile(db).version, 1);
});

async function withServer(t) {
  const dir = tempDir(t);
  const db = openDb(path.join(dir, 'jobpilot.db'));
  const server = createServer(
    createApp({ db, artifactsDir: path.join(dir, 'artifacts'), webDir: path.resolve('web'), hostName: 'test-host', log: () => {} }),
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    db.close();
  });
  return { base, db };
}

const jsonHeaders = { 'content-type': 'application/json' };

test('HTTP: health, profile load, save, conflict and validation', async (t) => {
  const { base, db } = await withServer(t);

  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  const healthBody = await health.json();
  assert.equal(healthBody.ok, true);
  assert.equal(healthBody.host, 'test-host');
  assert.equal(healthBody.events.chain, 'ok');
  assert.equal(healthBody.profileVersion, 0);

  const empty = await (await fetch(`${base}/api/profile`)).json();
  assert.equal(empty.version, 0);
  assert.equal(empty.profile.name, '');

  const save = await fetch(`${base}/api/profile`, {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({ profile: profile(), version: 0 }),
  });
  assert.equal(save.status, 200);
  const saved = await save.json();
  assert.equal(saved.version, 1);
  assert.equal(saved.profile.name, 'Yassine M.');
  assert.equal(saved.changed.includes('name'), true);

  const stale = await fetch(`${base}/api/profile`, {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({ profile: profile({ name: 'Other' }), version: 0 }),
  });
  assert.equal(stale.status, 409);
  const conflict = await stale.json();
  assert.equal(conflict.error, 'version_conflict');
  assert.equal(conflict.current.version, 1);
  assert.equal(conflict.current.profile.name, 'Yassine M.');

  const invalid = await fetch(`${base}/api/profile`, {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({ profile: profile({ name: '' }), version: 1 }),
  });
  assert.equal(invalid.status, 422);
  const validation = await invalid.json();
  assert.equal(validation.error, 'validation');
  assert.match(validation.fields.name, /required/);

  const wrongType = await fetch(`${base}/api/profile`, {
    method: 'PUT',
    headers: { 'content-type': 'text/plain' },
    body: JSON.stringify({ profile: profile(), version: 1 }),
  });
  assert.equal(wrongType.status, 415);

  const events = await (await fetch(`${base}/api/profile/events?limit=10`)).json();
  assert.equal(events.events.length, 1);
  assert.equal(events.chain.ok, true);
  assert.equal(events.events[0].type, 'profile.saved');

  assert.equal(getProfile(db).version, 1);
});

test('HTTP: cross-origin writes are refused', async (t) => {
  const { base, db } = await withServer(t);
  const response = await fetch(`${base}/api/profile`, {
    method: 'PUT',
    headers: { ...jsonHeaders, origin: 'https://evil.example' },
    body: JSON.stringify({ profile: profile(), version: 0 }),
  });
  assert.equal(response.status, 403);
  assert.equal(countEvents(db), 0);
});

test('HTTP: resume upload, download, size and type rejection', async (t) => {
  const { base } = await withServer(t);

  const upload = await fetch(`${base}/api/profile/resume`, {
    method: 'POST',
    headers: { 'x-filename': encodeURIComponent('Yassine CV.pdf') },
    body: pdf('uploaded'),
  });
  assert.equal(upload.status, 200);
  const stored = await upload.json();
  assert.equal(stored.resume.filename, 'Yassine CV.pdf');
  assert.equal(stored.version, 1);

  const download = await fetch(`${base}/api/profile/resume/${stored.resume.sha256}`);
  assert.equal(download.status, 200);
  assert.equal(download.headers.get('content-type'), 'application/pdf');
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), pdf('uploaded'));

  const unknown = await fetch(`${base}/api/profile/resume/${'0'.repeat(64)}`);
  assert.equal(unknown.status, 404);

  const bad = await fetch(`${base}/api/profile/resume`, {
    method: 'POST',
    headers: { 'x-filename': encodeURIComponent('cv.exe') },
    body: Buffer.from('MZ'),
  });
  assert.equal(bad.status, 422);
  const badBody = await bad.json();
  assert.equal(badBody.error, 'resume_rejected');

  const missingName = await fetch(`${base}/api/profile/resume`, { method: 'POST', body: pdf() });
  assert.equal(missingName.status, 400);
});

test('HTTP: static files stay inside web/ and HTML carries a CSP', async (t) => {
  const { base } = await withServer(t);

  const index = await fetch(`${base}/`);
  assert.equal(index.status, 200);
  assert.match(index.headers.get('content-security-policy'), /default-src 'self'/);
  assert.match(await index.text(), /jobPilot/);

  const traversal = await fetch(`${base}/..%2fserver%2fdb.js`);
  assert.equal(traversal.status, 404);

  const missing = await fetch(`${base}/nope.txt`);
  assert.equal(missing.status, 404);
});

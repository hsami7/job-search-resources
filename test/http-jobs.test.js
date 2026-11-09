import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../server/db.js';
import { createApp } from '../server/app.js';

const jsonHeaders = { 'content-type': 'application/json' };

async function withServer(t) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'jobpilot-http-jobs-'));
  const db = openDb(path.join(dir, 'jobpilot.db'));
  const server = createServer(
    createApp({
      db,
      artifactsDir: path.join(dir, 'artifacts'),
      webDir: path.resolve('web'),
      hostName: 'test-host',
      log: () => {},
    }),
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { base, db };
}

async function addJob(base, overrides = {}) {
  const res = await fetch(`${base}/api/jobs`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      job: {
        title: 'Cyber Security Intern',
        company: 'Northwind',
        location: 'Manchester, United Kingdom',
        url: `https://example.dev/${Math.random().toString(36).slice(2)}`,
        contract: 'Internship',
        seniority: 'Intern',
        skills: ['SIEM'],
        description: 'Security operations work.',
        ...overrides,
      },
    }),
  });
  return res;
}

test('HTTP: create a job and list it with pagination metadata', async (t) => {
  const { base } = await withServer(t);

  const created = await addJob(base);
  assert.equal(created.status, 200);
  const { job } = await created.json();
  assert.equal(job.title, 'Cyber Security Intern');
  assert.equal(job.state, 'new');

  const list = await (await fetch(`${base}/api/jobs`)).json();
  assert.equal(list.total, 1);
  assert.equal(list.limit > 0, true);
  assert.equal(list.offset, 0);
  assert.equal(list.jobs.length, 1);
});

test('HTTP: a job without a title is refused', async (t) => {
  const { base } = await withServer(t);
  const res = await fetch(`${base}/api/jobs`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ job: { company: 'No title' } }),
  });
  assert.equal(res.status, 422);
  assert.equal((await res.json()).error, 'title_required');
});

test('HTTP: state=all, minScore and sort are applied server-side', async (t) => {
  const { base } = await withServer(t);

  await fetch(`${base}/api/profile`, {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({
      version: 0,
      profile: {
        name: 'Yassine M.',
        city: 'Casablanca',
        country: 'Morocco',
        titles: ['Cybersecurity Intern'],
        skills: ['Cybersecurity', 'SIEM'],
        contract: 'Internship',
        seniority: 'Intern',
      },
    }),
  });

  await addJob(base);
  await addJob(base, {
    title: 'Senior Product Analyst',
    company: 'SumUp',
    location: 'Berlin, Germany',
    contract: 'Unbefristeter arbeitsvertrag',
    seniority: 'Senior',
    skills: [],
    description: 'Analytics.',
  });

  const all = await (await fetch(`${base}/api/jobs?state=all`)).json();
  assert.equal(all.total, 2);

  const strong = await (await fetch(`${base}/api/jobs?minScore=50`)).json();
  assert.equal(strong.total, 1);
  assert.equal(strong.jobs[0].job.title, 'Cyber Security Intern');

  const newest = await (await fetch(`${base}/api/jobs?sort=newest`)).json();
  assert.equal(newest.sort, 'newest');
  assert.equal(newest.jobs.length, 2);
});

test('HTTP: state transitions are validated', async (t) => {
  const { base } = await withServer(t);
  const { job } = await (await addJob(base)).json();

  const saved = await fetch(`${base}/api/jobs/${job.id}/state`, {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({ state: 'saved' }),
  });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).job.state, 'saved');

  const bad = await fetch(`${base}/api/jobs/${job.id}/state`, {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({ state: 'banana' }),
  });
  assert.equal(bad.status, 422);
  const body = await bad.json();
  assert.equal(body.error, 'invalid_state');
  assert.ok(body.allowed.includes('saved'));
});

test('HTTP: deleting a job with a submission is 409, cascade is 204', async (t) => {
  const { base, db } = await withServer(t);
  const { job } = await (await addJob(base)).json();

  const letter = await fetch(`${base}/api/letters`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ jobId: job.id }),
  });
  assert.equal(letter.status, 200);

  const blocked = await fetch(`${base}/api/jobs/${job.id}`, { method: 'DELETE' });
  assert.equal(blocked.status, 409);
  const blockedBody = await blocked.json();
  assert.equal(blockedBody.error, 'job_has_submissions');
  assert.equal(blockedBody.submissionIds.length, 1);

  // Regression: submission_events has a foreign key to submissions, so the
  // cascade used to fail with a constraint error and return 500.
  const cascaded = await fetch(`${base}/api/jobs/${job.id}?cascade=1`, { method: 'DELETE' });
  assert.equal(cascaded.status, 204);

  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM jobs').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM submissions').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM submission_events').get().n, 0);
});

test('HTTP: a submission status is validated with the allowed list', async (t) => {
  const { base } = await withServer(t);
  const { job } = await (await addJob(base)).json();
  await fetch(`${base}/api/letters`, {
    method: 'POST', headers: jsonHeaders, body: JSON.stringify({ jobId: job.id }),
  });
  const { submissions } = await (await fetch(`${base}/api/submissions`)).json();
  const id = submissions[0].id;

  const bad = await fetch(`${base}/api/submissions/${id}`, {
    method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ status: 'banana' }),
  });
  assert.equal(bad.status, 400);
  const body = await bad.json();
  assert.equal(body.error, 'invalid_status');
  assert.ok(body.allowed.includes('sent'));

  const ok = await fetch(`${base}/api/submissions/${id}`, {
    method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ status: 'sent' }),
  });
  assert.equal(ok.status, 200);
  const sent = (await ok.json()).submission;
  assert.equal(sent.status, 'sent');
  assert.ok(sent.followUpAt);

  const events = await (await fetch(`${base}/api/submissions/${id}/events`)).json();
  assert.equal(events.events.length, 2);
});

test('HTTP: the digest reports the three counts', async (t) => {
  const { base } = await withServer(t);
  await addJob(base, { description: 'Applications close 12 November 2026.' });

  const digest = await (await fetch(`${base}/api/digest`)).json();
  assert.equal(typeof digest.newSince, 'number');
  assert.ok(Array.isArray(digest.closingSoon));
  assert.ok(Array.isArray(digest.followUpsDue));
  assert.deepEqual(Object.keys(digest.counts).sort(), ['closingSoon', 'followUpsDue', 'newSince']);
});

test('HTTP: a non-loopback Host header is refused', async (t) => {
  const { base } = await withServer(t);
  const { port } = new URL(base);
  const http = await import('node:http');
  const status = await new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: '/api/health', headers: { host: 'evil.com' } },
      (res) => { res.resume(); resolve(res.statusCode); },
    );
    req.on('error', reject);
    req.end();
  });
  assert.equal(status, 403);
});

test('HTTP: login start only accepts http(s) URLs', async (t) => {
  const { base } = await withServer(t);

  const fileScheme = await fetch(`${base}/api/login/start`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ loginUrl: 'file:///etc/passwd', successUrl: 'https://x.dev/ok' }),
  });
  assert.equal(fileScheme.status, 422);
  assert.equal((await fileScheme.json()).error, 'invalid_loginUrl');

  const missing = await fetch(`${base}/api/login/start`, {
    method: 'POST', headers: jsonHeaders, body: JSON.stringify({}),
  });
  assert.equal(missing.status, 422);
});

test('HTTP: a board token with path characters is refused', async (t) => {
  const { base } = await withServer(t);
  const res = await fetch(`${base}/api/jobs`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ action: 'ingest', source: 'lever', board: '../../etc' }),
  });
  assert.equal(res.status, 422);
  assert.equal((await res.json()).error, 'invalid_board');
});

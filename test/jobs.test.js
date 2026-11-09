import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../server/db.js';
import {
  normalizeJob, extractDeadline, upsertJob, listJobs, setJobState, deleteJob,
  getJob, scoreJobsForProfile,
} from '../server/jobs.js';

function tempDir(t) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'jobpilot-jobs-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function memDb(t) {
  const db = openDb(':memory:');
  t.after(() => db.close());
  return db;
}

function job(overrides = {}) {
  return {
    title: 'Cyber Security Intern',
    company: 'Northwind',
    location: 'Manchester, United Kingdom',
    url: 'https://example.dev/jobs/1',
    contract: 'Internship',
    seniority: 'Intern',
    skills: ['SIEM'],
    description: 'Security operations work.',
    ...overrides,
  };
}

const profile = {
  name: 'Yassine M.',
  city: 'Casablanca',
  country: 'Morocco',
  titles: ['Cybersecurity Intern'],
  skills: ['Cybersecurity', 'SIEM'],
  contract: 'Internship',
  seniority: 'Intern',
  remote: 'Hybrid',
};

test('normalizeJob accepts http, https and manual URLs and rejects other schemes', () => {
  assert.equal(normalizeJob(job({ url: 'https://a.dev/1' })).url, 'https://a.dev/1');
  assert.equal(normalizeJob(job({ url: 'http://a.dev/1' })).url, 'http://a.dev/1');
  assert.equal(normalizeJob(job({ url: 'manual://abc' })).url, 'manual://abc');
  assert.equal(normalizeJob(job({ url: '' })).url, '');
  assert.throws(() => normalizeJob(job({ url: 'javascript:alert(1)' })), /invalid_url_scheme/);
  assert.throws(() => normalizeJob(job({ url: 'file:///etc/passwd' })), /invalid_url_scheme/);
});

test('normalizeJob defaults to the new state and keeps an explicit one', () => {
  assert.equal(normalizeJob(job()).state, 'new');
  assert.equal(normalizeJob(job({ state: 'saved' })).state, 'saved');
  assert.equal(normalizeJob(job({ state: 'nonsense' })).state, 'new');
});

test('normalizeJob parses skills from an array and from a separated string', () => {
  assert.deepEqual(normalizeJob(job({ skills: ['SIEM', 'Linux'] })).skills, ['SIEM', 'Linux']);
  assert.deepEqual(normalizeJob(job({ skills: 'SIEM, Linux; Python' })).skills, ['SIEM', 'Linux', 'Python']);
  assert.deepEqual(normalizeJob(job({ skills: undefined })).skills, []);
});

test('normalizeJob generates an id and preserves an explicit one', () => {
  const generated = normalizeJob(job());
  assert.match(generated.id, /^[0-9a-f-]{36}$/);
  assert.equal(normalizeJob(job({ id: 'fixed-id' })).id, 'fixed-id');
});

test('extractDeadline reads the formats a posting actually uses', () => {
  assert.equal(extractDeadline('Applications close 30 November 2026.'), '2026-11-30');
  assert.equal(extractDeadline('Apply by December 30, 2026 for consideration.'), '2026-12-30');
  assert.equal(extractDeadline('Deadline: 2026-12-15'), '2026-12-15');
  assert.equal(extractDeadline('Closing date 5 Jan 2027.'), '2027-01-05');
  assert.equal(extractDeadline('Anmeldeschluss: 30.11.2026'), '2026-11-30');
  assert.equal(extractDeadline('Applications close 30. November 2026.'), '2026-11-30');
});

test('extractDeadline refuses to guess', () => {
  assert.equal(extractDeadline('No date here at all.'), null);
  // A date with no closing phrase is a start date, a policy date, anything.
  assert.equal(extractDeadline('We were founded on 3 March 2019 and are hiring.'), null);
  assert.equal(extractDeadline('Applications close 45 December 2026.'), null);
  assert.equal(extractDeadline(''), null);
  assert.equal(extractDeadline(null), null);
});

test('upsertJob stores a job and re-upserting the same URL keeps one row', (t) => {
  const db = memDb(t);
  const first = upsertJob(db, job({ title: 'First title' }));
  const second = upsertJob(db, job({ title: 'Second title' }));
  assert.equal(first.id, second.id);
  assert.equal(listJobs(db, { state: 'all' }).length, 1);
  assert.equal(getJob(db, first.id).title, 'Second title');
});

test('listJobs filters by state, text, country and contract', (t) => {
  const db = memDb(t);
  const uk = upsertJob(db, job({ url: 'https://a.dev/1', state: 'new' }));
  const ma = upsertJob(db, job({
    url: 'https://a.dev/2', state: 'saved', location: 'Rabat, Morocco', contract: 'Stage',
    title: 'Stage analyste SOC', company: 'INOVADEX',
  }));

  assert.deepEqual(listJobs(db, { state: 'new' }).map((j) => j.id), [uk.id]);
  assert.deepEqual(listJobs(db, { state: 'saved' }).map((j) => j.id), [ma.id]);
  assert.equal(listJobs(db, { state: 'all' }).length, 2);
  assert.deepEqual(listJobs(db, { q: 'inovadex' }).map((j) => j.id), [ma.id]);
  assert.deepEqual(listJobs(db, { country: 'morocco' }).map((j) => j.id), [ma.id]);
  assert.deepEqual(listJobs(db, { contract: 'stage' }).map((j) => j.id), [ma.id]);
  assert.equal(listJobs(db, { q: 'zzzz' }).length, 0);
});

test('listJobs paginates and clamps the limit', (t) => {
  const db = memDb(t);
  for (let i = 0; i < 5; i += 1) {
    upsertJob(db, job({ url: `https://a.dev/${i}`, title: `Job ${i}` }));
  }
  const page = listJobs(db, { limit: 2, offset: 0 });
  assert.equal(page.length, 2);
  assert.equal(listJobs(db, { limit: 2, offset: 4 }).length, 1);
  assert.equal(listJobs(db, { limit: 99999 }).length, 5);
  assert.equal(listJobs(db, { limit: -5 }).length, 1);
});

test('scoreJobsForProfile filters by minScore and sorts', (t) => {
  const db = memDb(t);
  upsertJob(db, job({ url: 'https://a.dev/strong' }));
  upsertJob(db, job({
    url: 'https://a.dev/weak', title: 'Senior Product Analyst', location: 'Berlin, Germany',
    contract: 'Unbefristeter arbeitsvertrag', seniority: 'Senior', skills: [], description: 'Analytics.',
  }));

  const all = scoreJobsForProfile(db, profile, {});
  assert.equal(all.length, 2);
  assert.equal(all[0].job.title, 'Cyber Security Intern');
  assert.ok(all[0].score >= all[1].score);

  const strong = scoreJobsForProfile(db, profile, { minScore: 50 });
  assert.equal(strong.length, 1);
  assert.equal(strong[0].job.title, 'Cyber Security Intern');

  const byCompany = scoreJobsForProfile(db, profile, { sort: 'company' });
  assert.equal(byCompany[0].job.company, 'Northwind');
});

test('setJobState rejects unknown states and deleteJob removes the row', (t) => {
  const db = memDb(t);
  const stored = upsertJob(db, job());
  assert.equal(setJobState(db, stored.id, 'saved').state, 'saved');
  assert.equal(setJobState(db, stored.id, 'applied').state, 'applied');
  assert.throws(() => setJobState(db, stored.id, 'banana'), /invalid_state/);
  assert.equal(setJobState(db, 'missing', 'saved'), null);

  deleteJob(db, stored.id);
  assert.equal(getJob(db, stored.id), null);
});

test('a deadline in the description is extracted on insert', (t) => {
  const db = memDb(t);
  const stored = upsertJob(db, job({
    url: 'https://a.dev/deadline',
    description: 'Join the team. Applications close 12 November 2026.',
  }));
  assert.equal(stored.deadline, '2026-11-12');
});

test('an explicit deadline beats one found in the description', (t) => {
  const db = memDb(t);
  const stored = upsertJob(db, job({
    url: 'https://a.dev/explicit',
    deadline: '2026-12-01',
    description: 'Applications close 12 November 2026.',
  }));
  assert.equal(stored.deadline, '2026-12-01');
});

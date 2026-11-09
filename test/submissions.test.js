import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { upsertJob } from '../server/jobs.js';
import {
  createSubmission, getSubmission, listSubmissions, updateSubmission,
  listSubmissionEvents, submissionIdsForJob,
} from '../server/submissions.js';

function memDb(t) {
  const db = openDb(':memory:');
  t.after(() => db.close());
  return db;
}

function seedJob(db, url = 'https://example.dev/jobs/1') {
  return upsertJob(db, {
    title: 'Cyber Security Intern',
    company: 'Northwind',
    location: 'Manchester, United Kingdom',
    url,
  });
}

test('a submission is created as drafted with an event', (t) => {
  const db = memDb(t);
  const job = seedJob(db);
  const sub = createSubmission(db, { jobId: job.id, letter: 'Dear Hiring Manager,' });

  assert.equal(sub.status, 'drafted');
  assert.equal(sub.jobId, job.id);
  assert.equal(sub.sentAt, null);
  assert.equal(sub.followUpAt, null);

  const events = listSubmissionEvents(db, sub.id);
  assert.equal(events.length, 1);
  assert.equal(events[0].toStatus, 'drafted');
});

test('drafting twice for one job upserts instead of duplicating', (t) => {
  const db = memDb(t);
  const job = seedJob(db);
  const first = createSubmission(db, { jobId: job.id, letter: 'v1' });
  const second = createSubmission(db, { jobId: job.id, letter: 'v2' });

  assert.equal(first.id, second.id);
  assert.equal(listSubmissions(db).length, 1);
  assert.equal(getSubmission(db, first.id).letter, 'v2');
  assert.equal(submissionIdsForJob(db, job.id).length, 1);
});

test('re-drafting keeps the notes the user typed', (t) => {
  const db = memDb(t);
  const job = seedJob(db);
  const sub = createSubmission(db, { jobId: job.id, letter: 'v1' });
  updateSubmission(db, sub.id, { notes: 'referral via Amine' });

  createSubmission(db, { jobId: job.id, letter: 'v2' });
  assert.equal(getSubmission(db, sub.id).notes, 'referral via Amine');
});

test('re-drafting keeps the original send date', (t) => {
  const db = memDb(t);
  const job = seedJob(db);
  const sub = createSubmission(db, { jobId: job.id, letter: 'v1' });
  const sent = updateSubmission(db, sub.id, { status: 'sent' }).submission;
  assert.ok(sent.sentAt);

  createSubmission(db, { jobId: job.id, letter: 'v2' });
  const after = getSubmission(db, sub.id);
  assert.equal(after.sentAt, sent.sentAt);
  assert.equal(after.status, 'sent');
});

test('moving to sent records the date, a follow-up and an event', (t) => {
  const db = memDb(t);
  const job = seedJob(db);
  const sub = createSubmission(db, { jobId: job.id, letter: 'x' });

  const result = updateSubmission(db, sub.id, { status: 'sent' });
  assert.equal(result.submission.status, 'sent');
  assert.ok(result.submission.sentAt);
  assert.ok(result.submission.followUpAt);
  assert.equal(result.submission.ageDays, 0);

  const events = listSubmissionEvents(db, sub.id);
  assert.equal(events.length, 2);
  assert.equal(events[1].fromStatus, 'drafted');
  assert.equal(events[1].toStatus, 'sent');
});

test('an invalid status changes nothing and reports the error', (t) => {
  const db = memDb(t);
  const job = seedJob(db);
  const sub = createSubmission(db, { jobId: job.id, letter: 'x' });

  const result = updateSubmission(db, sub.id, { status: 'banana' });
  assert.equal(result.error, 'invalid_status');
  assert.equal(getSubmission(db, sub.id).status, 'drafted');
  assert.equal(listSubmissionEvents(db, sub.id).length, 1);
});

test('updating notes alone appends no status event', (t) => {
  const db = memDb(t);
  const job = seedJob(db);
  const sub = createSubmission(db, { jobId: job.id, letter: 'x' });
  updateSubmission(db, sub.id, { notes: 'called the recruiter' });
  assert.equal(listSubmissionEvents(db, sub.id).length, 1);
  assert.equal(getSubmission(db, sub.id).notes, 'called the recruiter');
});

test('updating a missing submission reports not_found', (t) => {
  const db = memDb(t);
  assert.equal(updateSubmission(db, 'nope', { status: 'sent' }).error, 'not_found');
});

test('listSubmissions filters by status', (t) => {
  const db = memDb(t);
  const a = createSubmission(db, { jobId: seedJob(db, 'https://a.dev/1').id, letter: 'x' });
  createSubmission(db, { jobId: seedJob(db, 'https://a.dev/2').id, letter: 'y' });
  updateSubmission(db, a.id, { status: 'sent' });

  assert.equal(listSubmissions(db).length, 2);
  assert.equal(listSubmissions(db, { status: 'sent' }).length, 1);
  assert.equal(listSubmissions(db, { status: 'drafted' }).length, 1);
});

test('ageDays is null until the application is sent', (t) => {
  const db = memDb(t);
  const sub = createSubmission(db, { jobId: seedJob(db).id, letter: 'x' });
  assert.equal(getSubmission(db, sub.id).ageDays, null);
});

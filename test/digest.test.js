import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDigest, digestLine } from '../server/digest.js';

// Fixed clock: Monday 9 November 2026, local midnight.
const NOW = new Date(2026, 10, 9, 9, 0, 0);

function job(overrides = {}) {
  return {
    id: 'j1',
    title: 'Cyber Security Intern',
    company: 'Northwind',
    state: 'new',
    firstSeenAt: '2026-11-08T10:00:00.000Z',
    deadline: null,
    ...overrides,
  };
}

test('newSince counts only new jobs seen in the last week', () => {
  const digest = buildDigest({
    now: NOW,
    jobs: [
      job({ id: 'a', firstSeenAt: '2026-11-08T10:00:00.000Z' }),
      job({ id: 'b', firstSeenAt: '2026-10-01T10:00:00.000Z' }),
      job({ id: 'c', state: 'saved', firstSeenAt: '2026-11-08T10:00:00.000Z' }),
    ],
  });
  assert.equal(digest.newSince, 1);
});

test('closingSoon keeps the next seven days, in order', () => {
  const digest = buildDigest({
    now: NOW,
    jobs: [
      job({ id: 'today', deadline: '2026-11-09' }),
      job({ id: 'six', deadline: '2026-11-15' }),
      job({ id: 'later', deadline: '2026-12-09' }),
      job({ id: 'past', deadline: '2026-11-01' }),
      job({ id: 'none', deadline: null }),
    ],
  });
  assert.deepEqual(digest.closingSoon.map((j) => j.id), ['today', 'six']);
});

test('a date-only deadline lands on the right local day', () => {
  const digest = buildDigest({
    now: new Date(2026, 10, 9, 0, 30, 0),
    jobs: [job({ deadline: '2026-11-12' })],
  });
  assert.equal(digest.counts.closingSoon, 1);
});

test('a dismissed or archived job never counts as closing soon', () => {
  const digest = buildDigest({
    now: NOW,
    jobs: [
      job({ id: 'x', state: 'dismissed', deadline: '2026-11-11' }),
      job({ id: 'y', state: 'archived', deadline: '2026-11-11' }),
    ],
  });
  assert.equal(digest.counts.closingSoon, 0);
});

test('followUpsDue counts only sent or replied applications past their date', () => {
  const digest = buildDigest({
    now: NOW,
    submissions: [
      { id: '1', status: 'sent', followUpAt: '2026-11-01T09:00:00.000Z', jobTitle: 'A' },
      { id: '2', status: 'replied', followUpAt: '2026-11-08T09:00:00.000Z', jobTitle: 'B' },
      { id: '3', status: 'sent', followUpAt: '2026-12-01T09:00:00.000Z', jobTitle: 'C' },
      { id: '4', status: 'drafted', followUpAt: '2026-11-01T09:00:00.000Z', jobTitle: 'D' },
      { id: '5', status: 'sent', followUpAt: null, jobTitle: 'E' },
    ],
  });
  assert.deepEqual(digest.followUpsDue.map((s) => s.id), ['1', '2']);
});

test('the counts object mirrors the lists', () => {
  const digest = buildDigest({
    now: NOW,
    jobs: [job({ deadline: '2026-11-10' })],
    submissions: [{ id: '1', status: 'sent', followUpAt: '2026-11-01T09:00:00.000Z' }],
  });
  assert.equal(digest.counts.newSince, 1);
  assert.equal(digest.counts.closingSoon, 1);
  assert.equal(digest.counts.followUpsDue, 1);
});

test('an empty database produces zeroes, not errors', () => {
  const digest = buildDigest({ now: NOW });
  assert.deepEqual(digest.counts, { newSince: 0, closingSoon: 0, followUpsDue: 0 });
  assert.equal(digestLine(digest), '');
});

test('digestLine joins only the non-zero counts', () => {
  assert.equal(
    digestLine({ counts: { newSince: 6, closingSoon: 1, followUpsDue: 0 } }),
    '6 new · 1 closing this week',
  );
  assert.equal(
    digestLine({ counts: { newSince: 0, closingSoon: 0, followUpsDue: 2 } }),
    '2 follow-up due',
  );
});

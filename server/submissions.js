import { randomUUID } from 'node:crypto';
import { transaction } from './db.js';

export const SUBMISSION_STATUSES = Object.freeze([
  'drafted', 'sent', 'replied', 'interviewing', 'offer', 'rejected', 'ghosted',
]);

const FOLLOW_UP_DAYS = 7;

const SELECT_SUB = `
  SELECT s.*, j.title AS job_title, j.company AS job_company
  FROM submissions s
  LEFT JOIN jobs j ON j.id = s.job_id
`;

// Re-drafting a job replaces its letter rather than inserting a second row.
// status/sent_at/follow_up_at are preserved once the submission has moved past
// drafted, and the first row for a submission starts its status history.
export function createSubmission(db, { jobId, letter, status = 'drafted', notes = '' } = {}) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const nextStatus = SUBMISSION_STATUSES.includes(status) ? status : 'drafted';
  const sentAt = nextStatus === 'sent' ? now : null;
  const followUpAt = sentAt ? addDays(now, FOLLOW_UP_DAYS) : null;
  const resolvedId = transaction(db, () => {
    const existing = jobId
      ? db.prepare('SELECT id FROM submissions WHERE job_id = ?').get(jobId)
      : null;
    db.prepare(`
      INSERT INTO submissions (id, job_id, status, letter, sent_at, follow_up_at, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (job_id) DO UPDATE SET
        letter = excluded.letter,
        notes = excluded.notes,
        status = CASE WHEN submissions.status = 'drafted' THEN excluded.status ELSE submissions.status END,
        follow_up_at = COALESCE(submissions.follow_up_at, excluded.follow_up_at),
        updated_at = excluded.updated_at
    `).run(id, jobId ?? null, nextStatus, letter ?? '', sentAt, followUpAt, notes, now, now);
    if (existing) return existing.id;
    const row = jobId ? db.prepare('SELECT id FROM submissions WHERE job_id = ?').get(jobId) : null;
    const newId = row?.id ?? id;
    appendSubmissionEvent(db, { submissionId: newId, fromStatus: null, toStatus: nextStatus, at: now, note: 'created' });
    return newId;
  });
  return getSubmission(db, resolvedId);
}

export function getSubmission(db, id) {
  const row = db.prepare(`${SELECT_SUB} WHERE s.id = ?`).get(id);
  return row ? rowToSub(row) : null;
}

export function listSubmissions(db, { status } = {}) {
  if (status) {
    return db.prepare(`${SELECT_SUB} WHERE s.status = ? ORDER BY s.created_at DESC`).all(status).map(rowToSub);
  }
  return db.prepare(`${SELECT_SUB} ORDER BY s.created_at DESC`).all().map(rowToSub);
}

export function submissionIdsForJob(db, jobId) {
  return db.prepare('SELECT id FROM submissions WHERE job_id = ?').all(jobId).map((row) => row.id);
}

export function updateSubmission(db, id, { status, notes } = {}) {
  const existing = getSubmission(db, id);
  if (!existing) return { error: 'not_found' };
  let nextStatus = existing.status;
  if (status !== undefined) {
    if (!SUBMISSION_STATUSES.includes(status)) return { error: 'invalid_status' };
    nextStatus = status;
  }
  const now = new Date().toISOString();
  // sent_at is set once, on the first transition to sent, and never rewritten.
  const sentAt = existing.sentAt ?? (nextStatus === 'sent' ? now : null);
  // The follow-up is due a week after the application went out.
  const followUpAt = existing.followUpAt ?? (nextStatus === 'sent' ? addDays(sentAt, FOLLOW_UP_DAYS) : null);
  const nextNotes = notes === undefined ? existing.notes : String(notes);
  transaction(db, () => {
    db.prepare('UPDATE submissions SET status = ?, sent_at = ?, follow_up_at = ?, notes = ?, updated_at = ? WHERE id = ?')
      .run(nextStatus, sentAt, followUpAt, nextNotes, now, id);
    if (nextStatus !== existing.status) {
      appendSubmissionEvent(db, { submissionId: id, fromStatus: existing.status, toStatus: nextStatus, at: now, note: '' });
    }
  });
  return { submission: getSubmission(db, id) };
}

// Back-compat wrapper for PUT /api/submissions/:id/status.
export function updateSubmissionStatus(db, id, status) {
  return updateSubmission(db, id, { status });
}

export function appendSubmissionEvent(db, { submissionId, fromStatus, toStatus, at, note = '' }) {
  db.prepare(`
    INSERT INTO submission_events (submission_id, from_status, to_status, at, note)
    VALUES (?, ?, ?, ?, ?)
  `).run(submissionId, fromStatus ?? null, toStatus, at, String(note ?? ''));
}

export function listSubmissionEvents(db, id) {
  return db.prepare('SELECT * FROM submission_events WHERE submission_id = ? ORDER BY at ASC, id ASC')
    .all(id)
    .map((row) => ({
      id: row.id,
      fromStatus: row.from_status ?? null,
      toStatus: row.to_status,
      at: row.at,
      note: row.note ?? '',
    }));
}

function rowToSub(row) {
  return {
    id: row.id, jobId: row.job_id,
    jobTitle: row.job_title ?? null, jobCompany: row.job_company ?? null,
    status: row.status, letter: row.letter, sentAt: row.sent_at,
    followUpAt: row.follow_up_at ?? null,
    notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at,
    ageDays: ageDays(row.sent_at),
  };
}

function addDays(iso, days) {
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) return null;
  return new Date(at + days * 86_400_000).toISOString();
}

function ageDays(sentAt) {
  if (!sentAt) return null;
  const t = new Date(sentAt).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

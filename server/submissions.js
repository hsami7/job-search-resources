import { randomUUID } from 'node:crypto';
import { transaction } from './db.js';

export const SUBMISSION_STATUSES = Object.freeze([
  'drafted', 'sent', 'replied', 'interviewing', 'offer', 'rejected', 'ghosted',
]);

const SELECT_SUB = `
  SELECT s.*, j.title AS job_title, j.company AS job_company
  FROM submissions s
  LEFT JOIN jobs j ON j.id = s.job_id
`;

// Re-drafting a job replaces its letter rather than inserting a second row.
// status/sent_at are preserved once the submission has moved past drafted.
export function createSubmission(db, { jobId, letter, status = 'drafted', notes = '' } = {}) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const nextStatus = SUBMISSION_STATUSES.includes(status) ? status : 'drafted';
  const sentAt = nextStatus === 'sent' ? now : null;
  const resolvedId = transaction(db, () => {
    db.prepare(`
      INSERT INTO submissions (id, job_id, status, letter, sent_at, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (job_id) DO UPDATE SET
        letter = excluded.letter,
        notes = excluded.notes,
        status = CASE WHEN submissions.status = 'drafted' THEN excluded.status ELSE submissions.status END,
        updated_at = excluded.updated_at
    `).run(id, jobId ?? null, nextStatus, letter ?? '', sentAt, notes, now, now);
    if (!jobId) return id;
    const row = db.prepare('SELECT id FROM submissions WHERE job_id = ?').get(jobId);
    return row?.id ?? id;
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
  const nextNotes = notes === undefined ? existing.notes : String(notes);
  db.prepare('UPDATE submissions SET status = ?, sent_at = ?, notes = ?, updated_at = ? WHERE id = ?')
    .run(nextStatus, sentAt, nextNotes, now, id);
  return { submission: getSubmission(db, id) };
}

// Back-compat wrapper for PUT /api/submissions/:id/status.
export function updateSubmissionStatus(db, id, status) {
  return updateSubmission(db, id, { status });
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

function ageDays(sentAt) {
  if (!sentAt) return null;
  const t = new Date(sentAt).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

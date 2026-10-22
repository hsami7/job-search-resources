// Hash-chained append-only log. Every mutation is an event; the profile table
// is only ever a projection of these rows.
import { createHash, randomUUID } from 'node:crypto';

function hashOf(prevHash, type, createdAt, payloadJson) {
  return createHash('sha256')
    .update(`${prevHash}|${type}|${createdAt}|${payloadJson}`)
    .digest('hex');
}

export function appendEvent(db, { type, payload, host = 'localhost', at = new Date() }) {
  const createdAt = at.toISOString();
  const payloadJson = JSON.stringify(payload);
  const prev = db.prepare('SELECT hash FROM event_log ORDER BY seq DESC LIMIT 1').get();
  const prevHash = prev?.hash ?? '';
  const hash = hashOf(prevHash, type, createdAt, payloadJson);
  const id = randomUUID();
  const info = db
    .prepare(
      `INSERT INTO event_log (id, host, type, payload, created_at, prev_hash, hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, host, type, payloadJson, createdAt, prevHash, hash);
  return {
    id,
    seq: Number(info.lastInsertRowid),
    host,
    type,
    payload,
    created_at: createdAt,
    prev_hash: prevHash,
    hash,
  };
}

export function listEvents(db, { limit = 20, type } = {}) {
  const capped = Math.min(Math.max(Number(limit) || 20, 1), 200);
  const rows = type
    ? db.prepare('SELECT * FROM event_log WHERE type = ? ORDER BY seq DESC LIMIT ?').all(type, capped)
    : db.prepare('SELECT * FROM event_log ORDER BY seq DESC LIMIT ?').all(capped);
  return rows.map((row) => ({ ...row, payload: JSON.parse(row.payload) }));
}

export function countEvents(db) {
  return Number(db.prepare('SELECT COUNT(*) AS n FROM event_log').get().n);
}

// Recompute the chain from scratch. Used by /api/health and the tests.
export function verifyChain(db) {
  let prevHash = '';
  let count = 0;
  const rows = db.prepare('SELECT seq, type, payload, created_at, prev_hash, hash FROM event_log ORDER BY seq').all();
  for (const row of rows) {
    const expected = hashOf(prevHash, row.type, row.created_at, row.payload);
    if (row.prev_hash !== prevHash || row.hash !== expected) {
      return { ok: false, count, brokenAt: row.seq };
    }
    prevHash = row.hash;
    count += 1;
  }
  return { ok: true, count };
}

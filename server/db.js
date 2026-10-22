// SQLite bootstrap. One file, WAL, append-only event log + profile projection.
// Migrations are applied in order and recorded in PRAGMA user_version.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const MIGRATIONS = [
  {
    version: 1,
    sql: `
      CREATE TABLE event_log (
        seq        INTEGER PRIMARY KEY AUTOINCREMENT,
        id         TEXT NOT NULL UNIQUE,
        host       TEXT NOT NULL,
        type       TEXT NOT NULL,
        payload    TEXT NOT NULL,
        created_at TEXT NOT NULL,
        prev_hash  TEXT NOT NULL,
        hash       TEXT NOT NULL
      );
      CREATE INDEX event_log_type_seq ON event_log(type, seq);

      CREATE TABLE profile (
        id         INTEGER PRIMARY KEY CHECK (id = 1),
        data       TEXT NOT NULL,
        version    INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE artifacts (
        sha256       TEXT PRIMARY KEY,
        kind         TEXT NOT NULL,
        filename     TEXT NOT NULL,
        bytes        INTEGER NOT NULL,
        content_type TEXT NOT NULL,
        stored_at    TEXT NOT NULL,
        path         TEXT NOT NULL
      );
    `,
  },
];

export function openDb(file = 'data/jobpilot.db') {
  if (file !== ':memory:') mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db) {
  const row = db.prepare('PRAGMA user_version').get();
  const current = Number(row.user_version ?? 0);
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    db.exec('BEGIN');
    try {
      db.exec(m.sql);
      db.exec(`PRAGMA user_version = ${m.version}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

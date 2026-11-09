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
  {
    version: 2,
    sql: `
      CREATE TABLE jobs (
        id          TEXT PRIMARY KEY,
        url         TEXT NOT NULL UNIQUE,
        title       TEXT NOT NULL,
        company     TEXT NOT NULL DEFAULT '',
        location    TEXT NOT NULL DEFAULT '',
        contract    TEXT NOT NULL DEFAULT '',
        seniority   TEXT NOT NULL DEFAULT '',
        salary      TEXT NOT NULL DEFAULT '',
        remote      TEXT NOT NULL DEFAULT '',
        skills      TEXT NOT NULL DEFAULT '[]',
        description TEXT NOT NULL DEFAULT '',
        source      TEXT NOT NULL DEFAULT 'manual',
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );
      CREATE INDEX jobs_created ON jobs(created_at);

      CREATE TABLE submissions (
        id          TEXT PRIMARY KEY,
        job_id      TEXT,
        status      TEXT NOT NULL DEFAULT 'drafted',
        letter      TEXT NOT NULL DEFAULT '',
        sent_at     TEXT,
        notes       TEXT NOT NULL DEFAULT '',
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id)
      );
      CREATE INDEX submissions_status ON submissions(status);
    `,
  },
  {
    version: 3,
    sql: `
      ALTER TABLE jobs ADD COLUMN state TEXT NOT NULL DEFAULT 'new';
      ALTER TABLE jobs ADD COLUMN state_at TEXT;
      ALTER TABLE jobs ADD COLUMN posted_at TEXT;
      ALTER TABLE jobs ADD COLUMN deadline TEXT;
      ALTER TABLE jobs ADD COLUMN first_seen_at TEXT;
      ALTER TABLE jobs ADD COLUMN contact_email TEXT;
      CREATE INDEX IF NOT EXISTS jobs_state ON jobs(state, created_at DESC);
      ALTER TABLE submissions ADD COLUMN follow_up_at TEXT;
      UPDATE jobs SET state = 'saved', state_at = created_at WHERE source = 'manual';
      UPDATE jobs SET first_seen_at = created_at WHERE first_seen_at IS NULL;

      -- One submission per job. Keep the newest row for each job before the
      -- unique index goes on; older duplicates were the 0.3 bug.
      DELETE FROM submissions
      WHERE job_id IS NOT NULL
        AND rowid NOT IN (
          SELECT rowid FROM (
            SELECT rowid, ROW_NUMBER() OVER (
              PARTITION BY job_id ORDER BY created_at DESC, rowid DESC
            ) AS rn
            FROM submissions
            WHERE job_id IS NOT NULL
          )
          WHERE rn = 1
        );
      CREATE UNIQUE INDEX IF NOT EXISTS submissions_job ON submissions(job_id);
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

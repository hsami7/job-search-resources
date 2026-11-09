// Jobs service: store, list, score, and (documented) ingestion.
import { randomUUID } from 'node:crypto';
import { transaction } from './db.js';
import { scoreJob } from './scoring.js';

export const JOB_STATES = Object.freeze(['new', 'saved', 'dismissed', 'applied', 'archived']);

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;
const URL_SCHEME = /^(https?|manual):\/\//i;

export function normalizeJob(input) {
  const j = input ?? {};
  const skills = Array.isArray(j.skills) ? j.skills : (typeof j.skills === 'string' ? j.skills.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : []);
  const url = String(j.url ?? '').trim();
  // A job URL is rendered as a link in the UI; only safe schemes pass. Empty is
  // allowed and becomes manual://<id> in upsertJob.
  if (url && !URL_SCHEME.test(url)) throw new Error('invalid_url_scheme');
  const source = String(j.source ?? 'manual').trim() || 'manual';
  const requestedState = String(j.state ?? '');
  const state = JOB_STATES.includes(requestedState) ? requestedState : (source === 'manual' ? 'saved' : 'new');
  return {
    id: j.id ?? randomUUID(),
    url,
    title: String(j.title ?? '').trim(),
    company: String(j.company ?? '').trim(),
    location: String(j.location ?? '').trim(),
    contract: String(j.contract ?? '').trim(),
    seniority: String(j.seniority ?? '').trim(),
    salary: String(j.salary ?? '').trim(),
    remote: String(j.remote ?? '').trim(),
    skills,
    description: String(j.description ?? '').trim(),
    source,
    state,
    stateAt: j.stateAt ?? null,
    postedAt: j.postedAt ?? null,
    deadline: j.deadline ?? null,
    firstSeenAt: j.firstSeenAt ?? null,
    contactEmail: j.contactEmail ?? null,
  };
}

export function upsertJob(db, job) {
  const j = normalizeJob(job);
  if (!j.title) throw new Error('title is required');
  if (!j.url) j.url = `manual://${j.id}`;
  const now = new Date().toISOString();
  transaction(db, () => {
    db.prepare(`
      INSERT INTO jobs (
        id, url, title, company, location, contract, seniority, salary, remote,
        skills, description, source, state, state_at, posted_at, deadline,
        first_seen_at, contact_email, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (url) DO UPDATE SET
        title=excluded.title, company=excluded.company, location=excluded.location,
        contract=excluded.contract, seniority=excluded.seniority, salary=excluded.salary,
        remote=excluded.remote, skills=excluded.skills, description=excluded.description,
        source=excluded.source, posted_at=excluded.posted_at, deadline=excluded.deadline,
        contact_email=excluded.contact_email, updated_at=excluded.updated_at
    `).run(
      j.id, j.url, j.title, j.company, j.location, j.contract, j.seniority, j.salary, j.remote,
      JSON.stringify(j.skills), j.description, j.source, j.state, j.stateAt ?? now,
      j.postedAt, j.deadline, j.firstSeenAt ?? now, j.contactEmail, now, now,
    );
  });
  return getJobByUrl(db, j.url);
}

export function getJobByUrl(db, url) {
  const row = db.prepare('SELECT * FROM jobs WHERE url = ?').get(url);
  return row ? rowToJob(row) : null;
}

export function getJob(db, id) {
  const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  return row ? rowToJob(row) : null;
}

export function listJobs(db, { limit = DEFAULT_LIMIT, offset = 0, state, country, contract, q } = {}) {
  const { where, params } = jobFilter({ state, country, contract, q });
  const capped = clampLimit(limit);
  const off = clampOffset(offset);
  return db.prepare(`SELECT * FROM jobs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, capped, off)
    .map(rowToJob);
}

export function setJobState(db, id, state) {
  if (!JOB_STATES.includes(state)) throw new Error('invalid_state');
  const now = new Date().toISOString();
  const result = db.prepare('UPDATE jobs SET state = ?, state_at = ?, updated_at = ? WHERE id = ?')
    .run(state, now, now, id);
  if (result.changes === 0) return null;
  return getJob(db, id);
}

export function deleteJob(db, id) {
  db.prepare('DELETE FROM jobs WHERE id = ?').run(id);
}

// Scores the whole filtered set, then returns it sorted by score. Pagination is
// applied by the caller so `total` can be reported before slicing.
export function scoreJobsForProfile(db, profile, { state, country, contract, q, minScore } = {}) {
  const { where, params } = jobFilter({ state, country, contract, q });
  const rows = db.prepare(`SELECT * FROM jobs ${where} ORDER BY created_at DESC`).all(...params);
  let scored = rows.map((row) => {
    const job = rowToJob(row);
    return { job, ...scoreJob(profile, job) };
  });
  if (minScore !== undefined && minScore !== null && Number.isFinite(Number(minScore))) {
    const floor = Number(minScore);
    scored = scored.filter((entry) => entry.score >= floor);
  }
  return scored.sort((a, b) => b.score - a.score);
}

export function clampLimit(limit) {
  return Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
}

export function clampOffset(offset) {
  return Math.max(Number(offset) || 0, 0);
}

function jobFilter({ state, country, contract, q } = {}) {
  const clauses = [];
  const params = [];
  if (state) {
    clauses.push('state = ?');
    params.push(String(state));
  } else {
    // Dismissed and archived jobs stay out of the default list; an explicit
    // ?state= brings them back.
    clauses.push("state NOT IN ('dismissed', 'archived')");
  }
  if (country) {
    clauses.push('LOWER(location) LIKE ?');
    params.push(`%${String(country).toLowerCase()}%`);
  }
  if (contract) {
    clauses.push('LOWER(contract) LIKE ?');
    params.push(`%${String(contract).toLowerCase()}%`);
  }
  if (q) {
    const like = `%${String(q).toLowerCase()}%`;
    clauses.push('(LOWER(title) LIKE ? OR LOWER(company) LIKE ? OR LOWER(location) LIKE ? OR LOWER(description) LIKE ?)');
    params.push(like, like, like, like);
  }
  return { where: `WHERE ${clauses.join(' AND ')}`, params };
}

function rowToJob(row) {
  let skills = [];
  try { skills = JSON.parse(row.skills); } catch { skills = []; }
  if (!Array.isArray(skills)) skills = [];
  return {
    id: row.id, url: row.url, title: row.title, company: row.company,
    location: row.location, contract: row.contract, seniority: row.seniority,
    salary: row.salary, remote: row.remote, skills, description: row.description,
    source: row.source, state: row.state ?? 'new', stateAt: row.state_at ?? null,
    postedAt: row.posted_at ?? null, deadline: row.deadline ?? null,
    firstSeenAt: row.first_seen_at ?? row.created_at ?? null,
    contactEmail: row.contact_email ?? null,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

// Documented ingestion: Remotive public API (no auth, JSON, remote jobs).
export async function ingestRemotive({ limit = 20, category = '' } = {}) {
  const url = `https://remotive.com/api/remote-jobs${category ? '?category=' + encodeURIComponent(category) : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`remotive ${res.status}`);
  const data = await res.json();
  const items = Array.isArray(data?.jobs) ? data.jobs : [];
  return items.slice(0, limit).map((it) => normalizeJob({
    url: it.url,
    title: it.title,
    company: it.company_name,
    location: it.candidate_required_location || 'Remote',
    contract: it.job_type || '',
    remote: 'Remote',
    salary: it.salary || '',
    skills: (it.tags ?? []),
    description: stripHtml(it.description ?? ''),
    postedAt: it.publication_date ?? null,
    source: 'remotive',
  }));
}

// Documented ingestion: Arbeitnow public API (no auth, JSON).
export async function ingestArbeitnow({ limit = 20 } = {}) {
  const url = 'https://www.arbeitnow.com/api/job-board-api';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`arbeitnow ${res.status}`);
  const data = await res.json();
  const items = Array.isArray(data?.data) ? data.data : [];
  return items.slice(0, limit).map((it) => normalizeJob({
    url: it.url,
    title: it.title,
    company: it.company_name,
    location: it.location,
    contract: it.job_types?.[0] ?? '',
    remote: it.remote ? 'Remote' : '',
    skills: it.tags ?? [],
    description: stripHtml(it.description ?? ''),
    postedAt: unixToIso(it.created_at),
    source: 'arbeitnow',
  }));
}

function unixToIso(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000).toISOString();
}

function stripHtml(s) {
  return String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000);
}

// Profile service: validation, optimistic concurrency, events, projection.
import { appendEvent } from './events.js';
import { transaction } from './db.js';

export const EMPTY_PROFILE = Object.freeze({
  name: '', headline: '', email: '', phone: '', city: '', country: '',
  links: '', titles: [], contract: '', seniority: '', salary: '', remote: '',
  languages: '', resume: null,
});

const TEXT_LIMITS = {
  name: 120, headline: 120, email: 160, phone: 40, city: 80, country: 80,
  links: 500, contract: 40, seniority: 60, salary: 60, remote: 60, languages: 160,
};
const MULTILINE = new Set(['links']);
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function getProfile(db) {
  const row = db.prepare('SELECT data, version, updated_at FROM profile WHERE id = 1').get();
  if (!row) return { profile: structuredClone(EMPTY_PROFILE), version: 0, updatedAt: null };
  return {
    profile: { ...structuredClone(EMPTY_PROFILE), ...JSON.parse(row.data) },
    version: Number(row.version),
    updatedAt: row.updated_at,
  };
}

export function validateProfile(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: { profile: 'expected an object' } };
  }
  const errors = {};
  const value = {};

  for (const [key, max] of Object.entries(TEXT_LIMITS)) {
    const raw = input[key];
    if (raw === undefined || raw === null) { value[key] = ''; continue; }
    if (typeof raw !== 'string') { errors[key] = 'must be text'; continue; }
    const text = raw.trim();
    if (text.length > max) { errors[key] = `max ${max} characters`; continue; }
    const checked = MULTILINE.has(key) ? text.replace(/[\n\r\t]/g, '') : text;
    if (CONTROL.test(checked)) { errors[key] = 'contains control characters'; continue; }
    value[key] = text;
  }

  if (!value.name || value.name.length < 2) {
    errors.name = 'a name of at least 2 characters is required';
  }
  if (value.email && !EMAIL.test(value.email)) {
    errors.email = 'not a valid email address';
  }

  const titles = input.titles ?? [];
  if (!Array.isArray(titles)) {
    errors.titles = 'must be a list of roles';
  } else if (titles.length > 20) {
    errors.titles = 'max 20 target roles';
  } else {
    const seen = new Set();
    const list = [];
    for (const entry of titles) {
      if (typeof entry !== 'string') { errors.titles = 'each role must be text'; break; }
      const title = entry.trim();
      if (!title) continue;
      if (title.length > 60) { errors.titles = 'each role is at most 60 characters'; break; }
      if (CONTROL.test(title)) { errors.titles = 'contains control characters'; break; }
      const key = title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(title);
    }
    if (!errors.titles) value.titles = list;
  }

  return { ok: Object.keys(errors).length === 0, errors, value };
}

function changedFields(before, after) {
  return Object.keys(TEXT_LIMITS).concat('titles').filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
}

function writeRow(db, profile, version, updatedAt) {
  db.prepare(
    `INSERT INTO profile (id, data, version, updated_at) VALUES (1, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET data = excluded.data, version = excluded.version, updated_at = excluded.updated_at`,
  ).run(JSON.stringify(profile), version, updatedAt);
}

export function saveProfile(db, { profile, version, host } = {}) {
  const checked = validateProfile(profile);
  if (!checked.ok) return { status: 'invalid', errors: checked.errors };
  if (!Number.isInteger(version) || version < 0) {
    return { status: 'invalid', errors: { version: 'a non-negative integer version is required' } };
  }

  const current = getProfile(db);
  if (version !== current.version) return { status: 'conflict', current };

  const next = { ...current.profile, ...checked.value, resume: current.profile.resume };
  const changed = changedFields(current.profile, next);
  if (changed.length === 0) {
    return { status: 'unchanged', ...current, changed };
  }

  const at = new Date();
  const before = Object.fromEntries(changed.map((key) => [key, current.profile[key]]));
  const after = Object.fromEntries(changed.map((key) => [key, next[key]]));
  const saved = transaction(db, () => {
    const event = appendEvent(db, { type: 'profile.saved', payload: { changed, before, after }, host, at });
    writeRow(db, next, current.version + 1, at.toISOString());
    return event;
  });

  return {
    status: 'ok',
    profile: next,
    version: current.version + 1,
    updatedAt: at.toISOString(),
    changed,
    event: { seq: saved.seq, hash: saved.hash },
  };
}

// Resume metadata is server-managed: clients never send it in PUT /api/profile.
export function attachResume(db, resume, { host } = {}) {
  const current = getProfile(db);
  if (current.profile.resume?.sha256 === resume.sha256) {
    return { status: 'unchanged', ...current, changed: [] };
  }
  const next = { ...current.profile, resume };
  const at = new Date();
  const saved = transaction(db, () => {
    const event = appendEvent(db, { type: 'profile.resume.stored', payload: { resume }, host, at });
    writeRow(db, next, current.version + 1, at.toISOString());
    return event;
  });
  return {
    status: 'ok',
    profile: next,
    version: current.version + 1,
    updatedAt: at.toISOString(),
    changed: ['resume'],
    event: { seq: saved.seq, hash: saved.hash },
  };
}

// Replay the profile events to rebuild the projection. The event log is the
// source of truth; this is what makes "nothing is overwritten silently" true.
export function rebuildProfile(db) {
  const events = db
    .prepare("SELECT type, payload, created_at FROM event_log WHERE type LIKE 'profile.%' ORDER BY seq")
    .all();
  if (events.length === 0) return getProfile(db);

  const profile = structuredClone(EMPTY_PROFILE);
  let version = 0;
  let updatedAt = null;
  for (const event of events) {
    const payload = JSON.parse(event.payload);
    version += 1;
    updatedAt = event.created_at;
    if (event.type === 'profile.saved') {
      for (const key of payload.changed) profile[key] = payload.after[key];
    } else if (event.type === 'profile.resume.stored') {
      profile.resume = payload.resume;
    }
  }
  writeRow(db, profile, version, updatedAt);
  return { profile, version, updatedAt };
}

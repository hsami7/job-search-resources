// Profile service: validation, optimistic concurrency, events, projection.
import { appendEvent } from './events.js';
import { transaction } from './db.js';

export const EMPTY_PROFILE = Object.freeze({
  name: '', headline: '', email: '', phone: '', city: '', country: '',
  links: '', titles: [], contract: '', seniority: '', salary: '', remote: '',
  languages: '', skills: [], experience: [], education: [], certifications: [],
  workAuthorization: '', availableFrom: '', letterLanguage: 'en', targetCountries: [],
  resume: null,
});

const TEXT_LIMITS = {
  name: 120, headline: 120, email: 160, phone: 40, city: 80, country: 80,
  links: 500, contract: 40, seniority: 60, salary: 60, remote: 60, languages: 160,
  workAuthorization: 160, availableFrom: 40,
};
export const LETTER_LANGUAGES = Object.freeze(['en', 'fr']);
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

  // skills: list of short strings
  const skills = input.skills ?? [];
  if (!Array.isArray(skills)) {
    errors.skills = 'must be a list';
  } else if (skills.length > 40) {
    errors.skills = 'max 40 skills';
  } else {
    const seen = new Set();
    const list = [];
    for (const entry of skills) {
      if (typeof entry !== 'string') { errors.skills = 'each skill must be text'; break; }
      const s = entry.trim();
      if (!s) continue;
      if (s.length > 40) { errors.skills = 'each skill is at most 40 characters'; break; }
      if (CONTROL.test(s)) { errors.skills = 'contains control characters'; break; }
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(s);
    }
    if (!errors.skills) value.skills = list;
  }

  // certifications: list of short strings
  const certs = input.certifications ?? [];
  if (!Array.isArray(certs)) {
    errors.certifications = 'must be a list';
  } else if (certs.length > 20) {
    errors.certifications = 'max 20 certifications';
  } else {
    const list = [];
    for (const entry of certs) {
      if (typeof entry !== 'string') { errors.certifications = 'each certification must be text'; break; }
      const s = entry.trim();
      if (!s) continue;
      if (s.length > 80) { errors.certifications = 'each certification is at most 80 characters'; break; }
      if (CONTROL.test(s)) { errors.certifications = 'contains control characters'; break; }
      list.push(s);
    }
    if (!errors.certifications) value.certifications = list;
  }

  // experience: list of objects
  const exp = input.experience ?? [];
  if (!Array.isArray(exp)) {
    errors.experience = 'must be a list';
  } else if (exp.length > 20) {
    errors.experience = 'max 20 entries';
  } else {
    const list = [];
    for (const e of exp) {
      if (!e || typeof e !== 'object' || Array.isArray(e)) { errors.experience = 'each entry must be an object'; break; }
      const title = String(e.title ?? '').trim();
      const company = String(e.company ?? '').trim();
      const start = String(e.start ?? '').trim();
      const end = String(e.end ?? '').trim();
      const current = Boolean(e.current);
      const description = String(e.description ?? '').trim();
      if (title.length > 80 || company.length > 80 || start.length > 20 || end.length > 20 || description.length > 500) {
        errors.experience = 'field too long'; break;
      }
      if (CONTROL.test(title + company + start + end + description)) { errors.experience = 'contains control characters'; break; }
      list.push({ title, company, start, end: current ? '' : end, current, description });
    }
    if (!errors.experience) value.experience = list;
  }

  // education: list of objects
  const edu = input.education ?? [];
  if (!Array.isArray(edu)) {
    errors.education = 'must be a list';
  } else if (edu.length > 20) {
    errors.education = 'max 20 entries';
  } else {
    const list = [];
    for (const e of edu) {
      if (!e || typeof e !== 'object' || Array.isArray(e)) { errors.education = 'each entry must be an object'; break; }
      const degree = String(e.degree ?? '').trim();
      const school = String(e.school ?? '').trim();
      const year = String(e.year ?? '').trim();
      if (degree.length > 80 || school.length > 80 || year.length > 10) {
        errors.education = 'field too long'; break;
      }
      if (CONTROL.test(degree + school + year)) { errors.education = 'contains control characters'; break; }
      list.push({ degree, school, year });
    }
    if (!errors.education) value.education = list;
  }

  // letterLanguage: en (default) | fr — the Moroccan market writes in French.
  const language = input.letterLanguage ?? 'en';
  if (typeof language !== 'string' || !LETTER_LANGUAGES.includes(language)) {
    errors.letterLanguage = `must be one of ${LETTER_LANGUAGES.join(', ')}`;
  } else {
    value.letterLanguage = language;
  }

  // targetCountries: countries the candidate will work in. Drives the location term.
  const countries = input.targetCountries ?? [];
  if (!Array.isArray(countries)) {
    errors.targetCountries = 'must be a list';
  } else if (countries.length > 10) {
    errors.targetCountries = 'max 10 countries';
  } else {
    const seen = new Set();
    const list = [];
    for (const entry of countries) {
      if (typeof entry !== 'string') { errors.targetCountries = 'each country must be text'; break; }
      const s = entry.trim();
      if (!s) continue;
      if (s.length > 40) { errors.targetCountries = 'each country is at most 40 characters'; break; }
      if (CONTROL.test(s)) { errors.targetCountries = 'contains control characters'; break; }
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(s);
    }
    if (!errors.targetCountries) value.targetCountries = list;
  }

  return { ok: Object.keys(errors).length === 0, errors, value };
}

function changedFields(before, after) {
  return Object.keys(TEXT_LIMITS)
    .concat('titles', 'skills', 'certifications', 'experience', 'education', 'letterLanguage', 'targetCountries')
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
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

export function doctorProfile(profile, updatedAt) {
  const issues = [];
  const p = profile ?? {};
  if (!p.name || p.name.length < 2) issues.push({ level: 'error', field: 'name', message: 'Full name is required.' });
  if (!p.email) issues.push({ level: 'warn', field: 'email', message: 'No email — most applications need one.' });
  if (!p.phone) issues.push({ level: 'warn', field: 'phone', message: 'No phone number.' });
  if (!p.city && !p.country) issues.push({ level: 'warn', field: 'city', message: 'No location set.' });
  if (!p.links) issues.push({ level: 'warn', field: 'links', message: 'No links (LinkedIn/GitHub/portfolio).' });
  if (!Array.isArray(p.titles) || p.titles.length === 0) issues.push({ level: 'error', field: 'titles', message: 'No target roles — scoring cannot run.' });
  if (!Array.isArray(p.skills) || p.skills.length === 0) issues.push({ level: 'warn', field: 'skills', message: 'No skills listed.' });
  if (!Array.isArray(p.experience) || p.experience.length === 0) issues.push({ level: 'warn', field: 'experience', message: 'No experience entries.' });
  if (!Array.isArray(p.education) || p.education.length === 0) issues.push({ level: 'info', field: 'education', message: 'No education entries.' });
  if (!p.workAuthorization) issues.push({ level: 'warn', field: 'workAuthorization', message: 'No work authorization stated — letters cannot address sponsorship.' });
  if (!p.resume) issues.push({ level: 'warn', field: 'resume', message: 'No resume uploaded.' });
  if (updatedAt) {
    const ageDays = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > 90) issues.push({ level: 'warn', field: 'updatedAt', message: `Profile last updated ${Math.floor(ageDays)} days ago — review for freshness.` });
  } else {
    issues.push({ level: 'error', field: 'updatedAt', message: 'Profile has never been saved.' });
  }
  const score = Math.max(0, 100 - issues.reduce((acc, i) => acc + (i.level === 'error' ? 25 : i.level === 'warn' ? 10 : 3), 0));
  return { score, issues, updatedAt };
}

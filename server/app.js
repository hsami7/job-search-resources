// HTTP surface. One user, loopback by default: no sessions, no cookies, no
// ambient credentials. Mutations require a same-origin request.
import os from 'node:os';
import path from 'node:path';
import { countEvents, listEvents, verifyChain } from './events.js';
import { getProfile, saveProfile, doctorProfile } from './profile.js';
import { transaction } from './db.js';
import {
  upsertJob, deleteJob, getJob, scoreJobsForProfile, setJobState,
  listJobs, JOB_STATES, JOB_SORTS, clampLimit, clampOffset,
} from './jobs.js';
import { ingestArbeitnow, ingestRemotive } from './jobs.js';
import { buildLetter } from './letters.js';
import {
  createSubmission, getSubmission, listSubmissions, updateSubmission,
  updateSubmissionStatus, submissionIdsForJob, listSubmissionEvents, SUBMISSION_STATUSES,
} from './submissions.js';
import { buildDigest } from './digest.js';
import { startLogin, loginStatus, cancelLogin } from './login.js';
import { MAX_RESUME_BYTES, resumeFile, storeResume } from './resume.js';
import { httpError, readBody, sendFile, sendJson, serveStatic } from './http.js';

const JSON_LIMIT = 256 * 1024;
const RESUME_LIMIT = MAX_RESUME_BYTES + 1024;

export function createApp({ db, artifactsDir, webDir = 'web', hostName = os.hostname(), log = defaultLog } = {}) {
  return async function handler(req, res) {
    const started = Date.now();
    let url;
    try {
      url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    } catch {
      return sendJson(res, 400, { error: 'bad_request' });
    }

    res.on('finish', () => {
      log({ level: res.statusCode >= 500 ? 'error' : 'info', msg: 'http', method: req.method, path: url.pathname, status: res.statusCode, ms: Date.now() - started });
    });

    try {
      if (url.pathname.startsWith('/api/')) {
        return await api(req, res, url);
      }
      return serveStatic(res, webDir, url.pathname);
    } catch (error) {
      if (error.status) return sendJson(res, error.status, { error: error.message });
      log({ level: 'error', msg: 'unhandled', method: req.method, path: url.pathname, error: String(error?.message ?? error) });
      return sendJson(res, 500, { error: 'internal' });
    }
  };

  async function api(req, res, url) {
    const { pathname } = url;

    if (req.method === 'GET' && pathname === '/api/health') {
      return health(req, res);
    }

    if (pathname === '/api/profile' && req.method === 'GET') {
      return sendJson(res, 200, getProfile(db));
    }

    if (pathname === '/api/profile' && req.method === 'PUT') {
      requireSameOrigin(req);
      if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) {
        return sendJson(res, 415, { error: 'expected_json' });
      }
      const body = await readBody(req, JSON_LIMIT);
      let parsed;
      try {
        parsed = JSON.parse(body.toString('utf8'));
      } catch {
        return sendJson(res, 400, { error: 'invalid_json' });
      }
      const result = saveProfile(db, { profile: parsed?.profile, version: parsed?.version, host: hostName });
      if (result.status === 'invalid') {
        return sendJson(res, 422, { error: 'validation', fields: result.errors });
      }
      if (result.status === 'conflict') {
        return sendJson(res, 409, { error: 'version_conflict', current: result.current });
      }
      return sendJson(res, 200, {
        profile: result.profile,
        version: result.version,
        updatedAt: result.updatedAt,
        changed: result.changed,
      });
    }

    if (pathname === '/api/profile/events' && req.method === 'GET') {
      const requested = url.searchParams.get('type');
      const type = requested && /^profile\.[a-z.]+$/.test(requested) ? requested : undefined;
      const events = listEvents(db, { limit: url.searchParams.get('limit') ?? 20, type });
      return sendJson(res, 200, { events, chain: verifyChain(db) });
    }

    if (pathname === '/api/profile/resume' && req.method === 'POST') {
      requireSameOrigin(req);
      const rawName = req.headers['x-filename'];
      if (!rawName) return sendJson(res, 400, { error: 'missing_filename' });
      let filename;
      try {
        filename = decodeURIComponent(String(rawName));
      } catch {
        return sendJson(res, 400, { error: 'bad_filename' });
      }
      const declared = Number(req.headers['content-length'] ?? 0);
      if (declared > RESUME_LIMIT) {
        return sendJson(res, 413, { error: 'resume_too_large', limit: MAX_RESUME_BYTES });
      }
      const body = await readBody(req, RESUME_LIMIT);
      const result = storeResume(db, { buffer: body, filename, artifactsDir, host: hostName });
      if (result.status === 'invalid') {
        return sendJson(res, 422, { error: 'resume_rejected', message: result.error });
      }
      return sendJson(res, 200, {
        profile: result.profile,
        version: result.version,
        updatedAt: result.updatedAt,
        resume: result.resume,
        changed: result.changed,
      });
    }

    const resumeMatch = pathname.match(/^\/api\/profile\/resume\/([a-f0-9]{64})$/);
    if (resumeMatch && req.method === 'GET') {
      const artifact = resumeFile(db, resumeMatch[1]);
      if (!artifact) return sendJson(res, 404, { error: 'not_found' });
      return sendFile(res, artifact.path, { filename: artifact.filename, contentType: artifact.content_type });
    }

    if (pathname === '/api/doctor' && req.method === 'GET') {
      const { profile, updatedAt } = getProfile(db);
      return sendJson(res, 200, doctorProfile(profile, updatedAt));
    }

    if (pathname === '/api/jobs' && req.method === 'GET') {
      const profile = getProfile(db).profile;
      const requestedSort = url.searchParams.get('sort') ?? '';
      const sort = JOB_SORTS.includes(requestedSort) ? requestedSort : 'score';
      const filters = {
        state: url.searchParams.get('state') || undefined,
        country: url.searchParams.get('country') || undefined,
        contract: url.searchParams.get('contract') || undefined,
        q: url.searchParams.get('q') || undefined,
        minScore: url.searchParams.get('minScore') ?? undefined,
        sort,
      };
      const scored = scoreJobsForProfile(db, profile, filters);
      const limit = clampLimit(url.searchParams.get('limit') ?? undefined);
      const offset = clampOffset(url.searchParams.get('offset') ?? undefined);
      return sendJson(res, 200, {
        jobs: scored.slice(offset, offset + limit),
        total: scored.length,
        limit,
        offset,
        sort,
      });
    }

    if (pathname === '/api/jobs' && req.method === 'POST') {
      requireSameOrigin(req);
      const parsed = await readJson(req, JSON_LIMIT);
      if (parsed?.action === 'ingest' && parsed?.source === 'arbeitnow') {
        const items = await ingestArbeitnow({ limit: parsed.limit ?? 20 });
        const stored = [];
        for (const it of items) { try { stored.push(upsertJob(db, it)); } catch { /* skip bad */ } }
        return sendJson(res, 200, { ingested: stored.length, jobs: stored });
      }
      if (parsed?.action === 'ingest' && parsed?.source === 'remotive') {
        const items = await ingestRemotive({ limit: parsed.limit ?? 20, category: parsed.category ?? '' });
        const stored = [];
        for (const it of items) { try { stored.push(upsertJob(db, it)); } catch { /* skip bad */ } }
        return sendJson(res, 200, { ingested: stored.length, jobs: stored });
      }
      if (parsed?.job !== undefined) {
        const job = parsed.job;
        if (!job || typeof job !== 'object' || Array.isArray(job)) {
          return sendJson(res, 422, { error: 'invalid_job' });
        }
        if (typeof job.title !== 'string' || !job.title.trim()) {
          return sendJson(res, 422, { error: 'title_required' });
        }
        let stored;
        try {
          stored = upsertJob(db, job);
        } catch (error) {
          if (error?.message === 'invalid_url_scheme') return sendJson(res, 422, { error: 'invalid_url_scheme' });
          throw error;
        }
        return sendJson(res, 200, { job: stored });
      }
      return sendJson(res, 400, { error: 'expected_job_or_ingest' });
    }

    const jobStateMatch = pathname.match(/^\/api\/jobs\/([^/]+)\/state$/);
    if (jobStateMatch && req.method === 'PUT') {
      requireSameOrigin(req);
      const parsed = await readJson(req, JSON_LIMIT);
      const state = parsed?.state;
      if (typeof state !== 'string' || !JOB_STATES.includes(state)) {
        return sendJson(res, 422, { error: 'invalid_state', allowed: JOB_STATES });
      }
      const job = setJobState(db, safeDecode(jobStateMatch[1]), state);
      if (!job) return sendJson(res, 404, { error: 'job_not_found' });
      return sendJson(res, 200, { job });
    }

    const jobMatch = pathname.match(/^\/api\/jobs\/(.+)$/);
    if (jobMatch && req.method === 'DELETE') {
      requireSameOrigin(req);
      const id = safeDecode(jobMatch[1]);
      const submissionIds = submissionIdsForJob(db, id);
      if (submissionIds.length > 0 && url.searchParams.get('cascade') !== '1') {
        return sendJson(res, 409, { error: 'job_has_submissions', submissionIds });
      }
      transaction(db, () => {
        if (submissionIds.length > 0) db.prepare('DELETE FROM submissions WHERE job_id = ?').run(id);
        deleteJob(db, id);
      });
      return sendJson(res, 204, {});
    }

    if (pathname === '/api/letters' && req.method === 'POST') {
      requireSameOrigin(req);
      const parsed = await readJson(req, JSON_LIMIT);
      const jobId = parsed?.jobId;
      if (typeof jobId !== 'string' || !jobId.trim()) {
        return sendJson(res, 422, { error: 'jobId_required' });
      }
      const job = getJob(db, jobId);
      if (!job) return sendJson(res, 404, { error: 'job_not_found' });
      const profile = getProfile(db).profile;
      const letter = buildLetter(profile, job, {
        tone: parsed?.tone ?? 'formal',
        language: parsed?.language ?? profile.letterLanguage ?? 'en',
      });
      const sub = createSubmission(db, { jobId, letter: letter.text, status: 'drafted' });
      return sendJson(res, 200, { letter, submission: sub });
    }

    const letterFileMatch = pathname.match(/^\/api\/letters\/([^/]+)\.txt$/);
    if (letterFileMatch && req.method === 'GET') {
      const sub = getSubmission(db, safeDecode(letterFileMatch[1]));
      if (!sub) return sendJson(res, 404, { error: 'submission_not_found' });
      const text = String(sub.letter ?? '');
      res.writeHead(200, {
        'content-type': 'text/plain; charset=utf-8',
        'content-length': Buffer.byteLength(text),
        'content-disposition': `attachment; filename="letter-${sub.id}.txt"`,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      });
      return res.end(text);
    }

    if (pathname === '/api/submissions' && req.method === 'GET') {
      const status = url.searchParams.get('status') || undefined;
      if (status && !SUBMISSION_STATUSES.includes(status)) {
        return sendJson(res, 400, { error: 'invalid_status', allowed: SUBMISSION_STATUSES });
      }
      return sendJson(res, 200, { submissions: listSubmissions(db, { status }) });
    }

    const subStatusMatch = pathname.match(/^\/api\/submissions\/([^/]+)\/status$/);
    if (subStatusMatch && req.method === 'PUT') {
      requireSameOrigin(req);
      const parsed = await readJson(req, JSON_LIMIT);
      if (typeof parsed?.status !== 'string' || !parsed.status) {
        return sendJson(res, 400, { error: 'invalid_status', allowed: SUBMISSION_STATUSES });
      }
      const result = updateSubmissionStatus(db, safeDecode(subStatusMatch[1]), parsed.status);
      return sendSubmissionResult(res, result);
    }

    const subEventsMatch = pathname.match(/^\/api\/submissions\/([^/]+)\/events$/);
    if (subEventsMatch && req.method === 'GET') {
      const id = safeDecode(subEventsMatch[1]);
      if (!getSubmission(db, id)) return sendJson(res, 404, { error: 'submission_not_found' });
      return sendJson(res, 200, { events: listSubmissionEvents(db, id) });
    }

    const subMatch = pathname.match(/^\/api\/submissions\/([^/]+)$/);
    if (subMatch && req.method === 'GET') {
      const sub = getSubmission(db, safeDecode(subMatch[1]));
      if (!sub) return sendJson(res, 404, { error: 'submission_not_found' });
      return sendJson(res, 200, { submission: sub });
    }

    if (subMatch && req.method === 'PATCH') {
      requireSameOrigin(req);
      const parsed = await readJson(req, JSON_LIMIT);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return sendJson(res, 400, { error: 'invalid_body' });
      }
      if (parsed.status !== undefined && (typeof parsed.status !== 'string' || !parsed.status)) {
        return sendJson(res, 400, { error: 'invalid_status', allowed: SUBMISSION_STATUSES });
      }
      if (parsed.notes !== undefined && typeof parsed.notes !== 'string') {
        return sendJson(res, 400, { error: 'invalid_notes' });
      }
      const result = updateSubmission(db, safeDecode(subMatch[1]), { status: parsed.status, notes: parsed.notes });
      return sendSubmissionResult(res, result);
    }

    if (pathname === '/api/digest' && req.method === 'GET') {
      const digest = buildDigest({
        jobs: listJobs(db, { limit: 1000, offset: 0, state: 'all' }),
        submissions: listSubmissions(db),
      });
      return sendJson(res, 200, digest);
    }

    if (pathname === '/api/login/status' && req.method === 'GET') {
      return sendJson(res, 200, loginStatus());
    }

    if (pathname === '/api/login/start' && req.method === 'POST') {
      requireSameOrigin(req);
      if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) {
        return sendJson(res, 415, { error: 'expected_json' });
      }
      const body = await readBody(req, JSON_LIMIT);
      let parsed;
      try { parsed = JSON.parse(body.toString('utf8')); } catch { return sendJson(res, 400, { error: 'invalid_json' }); }
      if (!parsed?.loginUrl || !parsed?.successUrl) {
        return sendJson(res, 422, { error: 'loginUrl and successUrl are required' });
      }
      const profileDir = path.join(path.dirname(artifactsDir), 'browser-profile');
      // Fire and return immediately; the operator logs in and status is polled.
      startLogin({ loginUrl: parsed.loginUrl, successUrl: parsed.successUrl, profileDir }).catch(() => {});
      return sendJson(res, 202, { status: 'launching' });
    }

    if (pathname === '/api/login/cancel' && req.method === 'POST') {
      requireSameOrigin(req);
      await cancelLogin();
      return sendJson(res, 200, loginStatus());
    }

    return sendJson(res, 404, { error: 'not_found' });
  }

  function health(req, res) {
    let dbOk = true;
    try {
      db.prepare('SELECT 1').get();
    } catch {
      dbOk = false;
    }
    const chain = verifyChain(db);
    const { version } = getProfile(db);
    let events = chain.count;
    try {
      events = countEvents(db);
    } catch { /* keep chain count */ }
    const ok = dbOk && chain.ok;
    return sendJson(res, ok ? 200 : 503, {
      ok,
      app: 'jobpilot',
      phase: 'P1',
      host: hostName,
      profileVersion: version,
      events: { count: events, chain: chain.ok ? 'ok' : 'broken', brokenAt: chain.brokenAt ?? null },
      now: new Date().toISOString(),
    });
  }
}

async function readJson(req, limit = JSON_LIMIT) {
  if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) {
    throw httpError(415, 'expected_json');
  }
  const body = await readBody(req, limit);
  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    throw httpError(400, 'invalid_json');
  }
}

function sendSubmissionResult(res, result) {
  if (result.error === 'not_found') return sendJson(res, 404, { error: 'submission_not_found' });
  if (result.error === 'invalid_status') {
    return sendJson(res, 400, { error: 'invalid_status', allowed: SUBMISSION_STATUSES });
  }
  return sendJson(res, 200, { submission: result.submission });
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function requireSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return; // curl and the tests; no browser attaches Origin here
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw httpError(403, 'bad_origin');
  }
  if (originHost !== req.headers.host) throw httpError(403, 'cross_origin');
}

function defaultLog(entry) {
  // Structured one-line logs. Payloads never reach this; neither do emails or
  // phone numbers, because only method/path/status are logged.
  console.log(JSON.stringify({ t: new Date().toISOString(), ...entry }));
}

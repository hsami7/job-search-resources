// HTTP surface. One user, loopback by default: no sessions, no cookies, no
// ambient credentials. Mutations require a same-origin request.
import os from 'node:os';
import { countEvents, listEvents, verifyChain } from './events.js';
import { getProfile, saveProfile } from './profile.js';
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

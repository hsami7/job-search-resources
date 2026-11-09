// Sources that need a fetch: one pasted URL, or a company's public job board.
// Every endpoint here is documented and public. Nothing logs in, nothing
// pretends to be a browser, nothing touches a board that forbids it.
import { extractJobPosting } from './jsonld.js';
import { normalizeJob } from './jobs.js';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES = 3 * 1024 * 1024;

export class ImportError extends Error {
  constructor(code, message) {
    super(message ?? code);
    this.code = code;
  }
}

async function fetchLimited(url, { accept = 'text/html,application/xhtml+xml' } = {}) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new ImportError('invalid_url'); }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new ImportError('invalid_url', 'only http(s) URLs can be fetched');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: { accept, 'user-agent': 'jobPilot/1.0 (+self-hosted job tracker)' },
    });
  } catch (error) {
    throw new ImportError('fetch_failed', String(error?.message ?? error));
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new ImportError('fetch_failed', `upstream ${res.status}`);

  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > MAX_BYTES) throw new ImportError('too_large');

  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text();
    return text.slice(0, MAX_BYTES);
  }
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel().catch(() => {});
      throw new ImportError('too_large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
}

// One pasted posting URL. Reads the schema.org JobPosting the page already
// publishes for search engines; a page without one is a clean "unsupported"
// rather than a guess.
export async function importJobFromUrl(url) {
  const html = await fetchLimited(url);
  const posting = extractJobPosting(html, url);
  if (!posting) throw new ImportError('no_jobposting', 'no schema.org JobPosting on that page');
  if (!posting.title) throw new ImportError('no_jobposting', 'JobPosting has no title');
  return normalizeJob({ ...posting, url: posting.url || url });
}

// Greenhouse public board API. Token is the slug in boards.greenhouse.io/<token>.
export async function ingestGreenhouse({ board, limit = 25 } = {}) {
  const token = String(board ?? '').trim();
  if (!/^[a-z0-9_-]{1,64}$/i.test(token)) throw new ImportError('invalid_board');
  const body = await fetchLimited(
    `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`,
    { accept: 'application/json' },
  );
  let data;
  try { data = JSON.parse(body); } catch { throw new ImportError('bad_upstream', 'board returned invalid JSON'); }
  const items = Array.isArray(data?.jobs) ? data.jobs : [];
  return items.slice(0, limit).map((it) => normalizeJob({
    url: it.absolute_url,
    title: it.title,
    company: it.company_name || token,
    location: it.location?.name ?? '',
    description: stripTags(it.content ?? ''),
    postedAt: it.updated_at ?? it.created_at ?? null,
    skills: Array.isArray(it.metadata) ? it.metadata.map((m) => m?.name).filter(Boolean) : [],
    source: `greenhouse:${token}`,
  }));
}

// Lever public postings API. Token is the slug in jobs.lever.co/<token>.
export async function ingestLever({ board, limit = 25 } = {}) {
  const token = String(board ?? '').trim();
  if (!/^[a-z0-9_-]{1,64}$/i.test(token)) throw new ImportError('invalid_board');
  const body = await fetchLimited(
    `https://api.lever.co/v0/postings/${token}?mode=json`,
    { accept: 'application/json' },
  );
  let data;
  try { data = JSON.parse(body); } catch { throw new ImportError('bad_upstream', 'board returned invalid JSON'); }
  const items = Array.isArray(data) ? data : [];
  return items.slice(0, limit).map((it) => normalizeJob({
    url: it.hostedUrl ?? it.applyUrl ?? '',
    title: it.text,
    company: token,
    location: it.categories?.location ?? '',
    contract: it.categories?.commitment ?? '',
    description: stripTags(it.descriptionPlain ?? it.description ?? ''),
    postedAt: it.createdAt ? new Date(it.createdAt).toISOString() : null,
    skills: Array.isArray(it.categories?.team) ? it.categories.team : (it.categories?.team ? [it.categories.team] : []),
    source: `lever:${token}`,
  }));
}

function stripTags(html) {
  return String(html ?? '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|li|div|h[1-6]|tr)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

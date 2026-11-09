// JobPosting extraction from a page the user pasted. schema.org JSON-LD is the
// documented, machine-readable form most ATS platforms emit for search engines,
// so this reads exactly what the site already publishes for indexing. No HTML
// heuristics, no rendered-DOM scraping, no anti-bot games.
//
// Pure: takes HTML text + the page URL, returns a partial job or null.
export function extractJobPosting(html, pageUrl = '') {
  const blocks = jsonLdBlocks(String(html ?? ''));
  for (const block of blocks) {
    const found = findJobPosting(block);
    if (found) return toJob(found, pageUrl);
  }
  return null;
}

export function jsonLdBlocks(html) {
  const out = [];
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    const raw = match[1].trim();
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw));
    } catch {
      // A malformed block is common (trailing commas, escaped entities). Try a
      // couple of cheap repairs before giving up on it.
      try {
        out.push(JSON.parse(raw.replace(/,\s*([}\]])/g, '$1')));
      } catch { /* skip this block */ }
    }
  }
  return out;
}

function findJobPosting(node, depth = 0) {
  if (!node || depth > 6) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findJobPosting(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== 'object') return null;
  const type = node['@type'];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((t) => String(t ?? '').toLowerCase() === 'jobposting')) return node;
  if (node['@graph']) return findJobPosting(node['@graph'], depth + 1);
  return null;
}

function toJob(posting, pageUrl) {
  const org = posting.hiringOrganization;
  const company = typeof org === 'string' ? org : String(org?.name ?? '').trim();
  const location = locationText(posting.jobLocation);
  const remote = isRemote(posting) ? 'Remote' : '';
  const contract = Array.isArray(posting.employmentType)
    ? posting.employmentType[0]
    : posting.employmentType;
  const description = htmlToText(posting.description);
  const url = firstUrl(posting.url, posting.sameAs, pageUrl);

  return {
    title: String(posting.title ?? '').trim(),
    company,
    location,
    remote,
    contract: normalizeEmploymentType(contract),
    description,
    url,
    deadline: dateOnly(posting.validThrough),
    postedAt: isoOrNull(posting.datePosted),
    salary: salaryText(posting.baseSalary),
    skills: skillsFrom(posting),
    source: 'jsonld',
  };
}

function locationText(node) {
  const places = Array.isArray(node) ? node : [node];
  const parts = [];
  for (const place of places) {
    if (!place) continue;
    const address = place.address ?? place;
    const city = address?.addressLocality ?? '';
    const region = address?.addressRegion ?? '';
    const country = typeof address?.addressCountry === 'object'
      ? address.addressCountry?.name ?? ''
      : address?.addressCountry ?? '';
    const text = [city, region, country].map((s) => String(s).trim()).filter(Boolean).join(', ');
    if (text && !parts.includes(text)) parts.push(text);
  }
  return parts.join(' · ');
}

function isRemote(posting) {
  const types = posting.jobLocationType ?? posting.employmentType;
  const list = Array.isArray(types) ? types : [types];
  if (list.some((t) => /telecommute|remote/i.test(String(t ?? '')))) return true;
  return /remote|homeoffice|home-office|télétravail/i.test(String(posting.title ?? ''));
}

function normalizeEmploymentType(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const map = {
    FULL_TIME: 'Full-time', PART_TIME: 'Part-time', CONTRACTOR: 'Freelance',
    TEMPORARY: 'Fixed-term', INTERN: 'Internship', VOLUNTEER: 'Volunteer',
    PER_DIEM: 'Fixed-term', OTHER: '',
  };
  return map[text.toUpperCase()] ?? text;
}

function skillsFrom(posting) {
  const raw = posting.skills ?? posting.occupationalCategory ?? [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((s) => String(s ?? '').trim()).filter(Boolean).slice(0, 20);
}

function salaryText(base) {
  if (!base) return '';
  const one = Array.isArray(base) ? base[0] : base;
  if (!one) return '';
  const value = one.value ?? {};
  const amount = value.value ?? value.minValue ?? '';
  const currency = one.currency ?? '';
  const unit = String(value.unitText ?? '').toLowerCase();
  if (!amount) return '';
  const suffix = unit === 'hour' ? '/hr' : unit === 'month' ? '/mo' : unit === 'year' ? '/yr' : '';
  return `${currency} ${amount}${suffix}`.trim();
}

function firstUrl(...candidates) {
  for (const candidate of candidates) {
    const text = String(candidate ?? '').trim();
    if (/^https?:\/\//i.test(text)) return text;
  }
  return '';
}

function dateOnly(value) {
  const text = String(value ?? '').trim();
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function isoOrNull(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const at = new Date(text);
  return Number.isFinite(at.getTime()) ? at.toISOString() : null;
}

export function htmlToText(html) {
  return String(html ?? '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|li|div|h[1-6]|tr)\s*>/gi, '\n')
    .replace(/<\s*li\b[^>]*>/gi, '- ')
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

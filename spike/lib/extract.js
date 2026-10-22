// Generic job extraction (ADR-0018). Reads only a page it was pointed at.
// Order: schema.org JobPosting -> OpenGraph -> conservative heuristics.
// No crawling, no per-site selectors.

const htmlToText = (s) =>
  (s ?? '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

const name = (v) => (typeof v === 'string' ? v : (v?.name ?? null));

const flatten = (nodes) =>
  nodes.flatMap((n) => {
    if (!n || typeof n !== 'object') return [];
    const out = [n];
    if (Array.isArray(n['@graph'])) out.push(...flatten(n['@graph']));
    return out;
  });

function locationOf(node) {
  const places = asArray(node.jobLocation).flatMap((p) => asArray(p?.address ?? p));
  if (!places.length) {
    if (asArray(node.applicantLocationRequirements).length) return 'Remote';
    return null;
  }
  const parts = places.map((a) =>
    [a?.addressLocality, a?.addressRegion, name(a?.addressCountry)].filter(Boolean).join(', '),
  );
  const uniq = [...new Set(parts.filter(Boolean))];
  const remote = /TELECOMMUTE/i.test(JSON.stringify(node.jobLocationType ?? ''));
  return [uniq.join(' / '), remote ? 'Remote' : null].filter(Boolean).join(' · ') || null;
}

function salaryOf(node) {
  const s = node.baseSalary ?? node.estimatedSalary;
  const v = s?.value ?? s;
  if (!v) return null;
  const amount = v.value ?? v.minValue ?? null;
  const max = v.maxValue ?? null;
  const cur = v.currency ?? s?.currency ?? '';
  if (amount == null && max == null) return null;
  return [cur, [amount, max].filter((x) => x != null).join('-'), v.unitText ?? ''].filter(Boolean).join(' ').trim();
}

export async function extractJob(page) {
  const raw = await page.evaluate(() => ({
    url: location.href,
    htmlLang: document.documentElement.lang || null,
    ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent),
    og: Object.fromEntries(
      [...document.querySelectorAll('meta[property^="og:"]')].map((m) => [m.getAttribute('property'), m.getAttribute('content')]),
    ),
    h1: document.querySelector('h1')?.innerText?.trim() ?? null,
    title: document.title,
    metaDescription: document.querySelector('meta[name="description"]')?.content ?? null,
    mainText: (document.querySelector('main, article, [role="main"]') ?? document.body)?.innerText?.slice(0, 6000) ?? '',
  }));

  // 1. schema.org JobPosting
  const nodes = raw.ld
    .map((txt) => {
      try {
        return JSON.parse(txt);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const postings = flatten(nodes).filter((n) => asArray(n['@type']).some((t) => /JobPosting/i.test(String(t))));

  if (postings.length) {
    const p = postings[0];
    const job = {
      source: 'generic',
      url: p.url ?? raw.url,
      title: p.title ?? null,
      company: name(p.hiringOrganization) ?? name(p.organization) ?? null,
      location: locationOf(p),
      remote: /telecommute|remote/i.test(`${JSON.stringify(p.jobLocationType ?? '')} ${p.jobLocation?.address?.addressCountry ?? ''} ${p.title ?? ''}`) || null,
      employmentTypes: asArray(p.employmentType).filter(Boolean),
      postedAt: p.datePosted ?? null,
      validThrough: p.validThrough ?? null,
      salary: salaryOf(p),
      description: htmlToText(p.description),
      language: raw.htmlLang,
      strategy: 'jsonld',
      rawUrl: raw.url,
    };
    return { job, notes: [`${postings.length} JobPosting node(s)`] };
  }

  // 2. OpenGraph
  const ogTitle = raw.og['og:title'] ?? null;
  const ogDescription = raw.og['og:description'] ?? null;
  if (ogTitle && ogDescription && ogDescription.length > 40) {
    return {
      job: {
        source: 'generic',
        url: raw.og['og:url'] ?? raw.url,
        title: ogTitle.replace(/\s*[|–-]\s*[^|–-]{2,30}$/, '').trim() || ogTitle,
        // og:site_name is the site, not the employer. Left null rather than guessed:
        // a wrong employer silently mis-routes the job.
        company: null,
        location: null,
        remote: null,
        employmentTypes: [],
        postedAt: null,
        validThrough: null,
        salary: null,
        description: htmlToText(ogDescription),
        language: raw.htmlLang,
        strategy: 'opengraph',
        rawUrl: raw.url,
      },
      notes: ['no JobPosting node; used og:title/og:description'],
    };
  }

  // 3. heuristics — lowest confidence, still better than nothing
  return {
    job: {
      source: 'generic',
      url: raw.url,
      title: raw.h1 ?? raw.title?.split('|')[0]?.trim() ?? null,
      company: null,
      location: null,
      remote: null,
      employmentTypes: [],
      postedAt: null,
      validThrough: null,
      salary: null,
      description: htmlToText(raw.metaDescription ?? raw.mainText),
      language: raw.htmlLang,
      strategy: 'heuristics',
      rawUrl: raw.url,
    },
    notes: ['no structured data; heuristic fallback — company/location unknown'],
  };
}

export function completeness(job) {
  const required = ['title', 'company', 'description', 'location'];
  const present = required.filter((k) => job[k] && String(job[k]).length > 1);
  return { present, missing: required.filter((k) => !present.includes(k)), score: present.length / required.length };
}

// W0 step 5: L2 API path — Arbeitnow board -> normalized job records.
import { writeFileSync, mkdirSync } from 'node:fs';
import { OUT_DIR } from './lib/browser.js';

const strip = (html) =>
  (html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .trim();

const normalize = (r) => ({
  externalId: r.slug,
  source: 'arbeitnow',
  mode: 'api',
  url: r.url,
  title: r.title,
  company: r.company_name,
  location: r.location || null,
  remote: Boolean(r.remote),
  employmentTypes: r.job_types ?? [],
  tags: r.tags ?? [],
  postedAt: r.created_at ? new Date(r.created_at * 1000).toISOString() : null,
  description: strip(r.description).slice(0, 1200),
  provenance: { provider: 'arbeitnow', fetchedAt: new Date().toISOString() },
});

const res = await fetch('https://www.arbeitnow.com/api/job-board-api', {
  headers: { accept: 'application/json' },
});
if (!res.ok) throw new Error(`arbeitnow ${res.status}`);
const body = await res.json();
const jobs = (body.data ?? []).map(normalize).filter((j) => j.title && j.company);

const missingRequired = jobs.filter((j) => !j.title || !j.company || !j.location);
console.log(`[arbeitnow] fetched ${body.data?.length ?? 0}, normalized ${jobs.length}`);
console.log(`[arbeitnow] missing title/company/location: ${missingRequired.length}`);
console.log(`[arbeitnow] remote: ${jobs.filter((j) => j.remote).length}/${jobs.length}`);
console.log(`[arbeitnow] sample:`);
for (const j of jobs.slice(0, 3)) {
  console.log(`  - ${j.title} @ ${j.company} | ${j.location} | remote=${j.remote} | ${j.employmentTypes.join(',')}`);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/arbeitnow.json`, JSON.stringify(jobs, null, 2));
writeFileSync(`${OUT_DIR}/arbeitnow-urls.json`, JSON.stringify(jobs.slice(0, 4).map((j) => j.url), null, 2));
console.log(`[arbeitnow] written ${jobs.length} records`);

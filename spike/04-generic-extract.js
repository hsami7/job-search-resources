// W0 step 6: measure the generic extractor across platforms.
// Feeds it 3 platforms that publish job URLs + the 2 local sites, so the claim
// "any job page works" gets a measured hit rate instead of an assumption.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { launchBrave, connect, OUT_DIR } from './lib/browser.js';
import { extractJob, completeness } from './lib/extract.js';

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));

const urls = [];

if (existsSync(`${OUT_DIR}/arbeitnow-urls.json`)) {
  urls.push(...read(`${OUT_DIR}/arbeitnow-urls.json`).slice(0, 2));
}

try {
  const rk = await fetch('https://remoteok.com/api', { headers: { 'user-agent': 'Mozilla/5.0' } }).then((r) => r.json());
  const first = rk.find((j) => j.url && j.position);
  if (first) urls.push(first.url);
} catch (err) {
  console.log(`[generic] remoteok skipped: ${err.message}`);
}

try {
  const xml = await fetch('https://weworkremotely.com/categories/remote-programming-jobs.rss').then((r) => r.text());
  const links = [...xml.matchAll(/<link>(https:\/\/weworkremotely\.com\/remote-jobs\/[^<]+)<\/link>/g)].map((m) => m[1]);
  if (links[0]) urls.push(links[0]);
} catch (err) {
  console.log(`[generic] wwr skipped: ${err.message}`);
}

// local sites: included to show where generic extraction legitimately fails
const rekrute = existsSync('spike/fixtures/golden/rekrute-listing.json') ? read('spike/fixtures/golden/rekrute-listing.json') : [];
const maroc = existsSync('spike/fixtures/golden/marocannonces-listing.json') ? read('spike/fixtures/golden/marocannonces-listing.json') : [];
if (rekrute[0]?.href) urls.push(rekrute[0].href);
if (maroc[0]?.href) urls.push(maroc[0].href);

const { port } = await launchBrave();
const { browser, context } = await connect(port);
const page = context.pages()[0] ?? (await context.newPage());

const results = [];
for (const url of urls) {
  const row = { url };
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1200);
    const { job, notes } = await extractJob(page);
    const c = completeness(job);
    Object.assign(row, {
      host: new URL(url).host,
      strategy: job.strategy,
      title: job.title,
      company: job.company,
      location: job.location,
      remote: job.remote,
      postedAt: job.postedAt,
      salary: job.salary,
      descLen: job.description?.length ?? 0,
      completeness: `${c.present.length}/4`,
      missing: c.missing,
      notes,
    });
  } catch (err) {
    row.error = err.message.split('\n')[0];
  }
  results.push(row);
  console.log(
    `${row.error ? 'ERR ' : row.completeness === '4/4' ? 'OK  ' : 'PART'} ${row.strategy ?? '-'} ${row.host} | ${row.title?.slice(0, 40) ?? '-'} | ${row.company ?? '-'} | ${row.completeness ?? ''} ${row.missing ? `missing=${row.missing}` : ''}${row.error ? row.error : ''}`,
  );
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/generic-extract.json`, JSON.stringify(results, null, 2));

const byStrategy = results.reduce((a, r) => ((a[r.strategy ?? 'error'] = (a[r.strategy ?? 'error'] ?? 0) + 1), a), {});
console.log(`\n[generic] strategies: ${JSON.stringify(byStrategy)}`);
console.log(`[generic] full 4/4 records: ${results.filter((r) => r.completeness === '4/4').length}/${results.length}`);
await browser.close();

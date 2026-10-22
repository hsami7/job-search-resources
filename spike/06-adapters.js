// W0 step 7: run one local adapter 3x and measure selector stability.
// Usage: SITE=rekrute RUNS=3 node spike/06-adapters.js
import { writeFileSync, mkdirSync } from 'node:fs';
import { launchBrave, connect, OUT_DIR } from './lib/browser.js';
import { pause, humanScroll } from './lib/pacing.js';

const site = process.env.SITE || 'rekrute';
const runs = Number(process.env.RUNS || 3);
const adapter = await import(`./adapters/${site}.js`);

const { port } = await launchBrave();
const { browser, context } = await connect(port);
const page = context.pages()[0] ?? (await context.newPage());

mkdirSync(OUT_DIR, { recursive: true });
const runResults = [];

for (let run = 1; run <= runs; run++) {
  const url = adapter.listingUrl({ page: 1 });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pause(1500, 2600);
  await humanScroll(page, 3);

  const jobs = await adapter.collectFromListing(page);
  const valid = jobs.filter((j) => j.title && j.url);
  const withLocation = valid.filter((j) => j.location);
  const withCompany = valid.filter((j) => j.company);
  const uniqueIds = new Set(valid.map((j) => j.externalId ?? j.url));

  const result = {
    run,
    url,
    ms: Date.now() - t0,
    cards: jobs.length,
    valid: valid.length,
    withLocation: withLocation.length,
    withCompany: withCompany.length,
    unique: uniqueIds.size,
    ids: [...uniqueIds],
  };
  runResults.push(result);
  console.log(
    `[${site}] run ${run}: cards=${result.cards} valid=${result.valid} unique=${result.unique} location=${result.withLocation}/${result.valid} company=${result.withCompany}/${result.valid} ${result.ms}ms`,
  );

  writeFileSync(`${OUT_DIR}/${site}-run${run}.json`, JSON.stringify(jobs, null, 2));
  if (run < runs) await pause(4000, 9000); // between runs, not between requests
}

// stability: how much the id set overlaps between consecutive runs
const stability = runResults.slice(1).map((r, i) => {
  const prev = new Set(runResults[i].ids);
  const now = new Set(r.ids);
  const shared = [...now].filter((x) => prev.has(x)).length;
  return { from: runResults[i].run, to: r.run, shared, ratio: +(shared / Math.max(now.size, 1)).toFixed(2) };
});

const counts = runResults.map((r) => r.cards);
const summary = {
  site,
  runs,
  cardCounts: counts,
  cardCountStable: new Set(counts).size === 1,
  stability,
  avgMs: Math.round(runResults.reduce((a, r) => a + r.ms, 0) / runResults.length),
};
console.log(`[${site}] card counts: ${counts.join(', ')} (stable=${summary.cardCountStable})`);
console.log(`[${site}] overlap between runs: ${JSON.stringify(stability)}`);
writeFileSync(`${OUT_DIR}/${site}-summary.json`, JSON.stringify(summary, null, 2));

await browser.close();

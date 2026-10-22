// W0 step 2: prove we can launch our own Brave, attach over CDP, navigate,
// screenshot and shut down cleanly.
import { launchBrave, connect, shot } from './lib/browser.js';

const { version, port, reused } = await launchBrave();
console.log(`[smoke] CDP on :${port} (reused=${reused})`);
console.log(`[smoke] browser: ${version.Browser}`);
console.log(`[smoke] protocol: ${version['Protocol-Version']}`);

const { browser, context } = await connect(port);
const page = await context.newPage();
console.log(`[smoke] contexts=${browser.contexts().length} pages=${context.pages().length}`);

await page.goto('about:blank');
const ua = await page.evaluate(() => navigator.userAgent);
console.log(`[smoke] ua: ${ua}`);

await page.setContent(
  '<h1>jobPilot W0</h1><p>browser owned by the backend</p>',
);
const file = await shot(page, 'smoke');
console.log(`[smoke] screenshot: ${file}`);

await browser.close(); // closes the CDP connection, not the process
console.log('[smoke] OK');

// Spike prototype of the Verification Center "Take control" handoff on a headless host.
// Streams the owned browser's viewport and forwards mouse/keyboard back over CDP.
// Zero extra daemons: no X server viewer, no VNC, works over the same HTTPS/Tailscale path.
//
// Known limit: CDP screenshots show the page only, not browser chrome or native dialogs.
// If a flow needs those, fall back to Xvfb+X11VNC (documented in SPIKE-REPORT.md).
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { launchBrave, connect } from '../lib/browser.js';

const PORT = Number(process.env.TC_PORT || 8099);
const HOST = process.env.TC_HOST || '127.0.0.1';
const TOKEN = process.env.TC_TOKEN || randomBytes(8).toString('hex');
const FPS_MS = 250;

const { port: cdpPort, version } = await launchBrave();
const { browser, context } = await connect(cdpPort);
let page = context.pages()[0] ?? (await context.newPage());

const json = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

const authorized = (url) => url.searchParams.get('token') === TOKEN;

const clients = new Set();

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(PAGE);
    return;
  }
  if (!authorized(url)) return json(res, 401, { error: 'bad token' });

  // Local fixtures: used by the freeze test and by this server's own input test.
  if (url.pathname.startsWith('/fixtures/')) {
    const name = path.basename(url.pathname);
    try {
      const buf = await readFile(path.join(path.resolve('spike/fixtures'), name));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(buf);
    } catch {
      return json(res, 404, { error: 'no such fixture' });
    }
  }

  if (url.pathname === '/state') {
    return json(res, 200, {
      url: page.url(),
      title: await page.title().catch(() => ''),
      text: await page.evaluate(() => document.body?.innerText?.slice(0, 400)).catch(() => ''),
      inner: await page.evaluate(() => [window.innerWidth, window.innerHeight]).catch(() => null),
      browser: version.Browser,
      clients: clients.size,
    });
  }

  if (url.pathname === '/frames') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    const client = { res };
    clients.add(client);
    req.on('close', () => clients.delete(client));
    return;
  }

  if (url.pathname === '/input' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      await applyInput(JSON.parse(body || '{}'));
      return json(res, 200, { ok: true });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  json(res, 404, { error: 'not found' });
});

async function applyInput(ev) {
  if (ev.type === 'click') await page.mouse.click(ev.x, ev.y);
  else if (ev.type === 'move') await page.mouse.move(ev.x, ev.y);
  else if (ev.type === 'scroll') await page.mouse.wheel(0, ev.dy);
  else if (ev.type === 'type') await page.keyboard.insertText(ev.text);
  else if (ev.type === 'key') await page.keyboard.press(ev.key);
  else if (ev.type === 'goto') await page.goto(ev.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  else throw new Error(`unknown input type: ${ev.type}`);
}

// One capture loop shared by all viewers; idle when nobody is watching.
let looping = false;
async function loop() {
  if (looping) return;
  looping = true;
  while (clients.size > 0) {
    const started = Date.now();
    try {
      if (page.isClosed()) page = (await context.newPage());
      const buf = await page.screenshot({ type: 'jpeg', quality: 60 });
      const frame = `data: ${JSON.stringify({
        t: Date.now(),
        url: page.url(),
        png: buf.toString('base64'),
      })}\n\n`;
      for (const c of clients) c.res.write(frame);
    } catch (err) {
      for (const c of clients) c.res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    }
    const wait = FPS_MS - (Date.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }
  looping = false;
}

server.listen(PORT, HOST, () => {
  console.log(`take-control listening on http://${HOST}:${PORT}/?token=${TOKEN}`);
  console.log(`state: http://${HOST}:${PORT}/state?token=${TOKEN}`);
  console.log('open the URL in your own browser, log in, then press Resume in jobPilot');
});

server.on('connection', () => {
  if (clients.size > 0) loop();
});
// Kick the loop when a viewer connects (SSE handler runs before this tick).
setInterval(() => clients.size > 0 && loop(), 1000).unref();

const PAGE = `<!doctype html><meta charset=utf-8><title>jobPilot take control</title>
<style>
  body{margin:0;font:13px system-ui;background:#111;color:#ddd}
  header{display:flex;gap:8px;padding:6px;align-items:center;background:#1c1c1c}
  input{flex:1;background:#000;color:#ddd;border:1px solid #333;padding:4px}
  #wrap{position:relative;line-height:0;overflow:auto;max-height:calc(100vh - 76px)}
  img{width:100%;cursor:crosshair}
  #url{color:#8ab4f8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:45%}
</style>
<header>
  <input id=go placeholder="paste a URL and press Enter">
  <div id=url>connecting…</div>
</header>
<div id=wrap><img id=v alt="browser viewport"></div>
<script>
const T = new URLSearchParams(location.search).get('token');
const v = document.getElementById('v');
const urlEl = document.getElementById('url');
let scale = 1;

const send = (ev) => fetch('/input?token=' + T, {method:'POST', body: JSON.stringify(ev)});

const es = new EventSource('/frames?token=' + T);
es.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.error) { urlEl.textContent = 'error: ' + d.error; return; }
  v.src = 'data:image/jpeg;base64,' + d.png;
  urlEl.textContent = d.url;
};

// map displayed pixels back to page viewport pixels
const pt = (e) => {
  const r = v.getBoundingClientRect();
  return { x: Math.round((e.clientX - r.left) * (v.naturalWidth / r.width)),
           y: Math.round((e.clientY - r.top) * (v.naturalHeight / r.height)) };
};
v.addEventListener('click', (e) => send({type:'click', ...pt(e)}));
v.addEventListener('mousemove', (e) => { if (e.buttons) send({type:'move', ...pt(e)}); });
document.addEventListener('wheel', (e) => { if (e.target === v) { e.preventDefault(); send({type:'scroll', dy: e.deltaY}); } }, {passive:false});
document.addEventListener('keydown', (e) => {
  if (document.activeElement.tagName === 'INPUT') return;
  if (['Enter','Tab','Backspace','Escape','ArrowUp','ArrowDown'].includes(e.key)) { e.preventDefault(); send({type:'key', key:e.key}); }
  else if (e.key.length === 1) { e.preventDefault(); send({type:'type', text:e.key}); }
});
document.getElementById('go').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { send({type:'goto', url: e.target.value}); e.target.value=''; }
});
</script>`;

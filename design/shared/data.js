// Shared mockup content for all design directions. Real records from the W0 scrape
// (spike/fixtures/golden) so the mockups are judged against actual Moroccan listings.
window.JOBPILOT = {
  user: { name: 'Yassine', city: 'Casablanca', resume: 'Resume v4 · parsed 22 Oct', fit: 82 },

  run: {
    state: 'discovering',
    host: 'PC',
    site: 'rekrute.com',
    page: 'offres-emploi-maroc.html',
    action: 'reading listing 1 of 3',
    started: '14:02',
    elapsed: '3m 41s',
    found: 6,
  },

  hosts: [
    { id: 'PC', state: 'green', label: 'Ready', heartbeat: '1s ago', db: '41 MB', events: 1288, lastBackup: '4h ago' },
  ],

  trust: {
    score: 76,
    band: 'Caution',
    signals: [
      { name: 'No WebGL context', state: 'FAIL', fix: 'Install Mesa (llvmpipe) or accept a SwiftShader renderer', weight: 8 },
      { name: 'Timezone UTC vs IP Europe/Berlin', state: 'FAIL', fix: 'Set TZ=Europe/Berlin or change the egress region', weight: 9 },
      { name: 'navigator.webdriver', state: 'PASS', fix: null, weight: 20 },
      { name: 'Session age', state: 'PASS', fix: null, weight: 15 },
      { name: 'Shields on, cookies survive close', state: 'PASS', fix: null, weight: 15 },
      { name: 'WebRTC leaks only private IP', state: 'PASS', fix: null, weight: 2 },
    ],
  },

  triage: {
    ready: [
      { id: 'j1', title: 'Conseiller de service', company: 'Auto Hall', city: 'Casablanca', source: 'rekrute.com', score: 88, type: 'CDI', honesty: 'all claims traced' },
      { id: 'j3', title: 'Business développeur', company: 'Alten Maroc', city: 'Rabat', source: 'rekrute.com', score: 84, type: 'CDI', honesty: 'all claims traced' },
      { id: 'j4', title: 'Technicien Laboratoire', company: 'AKDITAL', city: 'Mohammédia', source: 'rekrute.com', score: 81, type: 'CDI', honesty: 'all claims traced' },
    ],
    needsYou: [
      { id: 'j2', title: 'Chargé de relation client', company: 'Fondation Arrawaj', city: 'Rabat', source: 'rekrute.com', score: 74, type: 'CDI', honesty: '3 of 3 review rounds used' },
      { id: 'j5', title: 'Commercial sédentaire 100%', company: 'unknown employer', city: 'Casablanca', source: 'marocannonces.com', score: 61, type: 'unspecified', honesty: 'employer not named in listing' },
    ],
    skip: [
      { id: 'j6', title: 'Recrutement à Casablanca — assurance', company: 'Foundever', city: 'Casablanca', source: 'rekrute.com', score: 32, type: 'CDI', honesty: 'title is a recruiter paragraph' },
      { id: 'j7', title: '(no title)', company: null, city: 'Casablanca', source: 'marocannonces.com', score: 12, type: 'banner ad', honesty: 'classified ad, not a job' },
    ],
  },

  jobs: [
    { title: 'Conseiller de service', company: 'Auto Hall', city: 'Casablanca', country: 'Morocco', source: 'rekrute.com', salary: null, age: 'today', signal: 'high', type: 'CDI' },
    { title: 'Technicien Laboratoire', company: 'AKDITAL', city: 'Mohammédia', country: 'Morocco', source: 'rekrute.com', salary: null, age: 'today', signal: 'high', type: 'CDI' },
    { title: 'Chargé marketing', company: 'unnamed', city: 'Casablanca', country: 'Morocco', source: 'marocannonces.com', salary: '6 000 – 8 000 dh', age: 'today', signal: 'high', type: 'unspecified' },
    { title: 'Business développeur (énergie)', company: 'Alten Maroc', city: 'Rabat', country: 'Morocco', source: 'rekrute.com', salary: null, age: 'today', signal: 'medium', type: 'CDI' },
    { title: 'Comptable confirmé(e)', company: 'unnamed', city: 'Rabat', country: 'Morocco', source: 'marocannonces.com', salary: 'à discuter', age: 'today', signal: 'medium', type: 'unspecified' },
    { title: 'Senior Backend Engineer', company: 'DuckDuckGo', city: 'Remote', country: 'Remote', source: 'remoteok.com', salary: '$150k – $190k', age: '2h', signal: 'high', type: 'Full-time' },
    { title: 'Stage marketing — non rémunéré', company: 'unnamed', city: 'Casablanca', country: 'Morocco', source: 'marocannonces.com', salary: 'unpaid', age: 'today', signal: 'low', type: 'Stage' },
    { title: 'Technicien de maintenance industrielle', company: 'unnamed', city: 'Casablanca', country: 'Morocco', source: 'marocannonces.com', salary: 'à discuter', age: 'today', signal: 'medium', type: 'unspecified' },
  ],

  locations: [
    { country: 'Morocco', cities: ['Casablanca', 'Rabat', 'Mohammédia'], count: 6 },
    { country: 'Remote', cities: ['anywhere'], count: 1 },
    { country: 'France', cities: [], count: 0 },
  ],

  sites: [
    { host: 'rekrute.com', mode: 'adapter', state: 'working', lastScan: '3m ago', found: 6 },
    { host: 'marocannonces.com', mode: 'adapter', state: 'working', lastScan: '3m ago', found: 20 },
    { host: 'job.ma', mode: 'adapter', state: 'planned', lastScan: '—', found: 0 },
    { host: 'linkedin.com', mode: 'paste', state: 'manual', lastScan: '2 days ago', found: 1 },
    { host: 'indeed.com', mode: 'paste', state: 'manual', lastScan: '—', found: 0 },
    { host: 'arbeitnow.com', mode: 'api', state: 'working', lastScan: '5m ago', found: 300 },
  ],

  verification: {
    site: 'rekrute.com',
    url: 'https://www.rekrute.com/offres-emploi-maroc.html?page=2',
    type: 'security challenge',
    host: 'PC',
    run: 'run 41 · job “Technicien Laboratoire”',
    at: '14:04:12',
    age: '2m 10s',
    guidance: {
      account: 'h•••@gmail.com',
      search: 'from:no-reply newer:10m',
      phone: '+212 6•• ••• •••',
      validFor: '10 minutes',
    },
  },

  doctor: [
    { name: 'Node.js 26.12.0', state: 'PASS', why: 'runtime version is supported', fix: null },
    { name: 'SQLite integrity_check', state: 'PASS', why: 'database is consistent, WAL enabled', fix: null },
    { name: 'Disk space', state: 'PASS', why: '120 GB free', fix: null },
    { name: 'Brave 1.98.60 + Playwright 1.64.1', state: 'PASS', why: 'versions pinned and matching', fix: null },
    { name: 'Browser profile writable', state: 'PASS', why: 'spike/profile/brave is writable', fix: null },
    { name: 'WebGL / renderer', state: 'FAIL', why: 'no GL context on this host; easy to fingerprint', fix: 'Install Mesa llvmpipe, then relaunch headed' },
    { name: 'Clock and timezone', state: 'FAIL', why: 'browser UTC, egress IP Europe/Berlin', fix: 'Set TZ=Europe/Berlin' },
    { name: 'Tectonic + LaTeX smoke test', state: 'WARN', why: 'not installed; PDF falls back to Markdown', fix: 'Install Tectonic before P3' },
    { name: 'OpenRouter key', state: 'PASS', why: 'valid, 412 credits remaining', fix: null },
    { name: 'Ollama', state: 'WARN', why: 'not installed; no local fallback', fix: 'Optional: install Ollama' },
    { name: 'Tailscale + certificate', state: 'PASS', why: 'neger7lost-archlinux.tail9f2.ts.net valid for 71 days', fix: null },
    { name: 'VAPID push keys', state: 'PASS', why: 'keys present, 1 device subscribed', fix: null },
    { name: 'Backup freshness', state: 'PASS', why: 'last backup 4h ago', fix: null },
  ],

  logs: [
    { t: '14:06:41', lvl: 'INFO', agent: 'scout', site: 'rekrute.com', msg: 'listing parsed: 10 cards, 10 valid, 0 selector misses', dur: '1.8s' },
    { t: '14:06:39', lvl: 'INFO', agent: 'scout', site: 'rekrute.com', msg: 'navigated page 1/3 (human pacing 2.4s)', dur: '2.4s' },
    { t: '14:06:12', lvl: 'WARN', agent: 'doctor', site: '—', msg: 'trust score 76 (Caution): no WebGL, timezone mismatch', dur: '312ms' },
    { t: '14:06:10', lvl: 'INFO', agent: 'doctor', site: '—', msg: 'pre-run checks: 11 pass, 2 warn, 2 fail — run allowed', dur: '1.1s' },
    { t: '14:05:58', lvl: 'INFO', agent: 'scout', site: 'marocannonces.com', msg: 'listing parsed: 21 cards, 20 valid, 1 banner ad skipped', dur: '2.1s' },
    { t: '14:05:02', lvl: 'ERROR', agent: 'scout', site: 'job.ma', msg: 'no adapter configured — routed to paste-URL instead', dur: '0ms' },
    { t: '14:04:12', lvl: 'ALERT', agent: 'scout', site: 'rekrute.com', msg: 'verification wall detected: security challenge. Agent frozen. push sent in 1.4s', dur: '1.4s' },
    { t: '14:04:11', lvl: 'INFO', agent: 'scout', site: 'rekrute.com', msg: 'clicked “page 2”', dur: '180ms' },
    { t: '14:03:40', lvl: 'INFO', agent: 'llm', site: '—', msg: 'openrouter/claude-haiku: 1 call, 812 tokens, $0.0004, 1.9s', dur: '1.9s' },
    { t: '14:02:00', lvl: 'INFO', agent: 'lease', site: '—', msg: 'run 41 started on PC (lease 30m, heartbeat 5s)', dur: '—' },
  ],

  credentials: [
    { site: 'rekrute.com', user: 'yassine.m@…', kind: 'password + TOTP', lastUsed: '3m ago', uses: 18 },
    { site: 'marocannonces.com', user: 'yassine.m@…', kind: 'password', lastUsed: '3m ago', uses: 11 },
    { site: 'linkedin.com', user: 'not stored', kind: 'manual login', lastUsed: '2 days ago', uses: 0 },
    { site: 'gmail (OAuth)', user: 'h•••@gmail.com', kind: 'token, read + send', lastUsed: '1h ago', uses: 64 },
  ],

  backup: {
    state: 'current',
    lastBackup: '4h ago',
    size: '41 MB',
    hash: 'hash verified',
    note: 'Local backup on this PC; no second copy exists.',
  },

  artifacts: [
    { name: 'Resume — Auto Hall — Conseiller de service', kind: 'PDF', version: 'v3', hash: 'a91f…', check: 'passed' },
    { name: 'Cover letter — Auto Hall', kind: 'PDF', version: 'v2', hash: '7c02…', check: 'passed' },
    { name: 'Resume — Alten Maroc — Business développeur', kind: 'PDF', version: 'v1', hash: 'e4b7…', check: '3 rounds, notes attached' },
  ],

  learned: [
    { rule: 'Drop listings with no named employer', from: '2 rejections', host: 'PC' },
    { rule: 'Shorten cover letters to 180 words', from: '4 edits', host: 'PC' },
    { rule: 'Down-weight “centre d’appels” sector', from: '3 rejections', host: 'PC' },
  ],
};

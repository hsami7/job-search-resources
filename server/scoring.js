// Fit scoring between a profile and a job. Pure function, no I/O.
//
// Weights sum to 100: skills 40, title 15, contract 10, seniority 10,
// remote 5, location 10, freshness 10. A missing signal scores the neutral
// half of its term and lowers `confidence`; it never earns full marks.
const CONTRACT_ALIASES = {
  freelance: 'freelance', contract: 'freelance', contractor: 'freelance', freiberuflich: 'freelance',
  full_time: 'full-time', 'full-time': 'full-time', fulltime: 'full-time', 'full time': 'full-time',
  cdi: 'full-time', 'unbefristeter arbeitsvertrag': 'full-time', permanent: 'full-time',
  part_time: 'part-time', 'part-time': 'part-time', parttime: 'part-time', 'part time': 'part-time',
  teilzeit: 'part-time',
  cdd: 'fixed-term', 'fixed term': 'fixed-term', 'fixed-term': 'fixed-term', befristet: 'fixed-term',
  temporary: 'fixed-term',
  internship: 'internship', intern: 'internship', stage: 'internship', stagiaire: 'internship',
  praktikum: 'internship', werkstudent: 'internship',
};

const SENIORITY_ALIASES = {
  intern: 'intern', internship: 'intern', stage: 'intern', stagiaire: 'intern', praktikant: 'intern',
  junior: 'junior', entry: 'junior', graduate: 'junior',
  mid: 'mid', intermediate: 'mid',
  senior: 'senior',
  lead: 'lead', principal: 'lead', staff: 'lead',
};

// Canonical spellings so "js" on the profile matches "JavaScript" in a posting.
const SKILL_ALIASES = {
  js: 'javascript', javascript: 'javascript', ecmascript: 'javascript',
  node: 'node.js', nodejs: 'node.js', 'node.js': 'node.js',
  reactjs: 'react', 'react.js': 'react', react: 'react',
  ts: 'typescript', typescript: 'typescript',
  py: 'python', python3: 'python', python: 'python',
  k8s: 'kubernetes', kubernetes: 'kubernetes',
  golang: 'go', go: 'go',
  postgres: 'postgresql', psql: 'postgresql', postgresql: 'postgresql',
  ml: 'machine learning', 'machine-learning': 'machine learning',
  ai: 'artificial intelligence',
  pentest: 'penetration testing', pentesting: 'penetration testing', 'penetration-testing': 'penetration testing',
  infosec: 'cybersecurity', 'cyber security': 'cybersecurity', cybersecurity: 'cybersecurity',
  soc: 'security operations',
  docker: 'docker', containers: 'docker',
};

const CONTRACT_NEAR_MISS = new Set([
  'full-time|fixed-term', 'fixed-term|full-time',
  'internship|part-time', 'part-time|internship',
  'freelance|fixed-term', 'fixed-term|freelance',
]);

const SENIORITY_ADJACENT = new Set([
  'intern|junior', 'junior|intern',
  'junior|mid', 'mid|junior',
]);

// Words that describe the level, not the role. Removed before the title
// comparison so "Senior Security Analyst" and "Security Analyst" still line up
// on the part that matters.
const SENIORITY_WORDS = new Set([
  'senior', 'sr', 'junior', 'jr', 'lead', 'principal', 'staff', 'head',
  'intern', 'internship', 'stage', 'stagiaire', 'praktikum', 'werkstudent',
  'trainee', 'placement', 'co-op', 'coop', 'graduate', 'entry', 'mid', 'i', 'ii', 'iii',
]);

const INTERNSHIP_WORDS = new Set([
  'intern', 'internship', 'stage', 'stagiaire', 'praktikum', 'werkstudent',
  'trainee', 'placement', 'co-op', 'coop',
]);

export function normContract(v) {
  const s = String(v ?? '').toLowerCase().trim();
  return CONTRACT_ALIASES[s] ?? s;
}

export function normSeniority(v) {
  const s = String(v ?? '').toLowerCase().trim();
  return SENIORITY_ALIASES[s] ?? s;
}

export function canonicalSkill(raw) {
  const key = fold(raw).replace(/\s+/g, ' ').trim();
  return SKILL_ALIASES[key] ?? key;
}

// Accents and spacing are noise for matching: "Cybersécurité" must equal
// "cybersecurity", and "Cyber Security" must too. Spaced compounds are
// collapsed before tokenizing so the two spellings meet in the middle.
const PHRASE_ALIASES = [
  ['cyber security', 'cybersecurity'],
  ['information security', 'infosec'],
  ['penetration testing', 'pentesting'],
  ['machine learning', 'machinelearning'],
  ['data science', 'datascience'],
  ['full stack', 'fullstack'],
  ['front end', 'frontend'],
  ['back end', 'backend'],
  ['node js', 'nodejs'],
  ['react js', 'reactjs'],
  ['type script', 'typescript'],
  ['security operations center', 'security operations'],
  ['security operations centre', 'security operations'],
];

function fold(text) {
  let out = String(text ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [from, to] of PHRASE_ALIASES) out = out.split(from).join(to);
  return out;
}

export function scoreJob(profile, job) {
  const p = profile ?? {};
  const j = job ?? {};
  const jobSkills = parseSkills(j.skills);
  const terms = [];

  const skills = skillTerm(p, j, jobSkills);
  terms.push(skills);
  terms.push(titleTerm(p, j));
  terms.push(contractTerm(p, j));
  terms.push(seniorityTerm(p, j));
  terms.push(remoteTerm(p, j));
  terms.push(locationTerm(p, j));
  terms.push(freshnessTerm(j));

  const score = Math.min(100, Math.max(0, terms.reduce((sum, term) => sum + term.points, 0)));
  const reasons = terms
    .filter((term) => term.reason && (term.points > 0 || term.points < term.max))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4)
    .map((term) => term.reason);

  return { score, confidence: confidenceFor(j, jobSkills), reasons };
}

function skillTerm(profile, job, jobSkills) {
  const profileSkills = [...new Set((profile.skills ?? []).map(canonicalSkill).filter(Boolean))];
  const haystack = fold([job.title, job.description, jobSkills.join(' ')].filter(Boolean).join(' \n '));
  const matched = profileSkills.filter((skill) => mentions(haystack, skill));
  // A profile with 40 skills should not be rewarded for matching 2 of them;
  // the denominator is capped at the 8 skills a posting realistically names.
  const denominator = Math.max(1, Math.min(profileSkills.length, 8));
  const points = Math.round(Math.min(1, matched.length / denominator) * 40);
  let reason = '';
  if (profileSkills.length === 0) reason = 'profile lists no skills';
  else if (matched.length === 0) reason = 'no skill overlap';
  else reason = `${matched.length} skill${matched.length === 1 ? '' : 's'} match (${matched.slice(0, 4).join(', ')})`;
  return { points, max: 40, weight: 40, reason };
}

function titleTerm(profile, job) {
  const targets = (profile.titles ?? [])
    .flatMap((title) => titleTokens(title))
    .filter((token) => !SENIORITY_WORDS.has(token));
  const wanted = new Set(targets);
  if (wanted.size === 0) return { points: 0, max: 15, weight: 15, reason: 'no target roles set' };

  const jobTokens = titleTokens(job.title);
  const hits = [...new Set(jobTokens.filter((token) => wanted.has(token) || internshipEquivalence(token, wanted)))];
  if (hits.length === 0) return { points: 0, max: 15, weight: 15, reason: 'title not in target roles' };

  const ratio = hits.length / Math.max(1, jobTokens.length);
  const points = Math.round(Math.min(1, 0.6 + ratio * 0.4) * 15);
  return { points, max: 15, weight: 15, reason: `title matches (${hits.slice(0, 3).join(', ')})` };
}

// "stage" on the profile and "internship" in the posting are the same job.
function internshipEquivalence(token, wanted) {
  if (!INTERNSHIP_WORDS.has(token)) return false;
  return [...wanted].some((word) => INTERNSHIP_WORDS.has(word));
}

function titleTokens(value) {
  return fold(value)
    .split(/[^a-z0-9+#]+/)
    .filter((token) => token.length > 1 || /^[+#]$/.test(token));
}

function contractTerm(profile, job) {
  const pc = normContract(profile.contract);
  const jc = normContract(job.contract);
  if (!pc || !jc || pc === 'any' || jc === 'any') {
    return { points: 5, max: 10, weight: 10, reason: '' };
  }
  if (pc === jc) return { points: 10, max: 10, weight: 10, reason: 'contract matches' };
  if (CONTRACT_NEAR_MISS.has(`${pc}|${jc}`)) {
    return { points: 5, max: 10, weight: 10, reason: `contract close (${profile.contract} vs ${job.contract})` };
  }
  return { points: 0, max: 10, weight: 10, reason: `contract differs (${profile.contract} vs ${job.contract})` };
}

function seniorityTerm(profile, job) {
  const ps = normSeniority(profile.seniority);
  const js = normSeniority(job.seniority);
  if (!ps || !js) return { points: 5, max: 10, weight: 10, reason: '' };
  if (ps === js) return { points: 10, max: 10, weight: 10, reason: 'seniority matches' };
  if (SENIORITY_ADJACENT.has(`${ps}|${js}`)) {
    return { points: 5, max: 10, weight: 10, reason: `seniority adjacent (${profile.seniority} vs ${job.seniority})` };
  }
  return { points: 0, max: 10, weight: 10, reason: `seniority differs (${profile.seniority} vs ${job.seniority})` };
}

function remoteTerm(profile, job) {
  const pr = String(profile.remote ?? '').toLowerCase().trim();
  const jr = String(job.remote ?? '').toLowerCase().trim();
  if (!pr || !jr || pr === 'any' || jr === 'any' || pr === 'no preference') {
    return { points: 3, max: 5, weight: 5, reason: '' };
  }
  if (pr === jr) return { points: 5, max: 5, weight: 5, reason: 'remote matches' };
  // Remote candidates take hybrid roles all the time; that is a soft cost.
  if (pr === 'remote' && jr === 'hybrid') {
    return { points: 3, max: 5, weight: 5, reason: 'hybrid instead of remote' };
  }
  return { points: 0, max: 5, weight: 5, reason: `remote differs (${profile.remote} vs ${job.remote})` };
}

function locationTerm(profile, job) {
  const targets = [
    ...(Array.isArray(profile.targetCountries) ? profile.targetCountries : []),
    profile.country,
  ].map((value) => String(value ?? '').toLowerCase().trim()).filter(Boolean);

  const location = String(job.location ?? '').toLowerCase().trim();
  if (targets.length === 0) return { points: 5, max: 10, weight: 10, reason: '' };
  if (!location) return { points: 5, max: 10, weight: 10, reason: '' };
  if (targets.some((target) => location.includes(target))) {
    return { points: 10, max: 10, weight: 10, reason: `location in ${job.location}` };
  }
  return { points: 0, max: 10, weight: 10, reason: `location outside ${targets.slice(0, 2).join('/')}` };
}

function freshnessTerm(job) {
  const stamp = job.postedAt ?? job.firstSeenAt ?? job.createdAt ?? null;
  const at = stamp ? new Date(stamp).getTime() : NaN;
  if (!Number.isFinite(at)) return { points: 3, max: 10, weight: 10, reason: '' };
  const days = Math.floor((Date.now() - at) / 86_400_000);
  if (days <= 3) return { points: 10, max: 10, weight: 10, reason: 'posted recently' };
  if (days <= 14) return { points: 6, max: 10, weight: 10, reason: `posted ${days}d ago` };
  if (days <= 30) return { points: 3, max: 10, weight: 10, reason: `posted ${days}d ago` };
  return { points: 0, max: 10, weight: 10, reason: `stale posting (${days}d)` };
}

// Thin postings are scored the same way but flagged, so the UI can say so.
function confidenceFor(job, jobSkills) {
  const hasSkills = jobSkills.length > 0;
  const hasDescription = String(job.description ?? '').trim().length >= 200;
  if (!hasSkills && !hasDescription) return 'low';
  if (!hasSkills || !hasDescription) return 'medium';
  return 'high';
}

// Word-boundary-ish containment that survives "c++", "node.js" and "c#".
function mentions(haystack, needle) {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'i').test(haystack);
  } catch {
    return haystack.includes(needle);
  }
}

function parseSkills(skills) {
  if (Array.isArray(skills)) return skills.map(String).filter(Boolean);
  if (typeof skills === 'string') {
    try { const parsed = JSON.parse(skills); if (Array.isArray(parsed)) return parsed.map(String); } catch { /* fallthrough */ }
    return skills.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

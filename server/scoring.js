// Fit scoring between a profile and a job. Pure function, no I/O.
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

export function normContract(v) {
  const s = String(v ?? '').toLowerCase().trim();
  return CONTRACT_ALIASES[s] ?? s;
}

export function normSeniority(v) {
  const s = String(v ?? '').toLowerCase().trim();
  return SENIORITY_ALIASES[s] ?? s;
}

function normSkill(s) {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9+#.]/g, '').trim();
}

export function scoreJob(profile, job) {
  const p = profile ?? {};
  const j = job ?? {};
  const reasons = [];
  let score = 0;

  // skill overlap (up to 40)
  const profileSkills = new Set((p.skills ?? []).map(normSkill).filter(Boolean));
  const jobSkills = parseSkills(j.skills).map(normSkill).filter(Boolean);
  const jobSkillSet = new Set(jobSkills);
  const matched = [...profileSkills].filter((s) => jobSkillSet.has(s));
  if (jobSkills.length > 0) {
    const overlap = matched.length / Math.max(1, jobSkillSet.size);
    const pts = Math.round(Math.min(1, overlap * 2) * 40);
    score += pts;
    if (matched.length) reasons.push(`${matched.length}/${jobSkillSet.size} skills match (${matched.slice(0,4).join(', ')})`);
    else reasons.push('no skill overlap');
  } else {
    score += 12;
    reasons.push('job lists no skills — partial credit');
  }

  // title overlap (up to 20): token overlap between target roles and job title
  const titleTokens = new Set(
    (p.titles ?? []).flatMap((t) => String(t).toLowerCase().split(/\s+/)).filter((w) => w.length > 2),
  );
  const jobTitleTokens = String(j.title ?? '').toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const titleHits = jobTitleTokens.filter((w) => titleTokens.has(w));
  if (titleHits.length) {
    score += Math.min(20, 10 + titleHits.length * 5);
    reasons.push(`title matches (${titleHits.join(', ')})`);
  } else {
    reasons.push('title not in target roles');
  }

  // contract (up to 15)
  const pc = normContract(p.contract);
  const jc = normContract(j.contract);
  if (pc && jc) {
    if (pc === jc || pc === 'any' || jc === 'any') {
      score += 15; reasons.push('contract matches');
    } else {
      reasons.push(`contract differs (${p.contract} vs ${j.contract})`);
    }
  } else { score += 8; }

  // seniority (up to 15)
  if (p.seniority && j.seniority) {
    if (normSeniority(p.seniority) === normSeniority(j.seniority)) { score += 15; reasons.push('seniority matches'); }
    else { score += 5; reasons.push(`seniority differs (${p.seniority} vs ${j.seniority})`); }
  } else { score += 8; }

  // remote (up to 10)
  const pr = String(p.remote ?? '').toLowerCase();
  const jr = String(j.remote ?? '').toLowerCase();
  if (pr && jr) {
    if (pr === jr || pr === 'any' || jr === 'any' || pr === 'no preference') { score += 10; reasons.push('remote matches'); }
    else { reasons.push(`remote differs (${p.remote} vs ${j.remote})`); }
  } else { score += 5; }

  return { score: Math.min(100, Math.max(0, score)), reasons };
}

function parseSkills(skills) {
  if (Array.isArray(skills)) return skills.map(String).filter(Boolean);
  if (typeof skills === 'string') {
    try { const parsed = JSON.parse(skills); if (Array.isArray(parsed)) return parsed.map(String); } catch { /* fallthrough */ }
    return skills.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

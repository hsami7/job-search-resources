// Letter generation from profile facts + job facts. Template-based, deterministic.
// Every fact comes from the profile projection or the job; nothing is invented.
// The job description is never quoted: only structured fields may reach the page.

export function buildLetter(profile, job, { tone = 'formal' } = {}) {
  const p = profile ?? {};
  const j = job ?? {};
  const greeting = tone === 'casual' ? 'Hi there,' : 'Dear Hiring Manager,';
  const name = p.name || 'Candidate';
  const skills = (p.skills ?? []).slice(0, 6).join(', ');
  const lastExp = (p.experience ?? [])[0];
  const lastExpLine = lastExp
    ? `Most recently I worked as ${lastExp.title || 'a contributor'}${lastExp.company ? ` at ${lastExp.company}` : ''}.`
    : '';

  const paragraphs = [];
  paragraphs.push(
    tone === 'casual'
      ? `I'm writing about the ${j.title || 'open role'}${j.company ? ` at ${j.company}` : ''}.`
      : `I am writing to apply for the ${j.title || 'open'} position${j.company ? ` at ${j.company}` : ''}.`,
  );
  paragraphs.push(identityLine(p));
  paragraphs.push(roleLine(p));
  if (skills) paragraphs.push(`My core skills include ${skills}.`);
  if (lastExpLine) paragraphs.push(lastExpLine);
  const drawn = drawnLine(p, j);
  if (drawn) paragraphs.push(drawn);
  paragraphs.push(
    tone === 'casual'
      ? "I'd love to chat if there's a fit."
      : 'I would welcome the chance to discuss how my background matches your needs.',
  );

  const body = paragraphs.join('\n\n');
  const signoff = `${name}\n${p.email || ''}\n${p.phone || ''}`.trim();
  return { tone, text: `${greeting}\n\n${body}\n\nBest regards,\n${signoff}` };
}

function identityLine(profile) {
  const name = profile.name || 'Candidate';
  let line = `I am ${name}`;
  if (profile.headline) line += `, ${article(profile.headline)} ${profile.headline}`;
  if (profile.city) line += `, based in ${profile.city}`;
  return `${line}.`;
}

function roleLine(profile) {
  const titles = (profile.titles ?? []).map((t) => String(t).trim()).filter(Boolean).slice(0, 3);
  if (titles.length === 0) return 'I am looking for a role that fits my background.';
  return `I am looking for a role as ${joinList(titles, 'or')}.`;
}

// Only structured fields: matched skills, contract, location, company. The
// description is deliberately ignored so no posting text leaks into a letter.
function drawnLine(profile, job) {
  const matched = matchedSkills(profile.skills, job.skills);
  if (matched.length) {
    return `I was drawn to this role because it calls for ${joinList(matched.slice(0, 4), 'and')}, which is where I focus.`;
  }
  if (job.contract) return `I was drawn to this ${job.contract} role and the chance to contribute from day one.`;
  if (job.location) return `I was drawn to this role and the chance to work in ${job.location}.`;
  if (job.company) return `I was drawn to ${job.company} and the work the team is doing.`;
  return '';
}

function matchedSkills(profileSkills, jobSkills) {
  const wanted = new Set(
    (Array.isArray(profileSkills) ? profileSkills : [])
      .map((s) => String(s).toLowerCase().trim())
      .filter(Boolean),
  );
  const seen = new Set();
  const out = [];
  for (const skill of Array.isArray(jobSkills) ? jobSkills : []) {
    const text = String(skill).trim();
    const key = text.toLowerCase();
    if (!key || !wanted.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function joinList(items, conjunction) {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items[items.length - 1]}`;
}

function article(word) {
  return /^[aeiou]/i.test(String(word).trim()) ? 'an' : 'a';
}

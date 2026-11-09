// Letter generation from profile facts + job facts. Template-based, deterministic.
// Every fact comes from the profile projection or the job; nothing is invented.
// The job description is never quoted: only structured fields may reach the page.
import { LETTER_LANGUAGES } from './profile.js';

export function buildLetter(profile, job, { tone = 'formal', language } = {}) {
  const p = profile ?? {};
  const j = job ?? {};
  const lang = LETTER_LANGUAGES.includes(language) ? language : 'en';
  const casual = tone === 'casual';

  const paragraphs = lang === 'fr'
    ? frenchParagraphs(p, j, casual)
    : englishParagraphs(p, j, casual);

  const name = p.name || (lang === 'fr' ? 'Candidat' : 'Candidate');
  const greeting = lang === 'fr' ? 'Madame, Monsieur,' : casual ? 'Hi there,' : 'Dear Hiring Manager,';
  const signoffLabel = lang === 'fr' ? 'Cordialement,' : 'Best regards,';
  const signoff = [name, p.email || '', p.phone || ''].join('\n').trim();
  const body = paragraphs.filter(Boolean).join('\n\n');
  return { tone: casual ? 'casual' : 'formal', language: lang, text: `${greeting}\n\n${body}\n\n${signoffLabel}\n${signoff}` };
}

function englishParagraphs(p, j, casual) {
  const out = [];
  out.push(casual
    ? `I'm writing about the ${j.title || 'open role'}${j.company ? ` at ${j.company}` : ''}.`
    : `I am writing to apply for the ${j.title || 'open'} position${j.company ? ` at ${j.company}` : ''}.`);
  out.push(identityLine(p));
  out.push(roleLine(p));

  const skills = (p.skills ?? []).slice(0, 6).join(', ');
  if (skills) out.push(`My core skills include ${skills}.`);

  const lastExp = (p.experience ?? [])[0];
  if (lastExp) {
    out.push(`Most recently I worked as ${lastExp.title || 'a contributor'}${lastExp.company ? ` at ${lastExp.company}` : ''}.`);
  }

  out.push(drawnLine(p, j));
  out.push(workAuthorizationLine(p, j, 'en'));
  out.push(availableFromLine(p, 'en'));
  out.push(locationLine(p, j, 'en'));

  out.push(casual ? "I'd love to chat if there's a fit." : 'I would welcome the chance to discuss how my background matches your needs.');
  return out;
}

function frenchParagraphs(p, j, casual) {
  const out = [];
  out.push(casual
    ? `Je vous écris au sujet du poste de ${j.title || 'candidat libre'}${j.company ? ` chez ${j.company}` : ''}.`
    : `Je vous adresse ma candidature pour le poste de ${j.title || 'candidat libre'}${j.company ? ` chez ${j.company}` : ''}.`);

  const name = p.name || 'Candidat';
  let identity = `Je m'appelle ${name}`;
  if (p.headline) identity += `, ${p.headline}`;
  if (p.city) identity += `, basé(e) à ${p.city}`;
  out.push(`${identity}.`);

  const titles = (p.titles ?? []).map((t) => String(t).trim()).filter(Boolean).slice(0, 3);
  out.push(titles.length
    ? `Je recherche un poste de ${joinList(titles, 'ou')}.`
    : 'Je recherche un poste correspondant à mon parcours.');

  const skills = (p.skills ?? []).slice(0, 6).join(', ');
  if (skills) out.push(`Mes compétences principales incluent ${skills}.`);

  const lastExp = (p.experience ?? [])[0];
  if (lastExp) {
    out.push(`Plus récemment, j'ai occupé le poste de ${lastExp.title || 'contributeur'}${lastExp.company ? ` chez ${lastExp.company}` : ''}.`);
  }

  const matched = matchedSkills(p.skills, j.skills);
  if (matched.length) {
    out.push(`Ce poste m'intéresse particulièrement car il demande ${joinList(matched.slice(0, 4), 'et')}, ce qui correspond à mon expertise.`);
  } else if (j.contract) {
    out.push(`Ce poste en ${j.contract} correspond à ce que je recherche.`);
  } else if (j.location) {
    out.push(`Je souhaite contribuer à votre équipe à ${j.location}.`);
  } else if (j.company) {
    out.push(`Je souhaite contribuer au travail de ${j.company}.`);
  }

  out.push(workAuthorizationLine(p, j, 'fr'));
  out.push(availableFromLine(p, 'fr'));
  out.push(locationLine(p, j, 'fr'));

  out.push(casual
    ? "Je serais ravi(e) d'en discuter si le profil vous convient."
    : "Je serais ravi(e) d'échanger avec vous sur ma candidature.");
  return out;
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

// The profile field is free text ("Requires UK sponsorship", "EU citizen"), so
// the sentence is derived from it rather than invented: sponsorship wording
// flips the sentence, everything else reads as authorization.
function workAuthorizationLine(profile, job, lang) {
  const raw = String(profile.workAuthorization ?? '').trim();
  if (!raw) return '';
  const needsSponsorship = /sponsor|visa|permit/i.test(raw)
    && !/no sponsor|not require|without sponsor|no visa|not needed|none needed/i.test(raw);
  const target = jobCountry(job) || String(profile.country ?? '').trim();
  if (lang === 'fr') {
    if (needsSponsorship) {
      return target
        ? `Une autorisation de travail serait nécessaire pour travailler en ${target}.`
        : `Une autorisation de travail serait nécessaire pour ce poste.`;
    }
    return target ? `Je suis autorisé(e) à travailler en ${target}.` : `Autorisation de travail : ${raw}.`;
  }
  if (needsSponsorship) {
    return target
      ? `I would require sponsorship to work in ${target}.`
      : 'I would require sponsorship to work in this role.';
  }
  return target ? `I am authorized to work in ${target}.` : `Work authorization: ${raw}.`;
}

function availableFromLine(profile, lang) {
  const from = String(profile.availableFrom ?? '').trim();
  if (!from) return '';
  return lang === 'fr' ? `Je suis disponible à partir de ${from}.` : `I am available from ${from}.`;
}

// Morocco → UK/Canada: say where you are and that relocating is fine, instead
// of leaving the reader to wonder why the address does not match the posting.
function locationLine(profile, job, lang) {
  const city = String(profile.city ?? '').trim();
  const home = String(profile.country ?? '').trim();
  const jobPlace = String(job.location ?? '').trim();
  const target = jobCountry(job);
  if (!home || !jobPlace || !target) return '';
  if (sameCountry(home, target)) return '';
  const origin = city ? `${city}, ${home}` : home;
  return lang === 'fr'
    ? `Je réside actuellement à ${origin} et je suis prêt(e) à m'installer à ${jobPlace}.`
    : `I am currently based in ${origin} and am happy to relocate to ${jobPlace}.`;
}

function sameCountry(a, b) {
  const left = a.toLowerCase().trim();
  const right = b.toLowerCase().trim();
  return left === right || left.includes(right) || right.includes(left);
}

// A posting may carry a clean country column or only "City, Country".
function jobCountry(job) {
  const explicit = String(job.country ?? '').trim();
  if (explicit) return explicit;
  const location = String(job.location ?? '').trim();
  if (!location) return '';
  const parts = location.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return '';
  return parts[parts.length - 1];
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

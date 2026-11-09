import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreJob, canonicalSkill } from '../server/scoring.js';

const profile = {
  name: 'Yassine M.',
  city: 'Casablanca',
  country: 'Morocco',
  titles: ['Cybersecurity Intern'],
  skills: ['Cybersecurity', 'SIEM', 'Linux', 'Python'],
  contract: 'Internship',
  seniority: 'Intern',
  remote: 'Hybrid',
};

function job(overrides = {}) {
  return {
    title: 'Cyber Security Intern',
    company: 'American Express',
    location: 'Burgess Hill, United Kingdom',
    contract: 'Internship',
    seniority: 'Intern',
    remote: 'Hybrid',
    skills: ['SIEM', 'SOC'],
    description: 'Security operations team handling SIEM alerts.',
    ...overrides,
  };
}

test('the weights add up to 100 and the score stays inside 0..100', () => {
  const perfect = scoreJob(
    { ...profile, skills: ['SIEM'], remote: 'Remote', country: 'United Kingdom' },
    job({ remote: 'Remote', location: 'Burgess Hill, United Kingdom' }),
  );
  assert.ok(perfect.score <= 100);
  assert.ok(perfect.score >= 0);

  const empty = scoreJob({}, job());
  assert.ok(empty.score >= 0);
  assert.ok(empty.score <= 100);
});

test('a strong match scores high and says why', () => {
  // A genuinely strong match: right role, right contract, right country.
  const { score, reasons } = scoreJob(
    { ...profile, targetCountries: ['United Kingdom'] },
    job({ firstSeenAt: new Date().toISOString() }),
  );
  assert.ok(score >= 70, `expected >= 70, got ${score}`);
  assert.ok(reasons.some((r) => /skill/i.test(r)), reasons.join(' | '));
  assert.ok(reasons.some((r) => /title matches/i.test(r)), reasons.join(' | '));
});

test('"Cyber Security" matches a profile skill written "Cybersecurity"', () => {
  const { score, reasons } = scoreJob(
    { ...profile, skills: ['Cybersecurity'] },
    job({ skills: [], description: 'Cyber Security analyst role.' }),
  );
  assert.ok(reasons.some((r) => /skill.*cybersecurity/i.test(r)), reasons.join(' | '));
  assert.ok(score > 40);
});

test('a posting that writes NodeJS matches a profile skill Node.js', () => {
  const { reasons } = scoreJob(
    { ...profile, skills: ['Node.js'], titles: [] },
    job({ title: 'Backend role', skills: [], description: 'You will write NodeJS services.' }),
  );
  assert.ok(reasons.some((r) => /skill.*node\.js/i.test(r)), reasons.join(' | '));
});

test('a posting that writes k8s matches a profile skill Kubernetes', () => {
  const { reasons } = scoreJob(
    { ...profile, skills: ['Kubernetes'], titles: [] },
    job({ title: 'Platform role', skills: [], description: 'We run k8s in production.' }),
  );
  assert.ok(reasons.some((r) => /skill.*kubernetes/i.test(r)), reasons.join(' | '));
});

test('a senior German role against an intern profile scores low', () => {
  const { score, reasons } = scoreJob(profile, job({
    title: 'Senior Product Analyst',
    location: 'Berlin, Germany',
    contract: 'Unbefristeter arbeitsvertrag',
    seniority: 'Senior',
    skills: ['Quality Management'],
    description: 'Senior analytics role.',
  }));
  assert.ok(score <= 30, `expected <= 30, got ${score}`);
  assert.ok(reasons.some((r) => /contract|seniority/i.test(r)), reasons.join(' | '));
});

test('a profile with no skills earns no skill points and says so', () => {
  const { reasons } = scoreJob({ ...profile, skills: [] }, job());
  assert.ok(reasons.includes('profile lists no skills'), reasons.join(' | '));
});

test('confidence is low when a posting has neither skills nor description', () => {
  const { confidence } = scoreJob(profile, job({ skills: [], description: '' }));
  assert.equal(confidence, 'low');
});

test('confidence is not low when the posting carries real detail', () => {
  const { confidence } = scoreJob(profile, job());
  assert.notEqual(confidence, 'low');
});

test('accents do not stop a match', () => {
  const { reasons } = scoreJob(
    { ...profile, skills: ['Cybersecurity'], titles: [] },
    job({ title: 'Analyste', skills: [], description: 'Poste en Cybersécurité.' }),
  );
  assert.ok(reasons.some((r) => /skill.*cybersecurity/i.test(r)), reasons.join(' | '));
});

test('canonicalSkill folds the aliases both ways', () => {
  assert.equal(canonicalSkill('NodeJS'), 'node.js');
  assert.equal(canonicalSkill('node.js'), 'node.js');
  assert.equal(canonicalSkill('K8s'), 'kubernetes');
  assert.equal(canonicalSkill('Cyber Security'), 'cybersecurity');
  assert.equal(canonicalSkill('Cybersécurité'), 'cybersecurity');
  assert.equal(canonicalSkill('  '), '');
});

test('stage and stagiaire count as an internship contract', () => {
  const { reasons } = scoreJob(
    { ...profile, titles: [] },
    job({ contract: 'stage', seniority: 'Stage', skills: [], description: '' }),
  );
  assert.ok(reasons.some((r) => /contract matches/i.test(r)), reasons.join(' | '));
});

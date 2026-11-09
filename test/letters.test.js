import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLetter } from '../server/letters.js';

const profile = {
  name: 'Yassine M.',
  headline: 'Cybersecurity student',
  email: 'y@example.dev',
  phone: '+212 6 00 00 00 00',
  city: 'Casablanca',
  country: 'Morocco',
  titles: ['Cybersecurity Intern'],
  skills: ['Cybersecurity', 'SIEM', 'Linux', 'Python'],
  contract: 'Internship',
  seniority: 'Intern',
  remote: 'Hybrid',
  languages: 'French, English, Arabic',
};

const job = {
  title: 'Cyber Security Intern',
  company: 'American Express',
  location: 'Burgess Hill, United Kingdom',
  contract: 'Internship',
  skills: ['SIEM', 'SOC'],
  description: 'Security operations work.',
};

test('the default letter is English and formal', () => {
  const letter = buildLetter(profile, job);
  assert.equal(letter.language, 'en');
  assert.equal(letter.tone, 'formal');
  assert.match(letter.text, /^Dear Hiring Manager,/);
  assert.match(letter.text, /Best regards,/);
});

test('language fr produces a French greeting and signoff', () => {
  const letter = buildLetter(profile, job, { language: 'fr' });
  assert.equal(letter.language, 'fr');
  assert.match(letter.text, /^Madame, Monsieur,/);
  assert.match(letter.text, /Cordialement,/);
});

test('an unknown language falls back to English', () => {
  assert.equal(buildLetter(profile, job, { language: 'de' }).language, 'en');
});

test('the letter names the role, the company and the candidate', () => {
  const { text } = buildLetter(profile, job);
  assert.ok(text.includes('Cyber Security Intern'));
  assert.ok(text.includes('American Express'));
  assert.ok(text.includes('Yassine M.'));
});

test('the raw job description never reaches the page', () => {
  const marker = 'INTERNAL-MARKER-9f3a';
  const { text } = buildLetter(profile, {
    ...job,
    description: `Secret paragraph ${marker}. Also: we pay 40k.`,
  });
  assert.equal(text.includes(marker), false);
});

test('work authorization produces a sponsorship line', () => {
  const { text } = buildLetter(
    { ...profile, workAuthorization: 'Requires UK sponsorship' },
    job,
  );
  assert.match(text, /sponsorship/i);
});

test('availableFrom produces an availability line', () => {
  const { text } = buildLetter({ ...profile, availableFrom: 'June 2027' }, job);
  assert.match(text, /June 2027/);
});

test('a job in another country produces a relocation line', () => {
  const { text } = buildLetter(profile, job);
  assert.match(text, /relocate/i);
});

test('a same-country job does not claim relocation', () => {
  const { text } = buildLetter(profile, { ...job, location: 'Casablanca, Morocco' });
  assert.equal(/relocate/i.test(text), false);
});

test('missing profile fields never leak undefined or null', () => {
  const { text } = buildLetter({ name: 'Only A Name' }, { title: 'Some Role' });
  assert.equal(/\bundefined\b/.test(text), false);
  assert.equal(/\bnull\b/.test(text), false);
  assert.match(text, /Only A Name/);
});

test('an empty profile still produces a usable letter', () => {
  const { text } = buildLetter({}, {});
  assert.ok(text.length > 40);
  assert.equal(/\bundefined\b/.test(text), false);
});

test('tone casual changes the greeting', () => {
  const { text, tone } = buildLetter(profile, job, { tone: 'casual' });
  assert.equal(tone, 'casual');
  assert.match(text, /^Hi there,/);
});

test('the letter is deterministic', () => {
  assert.equal(buildLetter(profile, job).text, buildLetter(profile, job).text);
});

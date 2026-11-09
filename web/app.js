// Profile page for P1. Loads the projected profile, saves through the event
// log with an explicit version, and never replaces local edits on a conflict.
const $ = (id) => document.getElementById(id);

const TEXT_FIELDS = ['name', 'headline', 'email', 'phone', 'city', 'country', 'links',
  'contract', 'seniority', 'salary', 'remote', 'languages'];

const state = {
  profile: null,
  version: 0,
  updatedAt: null,
  baseline: '',
  dirty: false,
  titles: [],
  skills: [],
  certifications: [],
  experience: [],
  education: [],
  busy: false,
  view: 'profile',
  jobsView: 'new',
  jobsQuery: '',
  jobs: [],
  jobsAll: [],
  letterJob: null,
};

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

async function api(path, options) {
  const response = await fetch(path, options);
  let body = null;
  try {
    body = await response.json();
  } catch { /* empty or non-JSON body */ }
  return { status: response.status, ok: response.ok, body };
}

const readForm = () => ({
  name: $('f-name').value,
  headline: $('f-headline').value,
  email: $('f-email').value,
  phone: $('f-phone').value,
  city: $('f-city').value,
  country: $('f-country').value,
  links: $('f-links').value,
  contract: $('f-contract').value,
  seniority: $('f-seniority').value,
  salary: $('f-salary').value,
  remote: $('f-remote').value,
  languages: $('f-languages').value,
  titles: [...state.titles],
  skills: [...state.skills],
  certifications: [...state.certifications],
  experience: state.experience.map((e) => ({ ...e })),
  education: state.education.map((e) => ({ ...e })),
});

function setSelect(id, value) {
  const select = $(id);
  const wanted = value ?? '';
  if (wanted && ![...select.options].some((option) => option.value === wanted)) {
    select.add(new Option(wanted, wanted));
  }
  select.value = wanted;
}

function setForm(profile) {
  for (const field of TEXT_FIELDS) $(`f-${field}`).value = profile[field] ?? '';
  state.titles = [...(profile.titles ?? [])];
  state.skills = [...(profile.skills ?? [])];
  state.certifications = [...(profile.certifications ?? [])];
  state.experience = (profile.experience ?? []).map((e) => ({ ...e }));
  state.education = (profile.education ?? []).map((e) => ({ ...e }));
  renderChips();
  renderSkills();
  renderCerts();
  renderExperience();
  renderEducation();
  state.baseline = JSON.stringify(readForm());
  setDirty(false);
}

function setDirty(dirty) {
  state.dirty = dirty;
  $('save').disabled = !dirty || state.busy;
  const label = $('save-state');
  if (state.busy) {
    label.textContent = 'saving…';
    label.className = 'muted';
  } else if (dirty) {
    label.textContent = 'unsaved changes';
    label.className = 'muted dirty';
  } else {
    label.textContent = state.updatedAt
      ? `saved · v${state.version} · ${shortTime(state.updatedAt)}`
      : 'not saved yet';
    label.className = 'muted';
  }
}

function touched() {
  setDirty(JSON.stringify(readForm()) !== state.baseline);
}

function shortTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return sameDay ? time : `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

function kb(bytes) {
  const value = Number(bytes) || 0;
  return value < 1024 ? `${value} B` : `${Math.round(value / 1024)} KB`;
}

function flash(message, tone = 'warn') {
  const banner = $('banner');
  banner.className = `banner${tone === 'error' ? ' error' : tone === 'ok' ? ' ok' : ''}`;
  banner.replaceChildren(el('span', {}, message));
  banner.hidden = false;
}

function hideBanner() {
  $('banner').hidden = true;
}

function toast(message) {
  document.querySelectorAll('.toast').forEach((node) => node.remove());
  const node = el('div', { class: 'toast' }, message);
  document.body.append(node);
  setTimeout(() => node.remove(), 1800);
}

function renderChips() {
  const box = $('roles');
  box.replaceChildren();
  if (state.titles.length === 0) {
    box.append(el('span', { class: 'muted small' }, 'no target roles yet'));
  }
  state.titles.forEach((title, index) => {
    const chip = el('span', { class: 'chip acc' }, title);
    const remove = el('button', { type: 'button', 'aria-label': `remove ${title}`, title: 'remove' }, '×');
    remove.addEventListener('click', () => {
      state.titles.splice(index, 1);
      renderChips();
      touched();
    });
    chip.append(remove);
    box.append(chip);
  });
}

function renderSkills() {
  const box = $('skills');
  box.replaceChildren();
  if (state.skills.length === 0) box.append(el('span', { class: 'muted small' }, 'no skills yet'));
  state.skills.forEach((s, index) => {
    const chip = el('span', { class: 'chip' }, s);
    const remove = el('button', { type: 'button', 'aria-label': `remove ${s}` }, '×');
    remove.addEventListener('click', () => { state.skills.splice(index, 1); renderSkills(); touched(); });
    chip.append(remove);
    box.append(chip);
  });
}

function addSkill() {
  const input = $('skill-input');
  const value = input.value.trim();
  if (!value) return;
  if (state.skills.some((s) => s.toLowerCase() === value.toLowerCase())) { input.value = ''; return; }
  state.skills.push(value);
  input.value = '';
  renderSkills();
  touched();
}

function renderCerts() {
  const box = $('certs');
  box.replaceChildren();
  if (state.certifications.length === 0) box.append(el('span', { class: 'muted small' }, 'no certifications yet'));
  state.certifications.forEach((s, index) => {
    const chip = el('span', { class: 'chip' }, s);
    const remove = el('button', { type: 'button', 'aria-label': `remove ${s}` }, '×');
    remove.addEventListener('click', () => { state.certifications.splice(index, 1); renderCerts(); touched(); });
    chip.append(remove);
    box.append(chip);
  });
}

function addCert() {
  const input = $('cert-input');
  const value = input.value.trim();
  if (!value) return;
  state.certifications.push(value);
  input.value = '';
  renderCerts();
  touched();
}

function renderExperience() {
  const box = $('experience-list');
  box.replaceChildren();
  if (state.experience.length === 0) {
    box.append(el('p', { class: 'muted small' }, 'No experience entries yet.'));
    return;
  }
  state.experience.forEach((e, index) => {
    const card = el('div', { class: 'entry' });
    const row = (label, value, key) => {
      const inp = el('input', { type: 'text', value: value ?? '', placeholder: label });
      inp.addEventListener('input', (ev) => { state.experience[index][key] = ev.target.value; touched(); });
      return el('div', { class: 'field' }, el('label', {}, label), inp);
    };
    card.append(
      el('div', { class: 'f2' },
        row('Title', e.title, 'title'),
        row('Company', e.company, 'company'),
        row('Start', e.start, 'start'),
        row('End', e.end, 'end'),
      ),
      el('label', { class: 'checkbox mt6' }, el('input', { type: 'checkbox', checked: e.current ? 'checked' : null }), ' current role'),
    );
    const desc = el('textarea', { rows: '2', placeholder: 'Description' });
    desc.value = e.description ?? '';
    desc.addEventListener('input', (ev) => { state.experience[index].description = ev.target.value; touched(); });
    card.append(desc);
    const remove = el('button', { type: 'button', class: 'btn danger mt6' }, 'remove');
    remove.addEventListener('click', () => { state.experience.splice(index, 1); renderExperience(); touched(); });
    card.append(remove);
    box.append(card);
  });
  // wire checkboxes
  box.querySelectorAll('input[type="checkbox"]').forEach((cb, i) => {
    cb.addEventListener('change', (ev) => {
      state.experience[i].current = ev.target.checked;
      if (ev.target.checked) state.experience[i].end = '';
      renderExperience();
      touched();
    });
  });
}

function renderEducation() {
  const box = $('education-list');
  box.replaceChildren();
  if (state.education.length === 0) {
    box.append(el('p', { class: 'muted small' }, 'No education entries yet.'));
    return;
  }
  state.education.forEach((e, index) => {
    const card = el('div', { class: 'entry' });
    const row = (label, value, key) => {
      const inp = el('input', { type: 'text', value: value ?? '', placeholder: label });
      inp.addEventListener('input', (ev) => { state.education[index][key] = ev.target.value; touched(); });
      return el('div', { class: 'field' }, el('label', {}, label), inp);
    };
    card.append(el('div', { class: 'f2' },
      row('Degree', e.degree, 'degree'),
      row('School', e.school, 'school'),
      row('Year', e.year, 'year'),
    ));
    const remove = el('button', { type: 'button', class: 'btn danger mt6' }, 'remove');
    remove.addEventListener('click', () => { state.education.splice(index, 1); renderEducation(); touched(); });
    card.append(remove);
    box.append(card);
  });
}

function addRole() {
  const input = $('role-input');
  const value = input.value.trim();
  if (!value) return;
  if (value.length > 60) {
    showFieldErrors({ titles: 'each role is at most 60 characters' });
    return;
  }
  if (state.titles.some((title) => title.toLowerCase() === value.toLowerCase())) {
    input.value = '';
    return;
  }
  state.titles.push(value);
  input.value = '';
  clearFieldError('titles');
  renderChips();
  touched();
}

function showFieldErrors(fields) {
  document.querySelectorAll('.err').forEach((node) => { node.textContent = ''; });
  document.querySelectorAll('[aria-invalid]').forEach((node) => node.removeAttribute('aria-invalid'));
  let first = null;
  for (const [key, message] of Object.entries(fields)) {
    const hint = document.querySelector(`.err[data-err="${key}"]`);
    if (hint) hint.textContent = message;
    const input = key === 'titles' ? $('role-input') : $(`f-${key}`);
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      if (!first) first = input;
    }
  }
  if (first) first.focus();
}

function clearErrors() {
  document.querySelectorAll('.err').forEach((node) => { node.textContent = ''; });
  document.querySelectorAll('[aria-invalid]').forEach((node) => node.removeAttribute('aria-invalid'));
}

function clearFieldError(key) {
  const hint = document.querySelector(`.err[data-err="${key}"]`);
  if (hint) hint.textContent = '';
  const input = key === 'titles' ? $('role-input') : $(`f-${key}`);
  if (input) input.removeAttribute('aria-invalid');
}

// Cheap checks that mirror the server rules, used only to clear a stale error
// while the user types. The server remains the authority.
function fieldLooksValid(key, value) {
  if (key === 'name') return value.trim().length >= 2;
  if (key === 'email') {
    const text = value.trim();
    return text === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text);
  }
  return true;
}

function applyServer(payload) {
  state.profile = payload.profile;
  state.version = payload.version;
  state.updatedAt = payload.updatedAt;
  setForm(payload.profile);
  renderResume();
  renderFacts();
}

async function save() {
  if (state.busy) return;
  state.busy = true;
  hideBanner();
  setDirty(state.dirty);
  try {
    const result = await api('/api/profile', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile: readForm(), version: state.version }),
    });
    if (result.status === 200) {
      state.profile = result.body.profile;
      state.version = result.body.version;
      state.updatedAt = result.body.updatedAt;
      state.baseline = JSON.stringify(readForm());
      state.dirty = false;
      clearErrors();
      toast(`saved · v${state.version}`);
      renderFacts();
      renderResume();
      await Promise.all([loadEvents(), loadHealth()]);
    } else if (result.status === 409) {
      showConflict(result.body.current);
    } else if (result.status === 422) {
      const fields = result.body?.fields ?? {};
      showFieldErrors(fields);
      flash(`Nothing was saved: ${Object.keys(fields).join(', ') || 'validation failed'}.`, 'error');
    } else {
      flash(`Save failed (${result.status}). Your edits are still here.`, 'error');
    }
  } catch {
    flash('Could not reach the server. Your edits are still here.', 'error');
  } finally {
    state.busy = false;
    setDirty(state.dirty);
  }
}

function showConflict(current) {
  const banner = $('banner');
  banner.className = 'banner';
  banner.hidden = false;
  const load = el('button', { class: 'btn', type: 'button' }, `Load v${current.version}`);
  load.addEventListener('click', async () => {
    if (state.dirty && !confirm('Loading the saved version discards your unsaved edits. Continue?')) return;
    applyServer(current);
    hideBanner();
    await loadEvents();
  });
  const keep = el('button', { class: 'btn', type: 'button' }, 'Keep editing');
  keep.addEventListener('click', hideBanner);
  const overwrite = el('button', { class: 'btn danger', type: 'button' }, 'Overwrite with mine');
  overwrite.addEventListener('click', () => {
    if (!confirm(`Replace version ${current.version} with your unsaved edits? Their version stays in the event log.`)) return;
    state.version = current.version;
    hideBanner();
    save();
  });
  banner.replaceChildren(
    el('span', {}, el('b', {}, `Version ${current.version} is newer. `),
      'Another tab or host saved first, so nothing was overwritten.'),
    el('span', { class: 'spacer' }),
    load,
    overwrite,
    keep,
  );
}

function renderResume() {
  const box = $('resume-current');
  const resume = state.profile?.resume;
  box.replaceChildren();
  if (!resume) {
    box.className = 'resume muted';
    box.textContent = 'No resume stored yet.';
    return;
  }
  box.className = 'resume';
  box.append(
    el('b', {}, resume.filename),
    el('div', { class: 'meta' },
      `${kb(resume.bytes)} · stored ${shortTime(resume.storedAt)} · sha256 ${resume.sha256.slice(0, 12)}…`),
  );
}

function renderFacts() {
  const body = $('facts');
  body.replaceChildren();
  const profile = state.profile ?? {};
  const rows = [
    ['name', profile.name],
    ['email', profile.email],
    ['phone', profile.phone],
    ['city', `${profile.city ?? ''}${profile.city && profile.country ? ', ' : ''}${profile.country ?? ''}`],
    ['headline', profile.headline],
    ['target roles', (profile.titles ?? []).join(' · ')],
    ['languages', profile.languages],
  ];
  for (const [label, value] of rows) {
    body.append(el('tr', {},
      el('td', { class: 'muted' }, label),
      el('td', {}, value || '—'),
    ));
  }
}

function renderEvents(events, chain) {
  const body = $('events');
  body.replaceChildren();
  if (!events.length) {
    body.append(el('tr', {}, el('td', { colspan: '4', class: 'muted' }, 'no events yet')));
  }
  for (const event of events.slice(0, 12)) {
    const changed = event.payload.changed ?? [];
    const detail = event.type === 'profile.resume.stored'
      ? `${event.payload.resume?.filename ?? 'resume'} · ${kb(event.payload.resume?.bytes ?? 0)}`
      : changed.length
        ? `${changed.slice(0, 5).join(', ')}${changed.length > 5 ? ` +${changed.length - 5}` : ''}`
        : 'no field changes';
    body.append(el('tr', {},
      el('td', { class: 'muted' }, shortTime(event.created_at)),
      el('td', {}, el('code', {}, event.type.replace('profile.', ''))),
      el('td', {}, detail),
      el('td', { class: 'col-hash' }, el('code', { title: event.hash }, `${event.hash.slice(0, 10)}…`)),
    ));
  }
  const chip = $('chain');
  chip.textContent = chain?.ok ? `chain ok · ${chain.count}` : `chain broken @${chain?.brokenAt ?? '?'}`;
  chip.className = `chip ${chain?.ok ? 'ok' : 'bad'}`;
}

function renderResumeHistory(events) {
  const body = $('resume-history');
  body.replaceChildren();
  const uploads = events.filter((event) => event.type === 'profile.resume.stored');
  if (!uploads.length) {
    body.append(el('tr', {}, el('td', { colspan: '4', class: 'muted' }, 'no uploads yet')));
    return;
  }
  const currentSha = state.profile?.resume?.sha256;
  for (const event of uploads.slice(0, 6)) {
    const resume = event.payload.resume ?? {};
    const actions = el('td', {},
      el('a', { href: `/api/profile/resume/${resume.sha256}`, target: '_blank', rel: 'noopener' }, 'open'),
    );
    if (resume.sha256 === currentSha) actions.append(' ', el('span', { class: 'chip ok' }, 'in use'));
    body.append(el('tr', {},
      el('td', { class: 'muted' }, shortTime(event.created_at)),
      el('td', {}, resume.filename ?? '—'),
      el('td', { class: 'col-hash' }, el('code', { title: resume.sha256 ?? '' }, `${String(resume.sha256 ?? '').slice(0, 10)}…`)),
      actions,
    ));
  }
}

async function loadEvents() {
  const result = await api('/api/profile/events?limit=50');
  if (result.status !== 200) return;
  renderEvents(result.body.events, result.body.chain);
  renderResumeHistory(result.body.events);
}

async function loadHealth() {
  const result = await api('/api/health');
  if (result.status !== 200 && result.status !== 503) return;
  const health = result.body;
  const ok = Boolean(health.ok);
  $('db-pill').textContent = `db ${ok ? 'ok' : 'check'} · ${health.events.count} events`;
  $('db-dot').className = ok ? 'g' : 'g r';
  $('host-pill').textContent = health.host;
  $('host-dot').className = 'g';
  const chip = $('chain');
  chip.textContent = health.events.chain === 'ok'
    ? `chain ok · ${health.events.count}`
    : `chain broken @${health.events.brokenAt}`;
  chip.className = `chip ${health.events.chain === 'ok' ? 'ok' : 'bad'}`;
}

async function uploadResume(file) {
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    flash('That file is larger than 8 MB.', 'error');
    return;
  }
  const drop = $('drop');
  drop.classList.add('busy');
  $('drop-text').textContent = `uploading ${file.name}…`;
  hideBanner();
  try {
    const response = await fetch('/api/profile/resume', {
      method: 'POST',
      headers: {
        'x-filename': encodeURIComponent(file.name),
        'content-type': file.type || 'application/octet-stream',
      },
      body: file,
    });
    const body = await response.json().catch(() => null);
    if (response.ok) {
      state.profile = body.profile;
      state.version = body.version;
      state.updatedAt = body.updatedAt;
      renderResume();
      renderFacts();
      toast(`stored · ${body.resume.filename}`);
      await Promise.all([loadEvents(), loadHealth()]);
    } else {
      flash(body?.message ?? body?.error ?? `Upload failed (${response.status}).`, 'error');
    }
  } catch {
    flash('Could not reach the server. The file was not stored.', 'error');
  } finally {
    drop.classList.remove('busy');
    $('drop-text').textContent = 'Choose a PDF or DOCX · up to 8 MB';
    setDirty(state.dirty);
  }
}

$('form').addEventListener('submit', (event) => {
  event.preventDefault();
  save();
});

for (const field of TEXT_FIELDS) {
  const input = $(`f-${field}`);
  input.addEventListener('input', () => {
    if (fieldLooksValid(field, input.value)) clearFieldError(field);
    touched();
  });
  input.addEventListener('change', touched);
}

$('role-input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    addRole();
  }
});

$('skill-input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') { event.preventDefault(); addSkill(); }
});
$('cert-input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') { event.preventDefault(); addCert(); }
});
$('add-experience').addEventListener('click', () => {
  state.experience.push({ title: '', company: '', start: '', end: '', current: false, description: '' });
  renderExperience();
  touched();
});
$('add-education').addEventListener('click', () => {
  state.education.push({ degree: '', school: '', year: '' });
  renderEducation();
  touched();
});

// view toggle
document.querySelectorAll('[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.view = btn.dataset.view;
    document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('is-active', b === btn));
    document.querySelectorAll('[data-view]').forEach((b) => {
      if (b === btn) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    const profileForm = $('form');
    const doctorView = $('doctor-view');
    const jobsView = $('jobs-view');
    const settingsView = $('settings-view');
    profileForm.hidden = state.view !== 'profile';
    doctorView.hidden = state.view !== 'doctor';
    jobsView.hidden = state.view !== 'jobs';
    settingsView.hidden = state.view !== 'settings';
    if (state.view === 'doctor') loadDoctor();
    if (state.view === 'jobs') loadJobs();
    if (state.view === 'settings') pollLogin();
  });
});

$('revert').addEventListener('click', async () => {
  if (state.dirty && !confirm('Discard unsaved edits and reload the saved profile?')) return;
  const result = await api('/api/profile');
  if (result.status === 200) {
    applyServer(result.body);
    clearErrors();
    hideBanner();
    toast('reloaded the saved profile');
  }
});

$('export').addEventListener('click', () => {
  const payload = { ...readForm(), resume: state.profile?.resume ?? null };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const link = el('a', { href: URL.createObjectURL(blob), download: 'jobpilot-profile.json' });
  link.click();
  URL.revokeObjectURL(link.href);
});

$('resume-file').addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  event.target.value = '';
  uploadResume(file);
});

window.addEventListener('beforeunload', (event) => {
  if (!state.dirty) return;
  event.preventDefault();
  event.returnValue = '';
});

function slug(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function countStates(jobs) {
  const counts = { new: 0, saved: 0, applied: 0, all: jobs.length };
  for (const { job } of jobs) {
    const value = job.state ?? 'new';
    if (value === 'new' || value === 'saved' || value === 'applied') counts[value] += 1;
  }
  return counts;
}

function renderJobCounts(counts) {
  for (const key of ['new', 'saved', 'applied', 'all']) {
    const node = $(`count-${key}`);
    if (node) node.textContent = String(counts[key] ?? 0);
  }
}

function setJobsMsg(message, tone = 'muted') {
  const node = $('jobs-msg');
  node.textContent = message;
  node.className = tone === 'error' ? 'err small' : 'muted small';
}

function renderLetterTarget() {
  const node = $('letter-job');
  const job = state.letterJob;
  if (!job || (!job.title && !job.company)) {
    node.textContent = 'No letter drafted yet.';
    return;
  }
  node.textContent = `Letter for ${job.title || 'untitled role'} · ${job.company || 'unknown company'}`;
}

function updateJobsCount(shown, total) {
  const chip = $('jobs-count');
  if (total === 0) { chip.textContent = '0 jobs'; return; }
  const noun = total === 1 ? 'job' : 'jobs';
  chip.textContent = shown === total ? `${total} ${noun}` : `${shown} of ${total} jobs`;
}

async function loadJobs() {
  const [listResult, allResult] = await Promise.all([
    api(`/api/jobs?state=${encodeURIComponent(state.jobsView)}`),
    api('/api/jobs?state=all'),
  ]);
  if (listResult.status !== 200) {
    $('jobs-count').textContent = 'unavailable';
    setJobsMsg('Could not load jobs.', 'error');
    return;
  }
  state.jobs = listResult.body.jobs ?? [];
  if (state.jobsView !== 'all') {
    // The server filters by state; this guard keeps a segmented view honest
    // while a backend that predates the filter is still answering.
    state.jobs = state.jobs.filter(({ job }) => (job.state ?? 'new') === state.jobsView);
  }
  state.jobsAll = allResult.status === 200 ? (allResult.body.jobs ?? []) : state.jobs;
  renderJobCounts(countStates(state.jobsAll));
  renderJobs();
}

async function refreshJobCounts() {
  const result = await api('/api/jobs?state=all');
  if (result.status !== 200) return;
  state.jobsAll = result.body.jobs ?? [];
  renderJobCounts(countStates(state.jobsAll));
}

function renderJobs() {
  const box = $('jobs-list');
  box.replaceChildren();
  if (state.jobs.length === 0) {
    box.append(el('p', { class: 'muted small' }, state.jobsView === 'all'
      ? 'No jobs yet. Ingest or paste one.'
      : `No ${state.jobsView} jobs.`));
    updateJobsCount(0, 0);
    return;
  }
  for (const entry of state.jobs) box.append(jobCard(entry));
  applyJobFilter();
}

// Filtering runs on the card's search text (title, company, location, description),
// never on rendered text, so a score like "45/100" cannot hide every card.
function applyJobFilter() {
  const query = state.jobsQuery.trim().toLowerCase();
  const cards = [...document.querySelectorAll('#jobs-list .job-card')];
  let shown = 0;
  let total = 0;
  for (const card of cards) {
    if (card.dataset.dismissed === '1') { card.hidden = true; continue; }
    total += 1;
    const match = !query || (card.dataset.search ?? '').includes(query);
    card.hidden = !match;
    if (match) shown += 1;
  }
  updateJobsCount(shown, total);
  const empty = $('jobs-empty');
  if (total > 0 && shown === 0) {
    if (empty) {
      empty.querySelector('p').textContent = `No jobs match “${state.jobsQuery.trim()}”.`;
      empty.hidden = false;
    } else {
      const node = el('div', { class: 'entry', id: 'jobs-empty' },
        el('p', { class: 'muted small' }, `No jobs match “${state.jobsQuery.trim()}”.`));
      const clear = el('button', { type: 'button', class: 'btn mt6' }, 'Clear filter');
      clear.addEventListener('click', () => {
        state.jobsQuery = '';
        $('job-search').value = '';
        applyJobFilter();
        $('job-search').focus();
      });
      node.append(clear);
      $('jobs-list').append(node);
    }
  } else if (empty) {
    empty.hidden = true;
  }
}

function showJobError(card, message) {
  let node = card.querySelector('.job-err');
  if (!node) {
    node = el('div', { class: 'job-err', role: 'status' });
    card.append(node);
  }
  node.textContent = message;
}

function clearJobError(card) {
  const node = card.querySelector('.job-err');
  if (node) node.textContent = '';
}

function reflectJobState(card, job, controls) {
  const value = job.state ?? 'new';
  const saved = value === 'saved';
  controls.save.textContent = saved ? 'Saved' : 'Save';
  controls.save.setAttribute('aria-pressed', saved ? 'true' : 'false');
  if (value === 'new') {
    controls.chip.hidden = true;
    controls.chip.textContent = '';
    controls.chip.className = 'chip';
  } else {
    controls.chip.hidden = false;
    controls.chip.textContent = value;
    const tone = value === 'dismissed' || value === 'archived' ? 'bad' : value === 'applied' ? 'ok' : 'acc';
    controls.chip.className = `chip ${tone}`;
  }
  card.classList.toggle('is-dismissed', value === 'dismissed');
}

async function setJobState(job, next, card, controls) {
  const previous = job.state ?? 'new';
  const previousAt = job.stateAt ?? null;
  job.state = next;
  job.stateAt = new Date().toISOString();
  reflectJobState(card, job, controls);
  if (next === 'dismissed' && state.jobsView === 'new') card.dataset.dismissed = '1';
  applyJobFilter();
  clearJobError(card);
  controls.save.disabled = true;
  if (controls.dismiss) controls.dismiss.disabled = true;
  try {
    const result = await api(`/api/jobs/${encodeURIComponent(job.id)}/state`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state: next }),
    });
    if (result.status !== 200) throw new Error(String(result.status));
    if (result.body?.job) Object.assign(job, result.body.job);
    reflectJobState(card, job, controls);
    applyJobFilter();
    refreshJobCounts();
  } catch {
    job.state = previous;
    job.stateAt = previousAt;
    delete card.dataset.dismissed;
    reflectJobState(card, job, controls);
    applyJobFilter();
    showJobError(card, 'Could not update this job. Nothing changed.');
  } finally {
    controls.save.disabled = false;
    if (controls.dismiss) controls.dismiss.disabled = false;
  }
}

function jobCard({ job, score, reasons }) {
  const card = el('div', { class: 'entry job-card' });
  card.dataset.jobId = job.id;
  card.dataset.search = [job.title, job.company, job.location, job.description]
    .filter(Boolean).join(' ').toLowerCase();

  const stateChip = el('span', { class: 'chip', hidden: '' });
  card.append(el('div', { class: 'job-head' },
    el('b', {}, job.title ?? 'Untitled role'),
    el('span', { class: 'muted' }, ` · ${job.company ?? '—'} · ${job.location ?? '—'}`),
    ' ',
    stateChip,
  ));
  const reasonList = Array.isArray(reasons) ? reasons.join('; ') : '';
  card.append(el('div', { class: 'muted small' }, `score ${score}/100 — ${reasonList || 'no reasons'}`));
  if (job.url && !job.url.startsWith('manual://')) {
    card.append(el('div', { class: 'muted small' }, el('a', { href: job.url, target: '_blank', rel: 'noopener' }, 'open posting')));
  }

  const actions = el('div', { class: 'job-actions' });
  const draft = el('button', { type: 'button', class: 'btn' }, 'Draft letter');
  const save = el('button', { type: 'button', class: 'btn', 'aria-pressed': 'false' }, 'Save');
  const controls = { save, chip: stateChip, dismiss: null };

  draft.addEventListener('click', async () => {
    draft.disabled = true;
    clearJobError(card);
    try {
      const res = await fetch('/api/letters', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, tone: 'formal' }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        showJobError(card, `Could not draft a letter (${res.status}).`);
        return;
      }
      const text = body?.letter?.text ?? '';
      $('letter-output').value = text;
      state.letterJob = { title: job.title ?? '', company: job.company ?? '', contactEmail: job.contactEmail ?? '' };
      renderLetterTarget();
      const profile = await api('/api/profile');
      const name = profile.body?.profile?.name ?? '';
      const subject = encodeURIComponent(`Application: ${job.title ?? ''} — ${name}`);
      // Recipient is the posting's contact, never the applicant's own address.
      const recipient = job.contactEmail ? encodeURIComponent(job.contactEmail) : '';
      $('mailto-link').href = `mailto:${recipient}?subject=${subject}&body=${encodeURIComponent(text)}`;
    } catch {
      showJobError(card, 'Could not reach the server.');
    } finally {
      draft.disabled = false;
    }
  });

  save.addEventListener('click', () => {
    const next = (job.state ?? 'new') === 'saved' ? 'new' : 'saved';
    setJobState(job, next, card, controls);
  });

  actions.append(draft, save);

  if (state.jobsView === 'new') {
    const dismiss = el('button', { type: 'button', class: 'btn' }, 'Dismiss');
    dismiss.addEventListener('click', () => setJobState(job, 'dismissed', card, controls));
    controls.dismiss = dismiss;
    actions.append(dismiss);
  }

  const remove = el('button', { type: 'button', class: 'btn danger' }, 'remove');
  remove.addEventListener('click', async () => {
    if (!confirm(`Remove "${job.title ?? 'this job'}" from the list?`)) return;
    clearJobError(card);
    const result = await api(`/api/jobs/${encodeURIComponent(job.id)}`, { method: 'DELETE' });
    if (result.status === 204) {
      state.jobs = state.jobs.filter((entry) => entry.job.id !== job.id);
      card.remove();
      applyJobFilter();
      refreshJobCounts();
      return;
    }
    if (result.status === 409) {
      const count = result.body?.submissionIds?.length ?? 0;
      showJobError(card, `This job has ${count} submission${count === 1 ? '' : 's'}; it was not removed.`);
      return;
    }
    showJobError(card, `Could not remove this job (${result.status}).`);
  });
  actions.append(remove);

  card.append(actions);
  reflectJobState(card, job, controls);
  return card;
}

document.querySelectorAll('[data-state-filter]').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.jobsView = btn.dataset.stateFilter;
    document.querySelectorAll('[data-state-filter]').forEach((other) => {
      const active = other === btn;
      other.classList.toggle('is-active', active);
      other.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    loadJobs();
  });
});

$('job-search').addEventListener('input', () => {
  state.jobsQuery = $('job-search').value;
  applyJobFilter();
});

async function ingest(source, button, label) {
  button.disabled = true;
  button.textContent = 'ingesting…';
  setJobsMsg('');
  try {
    const result = await api('/api/jobs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'ingest', source, limit: 20 }),
    });
    if (result.status !== 200) {
      setJobsMsg(`Ingest failed (${result.status}).`, 'error');
      return;
    }
    const ingested = result.body?.ingested ?? 0;
    const added = result.body?.new ?? result.body?.inserted ?? result.body?.created;
    setJobsMsg(added === undefined
      ? `Ingested ${ingested} jobs`
      : `Ingested ${ingested} jobs (${added} new)`);
    await loadJobs();
  } catch {
    setJobsMsg('Ingest failed: could not reach the server.', 'error');
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

$('ingest-arbeitnow').addEventListener('click', () => {
  ingest('arbeitnow', $('ingest-arbeitnow'), 'Ingest Arbeitnow (20)');
});

$('ingest-remotive').addEventListener('click', () => {
  ingest('remotive', $('ingest-remotive'), 'Ingest Remotive (20)');
});

$('add-job-manual').addEventListener('click', () => {
  const form = $('job-form');
  form.hidden = !form.hidden;
  $('job-form-msg').textContent = '';
  if (!form.hidden) $('jf-title').focus();
});

$('job-form-cancel').addEventListener('click', () => {
  $('job-form').hidden = true;
  $('job-form-msg').textContent = '';
});

$('jf-title').addEventListener('input', () => {
  $('jf-title').removeAttribute('aria-invalid');
  $('job-form-msg').textContent = '';
});

$('job-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const msg = $('job-form-msg');
  msg.textContent = '';
  const title = $('jf-title').value.trim();
  if (!title) {
    msg.textContent = 'Title is required.';
    $('jf-title').setAttribute('aria-invalid', 'true');
    $('jf-title').focus();
    return;
  }
  $('jf-title').removeAttribute('aria-invalid');
  const job = {
    title,
    company: $('jf-company').value.trim(),
    location: $('jf-location').value.trim(),
    url: $('jf-url').value.trim(),
    contract: $('jf-contract').value.trim(),
    skills: $('jf-skills').value.split(',').map((s) => s.trim()).filter(Boolean),
    description: $('jf-description').value.trim(),
  };
  const button = $('job-form-save');
  button.disabled = true;
  try {
    const result = await api('/api/jobs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ job }),
    });
    if (result.status !== 200) {
      msg.textContent = `Could not save the job (${result.body?.error ?? result.status}).`;
      return;
    }
    $('job-form').reset();
    $('job-form').hidden = true;
    setJobsMsg('Job added');
    toast('job added');
    await loadJobs();
  } catch {
    msg.textContent = 'Could not reach the server.';
  } finally {
    button.disabled = false;
  }
});

$('letter-copy').addEventListener('click', async () => {
  const text = $('letter-output').value;
  const button = $('letter-copy');
  if (!text.trim()) return;
  let copied = false;
  try {
    await navigator.clipboard.writeText(text);
    copied = true;
  } catch {
    // Clipboard API needs a secure context; fall back to the selection copy.
    const area = $('letter-output');
    area.select();
    copied = document.execCommand('copy');
  }
  button.textContent = copied ? 'Copied' : 'Copy failed';
  setTimeout(() => { button.textContent = 'Copy'; }, 1500);
});

$('letter-download').addEventListener('click', () => {
  const text = $('letter-output').value;
  if (!text.trim()) return;
  const job = state.letterJob ?? {};
  const filename = `${slug(job.company) || 'company'}-${slug(job.title) || 'letter'}.txt`;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = el('a', { href: url, download: filename });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
});

let loginTimer = null;
async function pollLogin() {
  clearInterval(loginTimer);
  const tick = async () => {
    const res = await api('/api/login/status');
    if (res.status === 200) $('login-status').textContent = res.body.status;
  };
  await tick();
  loginTimer = setInterval(tick, 2000);
}

$('start-login').addEventListener('click', async () => {
  const loginUrl = $('login-url').value.trim();
  const successUrl = $('success-url').value.trim();
  if (!loginUrl || !successUrl) { alert('Fill both URLs.'); return; }
  const res = await fetch('/api/login/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ loginUrl, successUrl }) });
  const body = await res.json().catch(() => ({}));
  $('login-status').textContent = body.status ?? (res.ok ? 'launching' : 'error');
  pollLogin();
});

$('cancel-login').addEventListener('click', async () => {
  await fetch('/api/login/cancel', { method: 'POST' });
  $('login-status').textContent = 'cancelled';
});

async function loadDoctor() {
  const result = await api('/api/doctor');
  if (result.status !== 200) return;
  const data = result.body;
  const score = $('doctor-score');
  score.textContent = `score ${data.score}/100`;
  score.className = `chip ${data.score >= 80 ? 'ok' : data.score >= 50 ? '' : 'bad'}`;
  const list = $('doctor-issues');
  list.replaceChildren();
  if (data.issues.length === 0) {
    list.append(el('li', { class: 'ok' }, 'All checks pass.'));
    return;
  }
  for (const issue of data.issues) {
    const li = el('li', { class: issue.level });
    li.append(el('b', {}, issue.field), document.createTextNode(` — ${issue.message}`));
    list.append(li);
  }
}

async function boot() {
  try {
    const [profile, health] = await Promise.all([api('/api/profile'), api('/api/health')]);
    if (profile.status !== 200) {
      flash(`Could not load the profile (${profile.status}). Is the server running?`, 'error');
      $('save-state').textContent = 'offline';
      return;
    }
    applyServer(profile.body);
    $('db-pill').textContent = health.body ? `db ok · ${health.body.events.count} events` : 'db ?';
    $('host-pill').textContent = health.body?.host ?? 'host ?';
    await loadEvents();
    await loadHealth();
  } catch {
    flash('Could not reach the server. Start it with npm start, then reload this page.', 'error');
    $('save-state').textContent = 'offline';
  }
}

boot();

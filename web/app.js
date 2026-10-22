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
  busy: false,
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
  renderChips();
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

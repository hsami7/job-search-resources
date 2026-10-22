// Minimal shell for the mockups: each direction supplies render(screenId) -> HTML.
// Links with data-go switch screens; anything else shows a mockup notice, so the
// clickable demos never pretend to perform real actions.
(() => {
  const V = window.VARIANT;
  const ids = Object.keys(V.screens);

  const toast = (msg) => {
    document.querySelectorAll('.mock-toast').forEach((n) => n.remove());
    const el = document.createElement('div');
    el.className = 'mock-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  };

  const draw = () => {
    const id = ids.includes(location.hash.slice(1)) ? location.hash.slice(1) : ids[0];
    document.body.innerHTML = V.render(id);
    document.querySelectorAll('[data-go]').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.go === id);
      el.setAttribute('aria-current', el.dataset.go === id ? 'page' : 'false');
      el.addEventListener('click', () => { location.hash = el.dataset.go; });
    });
    document.querySelectorAll('[data-act]').forEach((el) => {
      el.addEventListener('click', () => toast(`mockup · “${el.dataset.act}” is not wired in P0`));
    });
    document.title = `${V.name} · ${id} · jobPilot P0`;
    window.scrollTo(0, 0);
  };

  window.addEventListener('hashchange', draw);
  draw();
})();

/* Theme management: light / dark / system. Persists choice in localStorage. */
(function () {
  const STORAGE_KEY = 'hrm-theme';

  function resolve(theme) {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function apply(theme) {
    const dark = resolve(theme);
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem(STORAGE_KEY, theme);
  }

  function current() {
    return localStorage.getItem(STORAGE_KEY) || 'system';
  }

  // Quick toggle cycles light -> dark -> system
  function quickToggle() {
    const order = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(current()) + 1) % order.length];
    apply(next);
    return next;
  }

  // Follow OS changes when in system mode
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (current() === 'system') apply('system');
  });

  // Init
  apply(current());

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('theme-quick-toggle');
    if (btn) btn.addEventListener('click', () => quickToggle());
  });

  window.HRMTheme = { apply, current, quickToggle };
})();

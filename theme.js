(() => {
  const button = document.querySelector('[data-theme-toggle]');
  if (!button) return;
  const icon = button.querySelector('.theme-toggle-icon');
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');

  const sunSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2.75v2.5M12 18.75v2.5M21.25 12h-2.5M5.25 12h-2.5M18.54 5.46l-1.77 1.77M7.23 16.77l-1.77 1.77M18.54 18.54l-1.77-1.77M7.23 7.23L5.46 5.46"></path></svg>';
  const moonSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 14.4A8.6 8.6 0 0 1 9.6 3.8a8.9 8.9 0 1 0 10.6 10.6Z"></path></svg>';

  const isDark = () => {
    const chosen = document.documentElement.dataset.theme;
    return chosen === 'dark' || (!chosen && systemTheme.matches);
  };

  const updateControl = () => {
    const dark = isDark();
    const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    if (icon) icon.innerHTML = dark ? sunSvg : moonSvg;
  };

  button.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('renhao-li-theme', next); } catch (_) {}
    updateControl();
  });

  if (systemTheme.addEventListener) systemTheme.addEventListener('change', updateControl);
  updateControl();
})();

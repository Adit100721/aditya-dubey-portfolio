/* Shared portfolio theme and interactions. */
(() => {
  const root = document.documentElement;
  const themeToggle = document.querySelector('[data-theme-toggle]');
  const themeLabel = document.querySelector('[data-theme-label]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  function applyTheme(theme, persist = true) {
    const dark = theme === 'dark';
    root.dataset.theme = dark ? 'dark' : 'light';
    themeToggle.setAttribute('aria-label', dark ? 'Go light: switch to blue and white theme' : 'Go dark: switch to Slate Ice theme');
    themeToggle.title = dark ? 'Slate Ice — switch to blue & white' : 'Blue & white — switch to Slate Ice';
    themeLabel.textContent = dark ? 'Go light' : 'Go dark';
    document.querySelector('meta[name="theme-color"]').content = dark ? '#111820' : '#1747e8';
    if (persist) { try { localStorage.setItem('aditya-portfolio-theme', dark ? 'dark' : 'light'); } catch {} }
  }
  applyTheme(root.dataset.theme, false);
  themeToggle.addEventListener('click', () => applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));
  window.addEventListener('storage', event => { if (event.key === 'aditya-portfolio-theme') applyTheme(event.newValue, false); });

  const profileDialog = document.getElementById('profile-dialog');
  const profileTrigger = document.querySelector('.profile-trigger');
  profileTrigger.addEventListener('click', () => {
    profileDialog.showModal(); profileDialog.scrollTop = 0;
    document.body.classList.add('modal-open');
    profileDialog.querySelector('.profile-close').focus();
  });
  profileDialog.querySelector('.profile-close').addEventListener('click', () => profileDialog.close());
  profileDialog.addEventListener('click', event => {
    if (event.target !== profileDialog) return;
    const rect = profileDialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) profileDialog.close();
  });
  profileDialog.addEventListener('close', () => { document.body.classList.remove('modal-open'); profileTrigger.focus(); });

  let progressFrame = false;
  function updateProgress() {
    const range = document.documentElement.scrollHeight - innerHeight;
    document.querySelector('.reading-progress').style.setProperty('--progress', range > 0 ? Math.max(0, Math.min(1, scrollY / range)) : 0);
    progressFrame = false;
  }
  function scheduleProgress() { if (!progressFrame) { progressFrame = true; requestAnimationFrame(updateProgress); } }
  window.addEventListener('scroll', scheduleProgress, {passive:true});
  window.addEventListener('resize', scheduleProgress);
  document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', scheduleProgress));
  updateProgress();

  document.querySelectorAll('.project-card').forEach(card => card.addEventListener('pointermove', event => {
    if (reducedMotion.matches || !finePointer.matches) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--shine-x', `${event.clientX - rect.left}px`);
    card.style.setProperty('--shine-y', `${event.clientY - rect.top}px`);
  }));

  const runningAnimations = new Set();
  if ('IntersectionObserver' in window) {
    const arrivalObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      arrivalObserver.unobserve(entry.target);
      if (reducedMotion.matches) return;
      const animation = entry.target.animate([{opacity:.25,translate:'0 18px'},{opacity:1,translate:'0 0'}], {duration:550, easing:'cubic-bezier(.2,.7,.2,1)'});
      runningAnimations.add(animation);
      animation.finished.then(() => runningAnimations.delete(animation)).catch(() => runningAnimations.delete(animation));
    }), {threshold:.08});
    document.querySelectorAll('.section-top,.project-card,.job,.skill-group,.education').forEach(element => arrivalObserver.observe(element));
  }
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      runningAnimations.forEach(animation => animation.cancel()); runningAnimations.clear();
    }
  });
})();

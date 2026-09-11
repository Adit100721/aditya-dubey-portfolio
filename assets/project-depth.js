/* Bounded, event-driven artwork depth. No continuous animation loop. */
(() => {
  const cards = [...document.querySelectorAll('.project-card')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const pending = new Map();
  let frame = 0;

  const enabled = () => finePointer.matches && !reducedMotion.matches;
  const clamp = value => Math.max(-1, Math.min(1, value));

  function resetCard(card) {
    pending.delete(card);
    card.removeAttribute('data-project-pointer');
    card.style.removeProperty('--project-rx');
    card.style.removeProperty('--project-ry');
  }

  function render() {
    frame = 0;
    if (!enabled()) {
      resetAll();
      return;
    }

    // Read all geometry before applying styles to avoid alternating layout work.
    const poses = [];
    pending.forEach((point, card) => {
      if (card.hidden || !card.isConnected) return;
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      poses.push({
        card,
        rx: -clamp((point.y - rect.top) / rect.height * 2 - 1) * 3,
        ry: clamp((point.x - rect.left) / rect.width * 2 - 1) * 3
      });
    });
    pending.clear();

    poses.forEach(({card, rx, ry}) => {
      card.setAttribute('data-project-pointer', '');
      card.style.setProperty('--project-rx', `${rx.toFixed(2)}deg`);
      card.style.setProperty('--project-ry', `${ry.toFixed(2)}deg`);
    });
  }

  function resetAll() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    cards.forEach(resetCard);
  }

  cards.forEach(card => {
    card.addEventListener('pointermove', event => {
      if (!enabled() || event.pointerType === 'touch') return;
      pending.set(card, {x: event.clientX, y: event.clientY});
      if (!frame) frame = requestAnimationFrame(render);
    }, {passive: true});
    card.addEventListener('pointerleave', () => resetCard(card));
    card.addEventListener('pointercancel', () => resetCard(card));
  });

  reducedMotion.addEventListener('change', resetAll);
  finePointer.addEventListener('change', resetAll);
  window.addEventListener('blur', resetAll);
  window.addEventListener('resize', resetAll, {passive: true});
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) resetAll();
  });
  document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', resetAll));
})();

(() => {
  'use strict';
  const story = document.querySelector('.story');
  const scene = document.querySelector('.device-scene');
  const phone = document.querySelector('.phone');
  const watch = document.querySelector('.watch');
  const toggle = document.querySelector('.motion-toggle');
  if (!story || !scene || !phone || !watch || !toggle) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = window.matchMedia('(max-width: 900px)');
  const root = document.documentElement;
  let paused = false;
  let frame = 0;
  let sceneVisible = true;
  let geometry;
  let current = null;
  let target = 0;
  const clamp = value => Math.max(0, Math.min(1, value));
  const isStatic = () => paused || reducedMotion.matches;

  function measure() {
    const rect = story.getBoundingClientRect();
    const sceneRect = scene.getBoundingClientRect();
    geometry = mobile.matches
      ? { start: sceneRect.top + window.scrollY - window.innerHeight * 0.7, distance: sceneRect.height + window.innerHeight * 0.4 }
      : { start: rect.top + window.scrollY - 80, distance: Math.max(1, rect.height - window.innerHeight + 80) };
    updateTarget();
  }
  function updateTarget() {
    target = clamp((window.scrollY - geometry.start) / geometry.distance);
    if (!frame && !isStatic() && sceneVisible && !document.hidden) frame = requestAnimationFrame(render);
  }
  function render() {
    frame = 0;
    if (isStatic() || !sceneVisible || document.hidden) return;
    current = current === null ? target : current + (target - current) * 0.13;
    const p = current;
    // Only composited transforms change on scroll; the loop stops when settled.
    const float = Math.sin(p * Math.PI * 2) * 13;
    const phoneX = mobile.matches ? -12 * p : -32 * p;
    phone.style.transform = `translate3d(${phoneX}px, ${-20 * p + float}px, 0) rotateX(${7 - 11 * p}deg) rotateY(${-14 + 24 * p}deg) rotateZ(${-8 + 12 * p}deg) scale(${1 - p * .1})`;
    watch.style.transform = `translate3d(${-24 * p}px, ${-155 * p - float}px, 70px) rotateX(${8 - 12 * p}deg) rotateY(${-17 + 25 * p}deg) rotateZ(${13 - 22 * p}deg) scale(${1 + p * .18})`;
    if (Math.abs(target - current) > .0005) frame = requestAnimationFrame(render);
  }
  function syncMotion() {
    cancelAnimationFrame(frame);
    frame = 0;
    current = null;
    root.classList.toggle('motion-paused', isStatic());
    toggle.hidden = reducedMotion.matches;
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.querySelector('.motion-label').textContent = paused ? 'Resume motion' : 'Pause motion';
    toggle.firstElementChild.textContent = paused ? '▷' : 'Ⅱ';
    if (isStatic()) {
      phone.style.removeProperty('transform');
      watch.style.removeProperty('transform');
    } else measure();
  }
  toggle.addEventListener('click', () => { paused = !paused; syncMotion(); });
  reducedMotion.addEventListener('change', syncMotion);
  window.addEventListener('scroll', updateTarget, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else measure();
  });
  if ('IntersectionObserver' in window) {
    const sceneObserver = new IntersectionObserver(entries => {
      sceneVisible = entries[0].isIntersecting;
      if (sceneVisible) measure();
      else { cancelAnimationFrame(frame); frame = 0; }
    });
    sceneObserver.observe(scene);
    const revealObserver = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    }, { threshold: .12 });
    document.querySelectorAll('[data-reveal]').forEach(element => revealObserver.observe(element));
    root.classList.add('reveal-ready');
  }
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(story);
  measure();
  syncMotion();
})();

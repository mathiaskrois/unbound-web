(() => {
  'use strict';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches || location.hash) return;
  try {
    if (sessionStorage.getItem('unbound-intro-seen')) return;
    sessionStorage.setItem('unbound-intro-seen', '1');
  } catch { /* Entrance also works without storage. */ }

  const base = new URL(document.currentScript.src);
  const previousFocus = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'site-intro';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Welcome to Unbound');
  overlay.innerHTML = '<video playsinline preload="auto" aria-hidden="true"></video><div class="intro-glow"></div><img class="intro-logo" alt="" aria-hidden="true"><button class="intro-enter" type="button" aria-label="Enter Unbound, play video with sound"><span class="intro-prompt">press to enter</span></button><button class="intro-sound" type="button" hidden>Sound off</button><button class="intro-skip" type="button">Skip intro</button>';
  const video = overlay.querySelector('video');
  const logo = overlay.querySelector('.intro-logo');
  const enter = overlay.querySelector('.intro-enter');
  const sound = overlay.querySelector('.intro-sound');
  const skip = overlay.querySelector('.intro-skip');
  logo.src = new URL('watch-icon.png?v=spring-1', base).href;
  video.src = new URL('intro.mp4?v=glass-entrance-2', base).href;
  document.body.append(overlay);
  document.documentElement.classList.add('intro-playing');

  let state = 'entrance';
  const setState = next => { state = next; overlay.dataset.state = next; };
  setState(state);
  const viewport = window.visualViewport;
  let height, logoSize;
  function sizeVideo() {
    height = viewport ? viewport.height : innerHeight;
    logoSize = Math.min(240, Math.max(140, innerWidth * .22));
    overlay.style.top = `${viewport ? viewport.offsetTop : 0}px`;
    overlay.style.height = `${height}px`;
    video.style.height = `${height}px`;
    if (video.videoHeight) video.style.width = `${height * video.videoWidth / video.videoHeight}px`;
  }
  sizeVideo();
  let y = -height / 2 - logoSize, velocity = 0, elapsed = 0, departureTime = 0;
  let compression = 0, compressionVelocity = 0, exitAcceleration = 0;
  let frame = 0, lastTime = null, accumulator = 0;
  let loadingTimer, safetyTimer;
  const step = 1 / 120;
  function integrate(dt) {
    elapsed += dt;
    if (state === 'entrance') {
      const hoverTime = Math.max(0, elapsed - 1.2);
      const blend = Math.min(1, hoverTime / 1.5);
      const target = Math.sin(hoverTime * Math.PI * 2 / 4.8) * 8 * blend * blend * (3 - 2 * blend);
      velocity += (64 * (target - y) - 12 * velocity) * dt;
      y += velocity * dt;
      if (elapsed >= 1.2) overlay.classList.add('is-ready');
    } else if (state === 'departure') {
      departureTime += dt;
      velocity -= exitAcceleration * dt;
      y += velocity * dt;
      if (y < -height / 2 - logoSize && departureTime >= .35) {
        setState('video');
        logo.hidden = true;
        enter.hidden = true;
      }
    }
    const compressionTarget = state === 'entrance' && elapsed < 1.2 ? Math.min(.06, Math.max(0, y) / logoSize * .6) : 0;
    compressionVelocity += (180 * (compressionTarget - compression) - 24 * compressionVelocity) * dt;
    compression = Math.max(0, Math.min(.06, compression + compressionVelocity * dt));
  }
  function render(now) {
    frame = 0;
    if (state === 'completion' || document.hidden) return;
    if (lastTime !== null) accumulator += Math.min((now - lastTime) / 1000, .1);
    lastTime = now;
    while (accumulator + 1e-9 >= step) { integrate(step); accumulator -= step; }
    logo.style.transform = `translate(-50%, -50%) translateY(${y}px) scale(${1 + compression / 2}, ${1 - compression})`;
    // Include the MP4's 16-frame silent lead-in before counting animation time.
    if ((state === 'video' || state === 'departure') && video.currentTime >= 4.5 + 16 / 24) finish(true);
    else frame = requestAnimationFrame(render);
  }
  function visibilityChanged() {
    cancelAnimationFrame(frame);
    lastTime = null;
    accumulator = 0;
    if (!document.hidden && state !== 'completion') frame = requestAnimationFrame(render);
  }
  function syncSound() { sound.textContent = video.muted ? 'Sound on' : 'Sound off'; }
  function activate() {
    if (state !== 'entrance') return;
    setState('departure');
    // Reach the top in about half a second without resetting position or velocity.
    const distance = Math.max(0, y + height / 2 + logoSize);
    exitAcceleration = Math.max(2400, 2 * (distance + velocity * .5) / (.5 * .5));
    enter.disabled = true;
    sound.hidden = false;
    sound.focus({ preventScroll: true });
    video.muted = false;
    syncSound();
    loadingTimer = setTimeout(() => finish(), 8000);
    safetyTimer = setTimeout(() => finish(), 30000);
    // This call must remain synchronous within the activation event.
    video.play().catch(() => {
      if (state === 'completion') return;
      video.muted = true;
      syncSound();
      video.play().catch(() => finish());
    });
  }
  // The script runs before the page markup: observe new siblings too.
  const inertSiblings = new Map();
  function isolate() {
    for (const sibling of document.body.children) {
      if (sibling === overlay || inertSiblings.has(sibling)) continue;
      inertSiblings.set(sibling, sibling.inert);
      sibling.inert = true;
    }
  }
  const observer = new MutationObserver(isolate);
  observer.observe(document.body, { childList: true });
  isolate();
  function finish(keepPlaying = false) {
    if (state === 'completion') return;
    setState('completion');
    clearTimeout(loadingTimer);
    clearTimeout(safetyTimer);
    cancelAnimationFrame(frame);
    if (keepPlaying !== true) video.pause();
    observer.disconnect();
    for (const [element, inert] of inertSiblings) element.inert = inert;
    overlay.classList.add('is-finished');
    overlay.inert = true;
    document.documentElement.classList.remove('intro-playing');
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', visibilityChanged);
    window.removeEventListener('resize', sizeVideo);
    viewport?.removeEventListener('resize', sizeVideo);
    viewport?.removeEventListener('scroll', sizeVideo);
    motion.removeEventListener('change', finish);
    const target = previousFocus !== document.body && previousFocus?.isConnected ? previousFocus : document.querySelector('.brand');
    target?.focus({ preventScroll: true });
    setTimeout(() => { video.pause(); overlay.remove(); }, 650);
  }
  function onKey(event) {
    if (event.key === 'Escape') { event.preventDefault(); finish(); }
    if (event.key === 'Tab') {
      overlay.classList.add('keyboard-navigation');
      const controls = [enter, sound, skip].filter(button => !button.hidden && !button.disabled);
      const index = controls.indexOf(document.activeElement);
      event.preventDefault();
      controls[(index + (event.shiftKey ? controls.length - 1 : 1)) % controls.length].focus();
    }
  }
  overlay.addEventListener('pointerdown', () => overlay.classList.remove('keyboard-navigation'));
  overlay.addEventListener('click', event => {
    if (!event.target.closest('.intro-skip, .intro-sound')) activate();
  });
  skip.addEventListener('click', () => finish());
  sound.addEventListener('click', () => { video.muted = !video.muted; syncSound(); });
  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', visibilityChanged);
  motion.addEventListener('change', finish);
  video.addEventListener('loadedmetadata', sizeVideo);
  window.addEventListener('resize', sizeVideo);
  viewport?.addEventListener('resize', sizeVideo);
  viewport?.addEventListener('scroll', sizeVideo);
  video.addEventListener('ended', () => finish());
  video.addEventListener('error', () => { if (state !== 'entrance') finish(); });
  video.addEventListener('playing', () => clearTimeout(loadingTimer));
  enter.focus({ preventScroll: true });
  frame = requestAnimationFrame(render);
})();

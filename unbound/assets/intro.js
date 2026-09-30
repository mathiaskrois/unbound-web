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
  video.src = new URL('intro.mp4?v=transform-1', base).href;
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
  let y = -height / 2 - logoSize, velocity = 0, elapsed = 0, transformTime = 0;
  let compression = 0, compressionVelocity = 0;
  let frame = 0, lastTime = null, accumulator = 0;
  let loadingTimer, safetyTimer, videoFrame;
  let transformStart = null;
  let resumePlayback = false;
  const transformDuration = .55;
  const dissolveDuration = .18;
  const smooth = t => t * t * (3 - 2 * t);
  // Measured inner-symbol widths: 846/1024 in the icon, 398/540 in the video.
  // Both symbols are centered; exclude the icon's circular backing.
  const matchedScale = () => (846 / 1024) * logoSize / ((398 / 540) * height);
  function beginTransformation() {
    if (state !== 'transformation' || transformStart) return;
    transformStart = { y: y / height, velocity: velocity / height, compression };
    clearTimeout(loadingTimer);
    overlay.classList.add('has-video-frame');
  }
  function renderArtwork() {
    let expansion = 1, xScale = 1 + compression / 2, yScale = 1 - compression;
    let videoScale = matchedScale();
    if (transformStart) {
      const t = transformTime + 1e-9 >= transformDuration ? 1 : transformTime / transformDuration;
      const ease = smooth(t);
      // Hermite interpolation retains the fall/hover velocity at the handoff.
      y = height * ((2 * t ** 3 - 3 * t ** 2 + 1) * transformStart.y
        + (t ** 3 - 2 * t ** 2 + t) * transformDuration * transformStart.velocity);
      const squash = transformStart.compression * (1 - ease);
      xScale = 1 + squash / 2;
      yScale = 1 - squash;
      videoScale += (1 - videoScale) * ease;
      expansion = videoScale / matchedScale();
      const dissolve = Math.min(1, transformTime / dissolveDuration);
      logo.style.opacity = String(1 - dissolve);
      video.style.opacity = String(dissolve);
      // Match the brighter icon initially, then return to the source grading.
      video.style.filter = `brightness(${1 + .6 * (1 - ease)})`;
      logo.hidden = dissolve >= 1;
      if (t >= 1 && state === 'transformation') {
        setState('video');
        enter.hidden = true;
      }
    }
    logo.style.transform = `translate(-50%, -50%) translateY(${y}px) scale(${expansion * xScale}, ${expansion * yScale})`;
    video.style.transform = `translate(-50%, -50%) translateY(${y}px) scale(${videoScale * xScale}, ${videoScale * yScale})`;
  }
  const step = 1 / 120;
  function integrate(dt) {
    elapsed += dt;
    if (state === 'entrance' || (state === 'transformation' && !transformStart)) {
      const hoverTime = Math.max(0, elapsed - 1.2);
      const blend = Math.min(1, hoverTime / 1.5);
      const target = Math.sin(hoverTime * Math.PI * 2 / 4.8) * 8 * blend * blend * (3 - 2 * blend);
      velocity += (64 * (target - y) - 12 * velocity) * dt;
      y += velocity * dt;
      if (state === 'entrance' && elapsed + 1e-9 >= 5) overlay.classList.add('is-ready');
      const compressionTarget = elapsed < 1.2 ? Math.min(.06, Math.max(0, y) / logoSize * .6) : 0;
      compressionVelocity += (180 * (compressionTarget - compression) - 24 * compressionVelocity) * dt;
      compression = Math.max(0, Math.min(.06, compression + compressionVelocity * dt));
    } else if (state === 'transformation') {
      transformTime += dt;
    }
  }

  function render(now) {
    frame = 0;
    if (state === 'completion' || document.hidden) return;
    if (lastTime !== null) accumulator += Math.min((now - lastTime) / 1000, .1);
    lastTime = now;
    while (accumulator + 1e-9 >= step) { integrate(step); accumulator -= step; }
    renderArtwork();
    // The source's first half-second is trimmed; retain the original fade point.
    if ((state === 'video' || state === 'transformation') && video.currentTime >= 4) finish(true);
    else frame = requestAnimationFrame(render);
  }
  function visibilityChanged() {
    cancelAnimationFrame(frame);
    lastTime = null;
    accumulator = 0;
    if (document.hidden && state === 'transformation' && !video.paused) {
      resumePlayback = true;
      video.pause();
    }
    if (!document.hidden && state !== 'completion') {
      if (resumePlayback) { resumePlayback = false; playWithFallback(); }
      frame = requestAnimationFrame(render);
    }
  }
  function syncSound() { sound.textContent = video.muted ? 'Sound on' : 'Sound off'; }
  function activate() {
    if (state !== 'entrance') return;
    setState('transformation');
    enter.disabled = true;
    sound.hidden = false;
    sound.focus({ preventScroll: true });
    video.muted = false;
    syncSound();
    loadingTimer = setTimeout(() => finish(), 8000);
    safetyTimer = setTimeout(() => finish(), 30000);
    renderArtwork();
    // This call must remain synchronous within the activation event.
    playWithFallback();
  }
  function playWithFallback() {
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
    if (videoFrame !== undefined) video.cancelVideoFrameCallback?.(videoFrame);
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
  video.addEventListener('playing', () => {
    if (state !== 'transformation') return;
    if (document.hidden) { resumePlayback = true; video.pause(); return; }
    if (transformStart) return;
    if ('requestVideoFrameCallback' in video) {
      if (videoFrame !== undefined) video.cancelVideoFrameCallback(videoFrame);
      videoFrame = video.requestVideoFrameCallback(beginTransformation);
    } else if (video.readyState >= 2) {
      beginTransformation();
    }
  });
  enter.focus({ preventScroll: true });
  frame = requestAnimationFrame(render);
})();

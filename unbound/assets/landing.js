(() => {
  'use strict';
  const script = document.currentScript;
  // The real-time 3D devices; the build stamps this name with a content hash.
  const DEVICES_3D = 'devices-3d.js';
  let devices3d = null;
  let stageScale = 1;
  // Fit the 540×680 device stage to its scene: --device-fill of the height, 114% of the width.
  const fitScene = document.querySelector('.device-scene');
  if (fitScene) {
    const fit = () => {
      const { width, height } = fitScene.getBoundingClientRect();
      const style = getComputedStyle(fitScene);
      const fill = parseFloat(style.getPropertyValue('--device-fill')) || .8;
      const max = parseFloat(style.getPropertyValue('--device-max')) || 1.05;
      const scale = Math.min(max, height * fill / 680, width * 1.14 / 540);
      if (scale > 0) {
        stageScale = scale;
        fitScene.style.setProperty('--device-scale', scale.toFixed(4));
        devices3d?.setScale(scale);
      }
    };
    fit();
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(fitScene);
    else window.addEventListener('resize', fit, { passive: true });
  }
  const story = document.querySelector('.story');
  const scene = document.querySelector('.device-scene');
  const phone = document.querySelector('.phone');
  const watch = document.querySelector('.watch');
  const toggle = document.querySelector('.motion-toggle');
  const motion = window.UnboundMotion;
  if (!story || !scene || !phone || !watch || !toggle || !motion) return;
  const { spring, loop, clamp, pose } = motion;
  const chip = scene.querySelector('.transfer-chip');
  const phoneGlare = phone.querySelector('.device-glare');
  const watchGlare = watch.querySelector('.device-glare');
  const elapsed = watch.querySelector('.watch-times span');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = window.matchMedia('(max-width: 900px)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const root = document.documentElement;
  let paused = false;
  let sceneVisible = true;
  let geometry;
  let entranceStarted = false;
  let entranceShown = false;
  let stageReady = false;
  let seconds = 12 * 60 + 48;
  const isStatic = () => paused || reducedMotion.matches;

  // Chapter beats: hero, "All yours" (the phone turns to face you), and "Leave your phone"
  // (the phone turns away, showing its titanium side, while the watch rises forward and
  // turns its crown toward you). Angles in degrees, offsets in px; d dims the phone screen.
  const PHONE = [
    [0, { x: 0, y: 0, z: 0, rx: 7, ry: -16, rz: -8, s: 1, d: 0 }],
    [.42, { x: -14, y: -14, z: 0, rx: 3, ry: -4, rz: -3, s: 1.03, d: 0 }],
    [.92, { x: -40, y: -18, z: -60, rx: -3, ry: 24, rz: 4, s: .9, d: .38 }],
    [1, { x: -40, y: -18, z: -60, rx: -3, ry: 24, rz: 4, s: .9, d: .38 }],
  ];
  const WATCH = [
    [0, { x: 0, y: 0, z: 70, rx: 8, ry: -20, rz: 13, s: 1 }],
    [.42, { x: -8, y: -40, z: 70, rx: 5, ry: -12, rz: 8, s: 1.02 }],
    [.92, { x: -26, y: -158, z: 110, rx: -2, ry: -26, rz: -9, s: 1.18 }],
    [1, { x: -26, y: -158, z: 110, rx: -2, ry: -26, rz: -9, s: 1.18 }],
  ];

  const progress = spring(0, { stiffness: 70, precision: 5e-4 });
  const tiltX = spring(0, { stiffness: 60 });
  const tiltY = spring(0, { stiffness: 60 });
  const entrance = spring(0, { stiffness: 55, damping: 12 });
  const springs = [progress, tiltX, tiltY, entrance];
  const animator = loop(springs, render, () => !isStatic() && sceneVisible && !document.hidden);

  function measure() {
    const rect = story.getBoundingClientRect();
    const sceneRect = scene.getBoundingClientRect();
    geometry = mobile.matches
      ? { start: sceneRect.top + window.scrollY - window.innerHeight * 0.7, distance: sceneRect.height + window.innerHeight * 0.4 }
      : { start: rect.top + window.scrollY - 80, distance: Math.max(1, rect.height - window.innerHeight + 80) };
    updateTarget();
  }
  function updateTarget() {
    if (!geometry) return;
    progress.target = clamp((window.scrollY - geometry.start) / geometry.distance);
    // While the stage is still hidden (including a restored scroll position), there is nothing to animate.
    if (!stageReady) progress.snap();
    animator.wake();
  }

  // The entrance (e from 1 to 0) rises from below and further back while swinging round.
  // Pointer tilt leans the devices; depth exaggerates it for the watch, which is nearer.
  const place = (d, e, tx, ty, depth) => ({
    x: d.x + ty * depth * 1.4, y: d.y - tx * depth + e * 70, z: d.z - e * 160,
    rx: d.rx + tx + e * 12, ry: d.ry + ty - e * 28, rz: d.rz - e * 4, s: d.s,
  });
  const transform = q => `translate3d(${q.x}px, ${q.y}px, ${q.z}px) rotateX(${q.rx}deg) rotateY(${q.ry}deg) rotateZ(${q.rz}deg) scale(${q.s})`;
  // The polished lip's highlight follows the turn, as a studio light would.
  const spec = (d, tx, ty) => `${(215 + (d.ry + ty) * 2.4 - (d.rx + tx) * 1.2).toFixed(1)}deg`;

  function render() {
    const p = progress.value;
    const e = entrance.value;
    const tx = tiltX.value;
    const ty = tiltY.value;
    const a = pose(PHONE, p);
    const b = pose(WATCH, p);
    if (mobile.matches) { a.x *= .4; b.x *= .4; }
    const phonePose = place(a, e, tx, ty, 1);
    const watchPose = place(b, e * 1.25, tx, ty, 1.6);
    phone.style.transform = transform(phonePose);
    phone.style.setProperty('--dim', a.d.toFixed(3));
    phone.style.setProperty('--spec', spec(a, tx, ty));
    watch.style.transform = transform(watchPose);
    watch.style.setProperty('--spec', spec(b, tx, ty));
    devices3d?.update({ phone: { ...phonePose, dim: a.d }, watch: watchPose, float: true, seconds });
    if (entranceShown && e < .02) scene.classList.add('devices-arrived');
    // Studio light: reflections slide across the glass as the devices turn.
    if (phoneGlare) phoneGlare.style.transform = `translate3d(${(-(a.ry + ty) * 4).toFixed(1)}px, ${((a.rx + tx) * 5).toFixed(1)}px, 0)`;
    if (watchGlare) watchGlare.style.transform = `translate3d(${(-(b.ry + ty) * 3).toFixed(1)}px, ${((b.rx + tx) * 4).toFixed(1)}px, 0)`;
    if (chip) renderChip(clamp((p - .58) / .3), a, b);
  }

  // A file travels from the iPhone library to the watch during "Leave your phone".
  function renderChip(q, a, b) {
    if (q <= 0 || q >= 1) { chip.style.opacity = '0'; chip.style.transform = ''; return; }
    const sx = 200 + a.x, sy = 300 + a.y;
    const ex = 405 + b.x, ey = 405 + b.y;
    const cx = (sx + ex) / 2 + 40, cy = Math.min(sy, ey) - 150;
    const u = 1 - q;
    const x = u * u * sx + 2 * u * q * cx + q * q * ex;
    const y = u * u * sy + 2 * u * q * cy + q * q * ey;
    const arc = Math.sin(Math.PI * q);
    chip.style.opacity = Math.min(1, arc * 3).toFixed(3);
    chip.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${(.8 + arc * .25 - q * .2).toFixed(3)})`;
  }

  function clearStyles() {
    for (const node of [phone, watch, phoneGlare, watchGlare, chip]) if (node) { node.style.removeProperty('transform'); node.style.removeProperty('opacity'); }
    for (const property of ['--dim', '--spec']) { phone.style.removeProperty(property); watch.style.removeProperty(property); }
    // Static 3D devices hold the hero pose, as the CSS devices do.
    devices3d?.update({ phone: { ...place(pose(PHONE, 0), 0, 0, 0, 1), dim: 0 }, watch: place(pose(WATCH, 0), 0, 0, 0, 1.6), float: false, seconds });
  }
  const syncActive = () => devices3d?.setActive(!isStatic() && sceneVisible && !document.hidden);

  function syncMotion() {
    animator.stop();
    root.classList.toggle('motion-paused', isStatic());
    toggle.hidden = reducedMotion.matches;
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.querySelector('.motion-label').textContent = paused ? 'Resume motion' : 'Pause motion';
    toggle.firstElementChild.textContent = paused ? '▷' : 'Ⅱ';
    syncActive();
    if (isStatic()) { clearStyles(); return; }
    measure();
    // Resume from the current scroll position and pointer, without replaying a transition.
    for (const s of springs) s.snap();
    render();
    startEntrance();
  }

  // On a fresh visit to the top of the page, the devices settle into place once the intro has gone.
  function startEntrance() {
    if (!stageReady || entranceStarted || isStatic()) return;
    if (root.classList.contains('intro-playing')) return;
    entranceStarted = true;
    if (window.scrollY > window.innerHeight * .5) return;
    entranceShown = true;
    entrance.snap(1);
    entrance.target = 0;
    render();
    animator.wake();
  }
  if (root.classList.contains('intro-playing')) {
    new MutationObserver((_, observer) => {
      if (root.classList.contains('intro-playing')) return;
      observer.disconnect();
      startEntrance();
    }).observe(root, { attributes: true, attributeFilter: ['class'] });
  }

  // Pointer tilt on mouse and trackpad devices: the devices lean a few degrees toward the cursor.
  window.addEventListener('pointermove', event => {
    if (!finePointer.matches || event.pointerType === 'touch' || isStatic()) return;
    tiltX.target = clamp(event.clientY / window.innerHeight * 2 - 1, -1, 1) * -3;
    tiltY.target = clamp(event.clientX / window.innerWidth * 2 - 1, -1, 1) * 4;
    animator.wake();
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { tiltX.target = 0; tiltY.target = 0; animator.wake(); });

  // The illustrated Now Playing screen keeps time while it is on screen.
  setInterval(() => {
    if (isStatic() || !sceneVisible || document.hidden || !elapsed || !root.classList.contains('motion-ready')) return;
    seconds = Math.min(seconds + 1, 22 * 60 + 4);
    elapsed.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    if (stageReady) render();
  }, 1000);

  // The stage stays hidden until what it shows is ready: the 3D devices with their textures, or
  // (without capable WebGL, or if they take too long) the CSS devices with a decoded screen. It then
  // fades in while the entrance plays, so a reload never shows a half-loaded or jumping device.
  function prepareStage() {
    root.classList.add('stage-pending');
    const capture = phone.querySelector('.phone-screen > img');
    const icon = phone.querySelector('.phone-brand img');
    const decoded = capture && capture.decode ? capture.decode().catch(() => {}) : Promise.resolve();
    const host = scene.querySelector('.device-canvas');
    const style = getComputedStyle(root);
    const colors = { violet: style.getPropertyValue('--violet').trim() || '#bfb1f6', mint: style.getPropertyValue('--mint').trim() || '#a6edd6' };
    const loading = script && host && capture && icon && 'WebGLRenderingContext' in window
      ? import(new URL(DEVICES_3D, script.src).href).then(module => module.createDevices3D({ host, capture: capture.currentSrc || capture.src, icon: icon.currentSrc || icon.src, colors, onLost: useCssDevices }))
      : Promise.reject(new Error('3D devices unavailable'));
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      if (result) {
        devices3d = result;
        devices3d.setScale(stageScale);
        scene.classList.add('webgl-devices');
      }
      decoded.then(reveal);
    };
    loading.then(finish, () => finish(null));
    // A late 3D stage is discarded rather than swapped in while someone is looking.
    setTimeout(() => finish(null), 3500);
    loading.then(late => { if (late !== devices3d) late.canvas.remove(); }, () => {});
  }
  function useCssDevices() {
    devices3d?.canvas.remove();
    devices3d = null;
    scene.classList.remove('webgl-devices');
  }
  function reveal() {
    stageReady = true;
    syncMotion();
    // One frame in the starting pose before fading in, so the first visible frame is the entrance.
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('stage-pending')));
  }

  toggle.addEventListener('click', () => { paused = !paused; syncMotion(); });
  reducedMotion.addEventListener('change', syncMotion);
  window.addEventListener('scroll', updateTarget, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  document.addEventListener('visibilitychange', () => {
    syncActive();
    if (document.hidden) animator.stop();
    else measure();
  });
  if ('IntersectionObserver' in window) {
    const sceneObserver = new IntersectionObserver(entries => {
      sceneVisible = entries[0].isIntersecting;
      scene.classList.toggle('is-offscreen', !sceneVisible);
      syncActive();
      if (sceneVisible) measure();
      else animator.stop();
    });
    sceneObserver.observe(scene);
    const revealObserver = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    }, { threshold: .12 });
    // Chapter text reveals line by line; grouped elements share one stagger sequence.
    document.querySelectorAll('.chapter:not(.chapter-intro) > *').forEach(element => element.setAttribute('data-reveal', ''));
    document.querySelectorAll('[data-reveal]').forEach(element => {
      const group = [...element.parentElement.children].filter(sibling => sibling.hasAttribute('data-reveal'));
      element.style.setProperty('--i', String(Math.min(group.indexOf(element), 5)));
      revealObserver.observe(element);
    });
    root.classList.add('reveal-ready');
  }
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(story);
  // Ambient CSS motion (idle float, waveform, progress) only runs once the pause control exists.
  root.classList.add('motion-ready');
  syncMotion();
  prepareStage();
})();

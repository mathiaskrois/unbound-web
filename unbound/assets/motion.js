// Shared motion core: fixed-step springs and a single requestAnimationFrame loop.
// Springs integrate in 1/120 s steps, so motion is identical at 30, 60 and 120 Hz,
// and the loop stops on its own once every spring has settled.
window.UnboundMotion = (() => {
  'use strict';
  const STEP = 1 / 120;
  const MAX_FRAME = 0.1;

  // stiffness k and damping c; c = 2·√k is critically damped (no overshoot).
  function spring(value = 0, { stiffness = 90, damping = 2 * Math.sqrt(stiffness), precision = 1e-3 } = {}) {
    return {
      value, target: value, velocity: 0,
      step(dt) { this.velocity += (stiffness * (this.target - this.value) - damping * this.velocity) * dt; this.value += this.velocity * dt; },
      settled() { return Math.abs(this.target - this.value) < precision && Math.abs(this.velocity) < precision * 10; },
      snap(value = this.target) { this.value = this.target = value; this.velocity = 0; },
    };
  }

  // A loop that steps a set of springs and calls render() until all of them settle.
  function loop(springs, render, canRun = () => true) {
    let frame = 0;
    let last = 0;
    let accumulator = 0;
    function tick(now) {
      frame = 0;
      if (!canRun()) { last = 0; return; }
      // A resumed tab or offscreen scene continues from rest, without a catch-up jump.
      accumulator += last ? Math.min(MAX_FRAME, (now - last) / 1000) : STEP;
      last = now;
      while (accumulator >= STEP) { for (const s of springs) s.step(STEP); accumulator -= STEP; }
      const done = springs.every(s => s.settled());
      if (done) for (const s of springs) s.snap();
      render();
      if (done) last = 0;
      else frame = requestAnimationFrame(tick);
    }
    return {
      wake() { if (!frame && canRun()) frame = requestAnimationFrame(tick); },
      stop() { cancelAnimationFrame(frame); frame = 0; last = 0; accumulator = 0; },
    };
  }

  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const smooth = t => t * t * (3 - 2 * t);
  // Piecewise pose interpolation: keys is a sorted list of [progress, {prop: value}].
  function pose(keys, p) {
    let i = 0;
    while (i < keys.length - 2 && p > keys[i + 1][0]) i++;
    const [p0, a] = keys[i];
    const [p1, b] = keys[i + 1];
    const t = smooth(clamp((p - p0) / (p1 - p0)));
    const out = {};
    for (const key in a) out[key] = a[key] + (b[key] - a[key]) * t;
    return out;
  }

  return { spring, loop, clamp, smooth, pose };
})();

const { test, expect } = require('@playwright/test');

test('spring is consistent across frame rates and resumes without a catch-up jump', async ({ page }) => {
  async function sample(fps) {
    await page.addInitScript(() => {
      sessionStorage.clear();
      let callbacks = new Map(), next = 0;
      window.requestAnimationFrame = callback => { callbacks.set(++next, callback); return next; };
      window.cancelAnimationFrame = id => callbacks.delete(id);
      window.tick = time => {
        const batch = callbacks;
        callbacks = new Map();
        for (const callback of batch.values()) callback(time);
      };
    });
    await page.goto('/unbound/');
    return page.evaluate(fps => {
      const logo = document.querySelector('.intro-logo');
      const values = [];
      for (let frame = 0; frame <= fps * 7; frame++) {
        tick(frame * 1000 / fps);
        if (frame % (fps / 2) === 0) values.push(logo.style.transform);
      }
      const before = logo.style.transform;
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      tick(60000);
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
      tick(61000);
      return { values, before, after: logo.style.transform };
    }, fps);
  }
  const low = await sample(30);
  const high = await sample(120);
  const positions = result => result.values.map(value => Number(value.match(/translateY\(([-\d.]+)px\)/)[1]));
  const a = positions(low), b = positions(high);
  a.forEach((value, index) => expect(Math.abs(value - b[index])).toBeLessThan(1.5));
  expect(low.after).toBe(low.before);
  expect(high.after).toBe(high.before);
  expect(Math.abs(a[3])).toBeLessThan(2);
  expect(Math.max(...a.slice(4).map(Math.abs))).toBeLessThan(9);
});

test('five-second prompt excludes hidden time; handoff waits for a frame and shares geometry', async ({ page }) => {
  await page.addInitScript(() => {
    let callbacks = new Map(), next = 0;
    window.requestAnimationFrame = callback => { callbacks.set(++next, callback); return next; };
    window.cancelAnimationFrame = id => callbacks.delete(id);
    window.tick = time => {
      const batch = callbacks;
      callbacks = new Map();
      for (const callback of batch.values()) callback(time);
    };
    HTMLVideoElement.prototype.requestVideoFrameCallback = callback => { window.decodedFrame = callback; return 1; };
    HTMLVideoElement.prototype.cancelVideoFrameCallback = () => {};
    HTMLMediaElement.prototype.play = function () { this.dispatchEvent(new Event('playing')); return Promise.resolve(); };
  });
  await page.goto('/unbound/');
  const result = await page.evaluate(() => {
    const overlay = document.querySelector('.site-intro');
    const logo = overlay.querySelector('.intro-logo');
    const video = overlay.querySelector('video');
    let time = 0;
    tick(time);
    const advance = frames => { for (let i = 0; i < frames; i++) tick(time += 1000 / 120); };
    advance(599);
    const beforeFive = overlay.classList.contains('is-ready');
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    time += 60000;
    tick(time);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    tick(time);
    const afterHidden = overlay.classList.contains('is-ready');
    advance(1);
    const atFive = overlay.classList.contains('is-ready');
    const beforePress = logo.style.transform;
    overlay.querySelector('.intro-enter').click();
    const afterPress = logo.style.transform;
    advance(120);
    const waiting = { hidden: logo.hidden, opacity: getComputedStyle(video).opacity, state: overlay.dataset.state };
    decodedFrame();
    advance(10);
    const logoBox = logo.getBoundingClientRect(), videoBox = video.getBoundingClientRect();
    const alignment = {
      centerX: Math.abs((logoBox.x + logoBox.width / 2) - (videoBox.x + videoBox.width / 2)),
      centerY: Math.abs((logoBox.y + logoBox.height / 2) - (videoBox.y + videoBox.height / 2)),
      width: Math.abs(logo.offsetWidth * Math.hypot(new DOMMatrix(getComputedStyle(logo).transform).a, new DOMMatrix(getComputedStyle(logo).transform).b) * 846 / 1024 - parseFloat(video.style.height) * 398 / 540),
    };
    advance(12);
    const dissolved = logo.hidden;
    advance(44);
    const rotated = matchMedia('(any-pointer: coarse)').matches && visualViewport.width <= 900 && visualViewport.height > visualViewport.width;
    const finalWidth = parseFloat(video.style.width);
    const expectedWidth = rotated ? Math.max(visualViewport.height, overlay.querySelector('.intro-viewport-measure').offsetHeight) : parseFloat(overlay.style.height) * video.videoWidth / video.videoHeight;
    const angle = Math.atan2(new DOMMatrix(getComputedStyle(video).transform).b, new DOMMatrix(getComputedStyle(video).transform).a) * 180 / Math.PI;
    const end = { rotated, finalWidth, expectedWidth, angle, state: overlay.dataset.state, opacity: video.style.opacity, transform: video.style.transform };
    return { beforeFive, afterHidden, atFive, beforePress, afterPress, waiting, alignment, dissolved, end };
  });
  expect(result.beforeFive).toBe(false);
  expect(result.afterHidden).toBe(false);
  expect(result.atFive).toBe(true);
  expect(result.afterPress).toBe(result.beforePress);
  expect(result.waiting).toEqual({ hidden: false, opacity: '0', state: 'transformation' });
  expect(result.alignment.centerX).toBeLessThan(1);
  expect(result.alignment.centerY).toBeLessThan(1);
  expect(result.alignment.width).toBeLessThan(1);
  expect(result.dissolved).toBe(true);
  expect(result.end.state).toBe('video');
  expect(result.end.opacity).toBe('1');
  expect(result.end.angle).toBeCloseTo(result.end.rotated ? -90 : 0);
  expect(result.end.finalWidth).toBeCloseTo(result.end.expectedWidth, 1);
  expect(result.end.transform).toContain('scale(1, 1)');
});

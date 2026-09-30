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

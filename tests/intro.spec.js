const { test, expect } = require('@playwright/test');

test('intro fades at 4.5 seconds of media time and keeps playing through the fade', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/unbound/');
  const video = page.locator('.site-intro video');
  await expect.poll(() => video.evaluate(v => v.currentTime)).toBeGreaterThan(0);
  // A playback interruption must not consume the intro's viewing time.
  await video.evaluate(v => v.pause());
  await page.waitForTimeout(4700);
  await expect(page.locator('.site-intro')).not.toHaveClass(/is-finished/);
  await page.evaluate(() => {
    const overlay = document.querySelector('.site-intro');
    const video = overlay.querySelector('video');
    const observer = new MutationObserver(() => {
      if (!overlay.classList.contains('is-finished')) return;
      observer.disconnect();
      window.fadeStart = { time: video.currentTime, paused: video.paused };
      setTimeout(() => {
        window.fadeProgress = {
          time: video.currentTime,
          paused: video.paused,
          opacity: Number(getComputedStyle(overlay).opacity),
        };
      }, 250);
    });
    observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
    return video.play();
  });
  await expect.poll(() => page.evaluate(() => window.fadeProgress), { timeout: 10000 }).toBeTruthy();
  const { start, progress } = await page.evaluate(() => ({ start: window.fadeStart, progress: window.fadeProgress }));
  expect(start.time).toBeGreaterThanOrEqual(4.5);
  expect(start.time).toBeLessThan(4.7);
  expect(start.paused).toBe(false);
  expect(progress.paused).toBe(false);
  expect(progress.time).toBeGreaterThan(start.time + 0.1);
  expect(progress.opacity).toBeGreaterThan(0);
  expect(progress.opacity).toBeLessThan(1);
  await expect(page.locator('.site-intro')).toHaveCount(0);
});

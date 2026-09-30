const { test, expect } = require('@playwright/test');

test('intro fades at the original animation endpoint and keeps playing through the fade', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/unbound/');
  await page.getByRole('button', { name: 'Enter Unbound, play video with sound' }).click();
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
  expect(start.time).toBeGreaterThanOrEqual(4);
  expect(start.time).toBeLessThan(4.2);
  expect(start.paused).toBe(false);
  expect(progress.paused).toBe(false);
  expect(progress.time).toBeGreaterThan(start.time + 0.1);
  expect(progress.opacity).toBeGreaterThan(0);
  expect(progress.opacity).toBeLessThan(1);
  await expect(page.locator('.site-intro')).toHaveCount(0);
});

test('waits for activation, contains focus, plays audibly, and remembers session', async ({ page }) => {
  await page.goto('/unbound/');
  const overlay = page.locator('.site-intro');
  const enter = page.getByRole('button', { name: 'Enter Unbound, play video with sound' });
  await expect(enter).toBeFocused();
  await page.waitForTimeout(5200);
  await expect(overlay).toHaveAttribute('data-state', 'entrance');
  await expect(overlay).toHaveClass(/is-ready/);
  await expect(overlay.locator('video')).toHaveJSProperty('paused', true);
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Skip intro' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(enter).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => overlay.locator('video').evaluate(v => v.currentTime)).toBeGreaterThan(0);
  await expect(overlay.locator('video')).toHaveJSProperty('muted', false);
  await page.getByRole('button', { name: 'Sound off' }).click();
  await expect(overlay.locator('video')).toHaveJSProperty('muted', true);
  await page.keyboard.press('Escape');
  await expect(overlay).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Unbound home', exact: true })).toBeFocused();
  await page.reload();
  await expect(overlay).toHaveCount(0);
});

for (const fallback of [true, false]) {
  test(`play rejection ${fallback ? 'falls back to muted' : 'reveals homepage'}`, async ({ page }) => {
    await page.addInitScript(allowMuted => {
      window.playCalls = [];
      HTMLMediaElement.prototype.play = function () {
        window.playCalls.push(this.muted);
        if (allowMuted && this.muted) {
          this.dispatchEvent(new Event('playing'));
          return Promise.resolve();
        }
        return Promise.reject(new DOMException('Blocked', 'NotAllowedError'));
      };
    }, fallback);
    await page.goto('/unbound/');
    await page.keyboard.press('Space');
    await expect.poll(() => page.evaluate(() => window.playCalls)).toEqual([false, true]);
    if (fallback) {
      await expect(page.getByRole('button', { name: 'Sound on' })).toBeVisible();
      await page.getByRole('button', { name: 'Skip intro' }).click();
    }
    await expect(page.locator('.site-intro')).toHaveCount(0);
    await expect(page.locator('main')).not.toHaveAttribute('inert');
  });
}

test('early and repeated presses preserve transformation; skip never starts video', async ({ page }) => {
  await page.addInitScript(() => {
    window.playCalls = 0;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { window.playCalls++; return play.call(this); };
  });
  await page.goto('/unbound/');
  await page.locator('.intro-enter').dispatchEvent('click');
  await page.locator('.intro-enter').dispatchEvent('click');
  await expect(page.locator('.site-intro')).toHaveAttribute('data-state', 'transformation');
  await expect.poll(() => page.evaluate(() => window.playCalls)).toBe(1);
  await expect(page.locator('.site-intro')).toHaveAttribute('data-state', 'video');
  await page.keyboard.press('Escape');
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Skip intro' }).click();
  expect(await page.evaluate(() => window.playCalls)).toBe(0);
});

test('anchors, reduced motion, and no JavaScript bypass entrance', async ({ page, browser }) => {
  await page.goto('/unbound/#availability');
  await expect(page.locator('.site-intro')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/unbound/');
  await expect(page.locator('.site-intro')).toHaveCount(0);
  const context = await browser.newContext({ javaScriptEnabled: false });
  const plain = await context.newPage();
  await plain.goto('http://127.0.0.1:8080/unbound/');
  await expect(plain.locator('h1')).toBeVisible();
  await expect(plain.locator('.site-intro')).toHaveCount(0);
  await context.close();
});

test('loading deadline starts at entry and media errors reveal the homepage', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = () => new Promise(() => {});
  });
  await page.goto('/unbound/');
  await page.clock.runFor(10000);
  await expect(page.locator('.site-intro')).toHaveAttribute('data-state', 'entrance');
  await page.keyboard.press('Enter');
  await page.clock.runFor(8700);
  await expect(page.locator('.site-intro')).toHaveCount(0);
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await page.keyboard.press('Enter');
  await page.locator('video').dispatchEvent('error');
  await page.clock.runFor(700);
  await expect(page.locator('.site-intro')).toHaveCount(0);
});

test('hiding during the transformation pauses playback and resumes the same handoff', async ({ page }) => {
  await page.goto('/unbound/');
  // Hide immediately on the first composited frame, before the 550 ms handoff ends.
  await page.evaluate(() => {
    const overlay = document.querySelector('.site-intro');
    const observer = new MutationObserver(() => {
      if (!overlay.classList.contains('has-video-frame')) return;
      observer.disconnect();
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
  });
  await page.locator('.intro-enter').click();
  await expect(page.locator('.site-intro')).toHaveClass(/has-video-frame/);
  await expect(page.locator('video')).toHaveJSProperty('paused', true);
  const time = await page.locator('video').evaluate(video => video.currentTime);
  await page.waitForTimeout(700);
  expect(await page.locator('video').evaluate(video => video.currentTime)).toBeCloseTo(time, 1);
  await expect(page.locator('.site-intro')).toHaveAttribute('data-state', 'transformation');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.site-intro')).toHaveAttribute('data-state', 'video');
  await expect(page.locator('video')).toHaveJSProperty('paused', false);
});

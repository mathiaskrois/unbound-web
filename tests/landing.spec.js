const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

test('experience navigation and own-file Watch walkthrough', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/unbound/');
  await page.getByRole('link', { name: 'The experience', exact: true }).click();
  await expect(page).toHaveURL(/\/experience\/$/);
  await page.getByRole('link', { name: 'See how it works' }).click();
  for (const [label, state, title] of [
    ['Send them to your Watch.', 'transfer', 'Your audio, on its way.'],
    ['Leave your phone behind.', 'listen', 'On your wrist. Ready offline.'],
    ['Bring your own MP3s.', 'import', 'A file you already own.'],
  ]) {
    const button = page.getByRole('button', { name: new RegExp(label) });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#journey-preview')).toHaveAttribute('data-state', state);
    await expect(page.locator('#preview-title')).toHaveText(title);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('unbound-intro-seen', '1'));
});

async function jump(page, y) {
  await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), y);
  await page.waitForTimeout(800);
}
async function transforms(page) {
  return page.locator('.device').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).transform));
}

test('renders branded assets, working navigation, and all public routes', async ({ page, request }) => {
  const errors = [];
  // Chromium reports a page transition it aborts (here, a second click while the first is still running) as an error of its own.
  page.on('pageerror', error => { if (!/^Transition was aborted/.test(error.message)) errors.push(error.message); });
  const response = await page.goto('/unbound/');
  expect(response.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your audio.On your Watch.');
  await expect.poll(() => page.locator('img:not([loading="lazy"])').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
  await page.getByRole('link', { name: 'Explore the experience' }).click();
  await expect(page).toHaveURL(/\/experience\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your files.Your wrist.Your world.');
  await page.getByRole('link', { name: 'Coming soon', exact: true }).click();
  await expect(page.locator('#availability')).toBeInViewport();
  for (const path of ['privacy', 'terms', 'support']) {
    const response = await request.get(`/unbound/${path}`);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('<h1>');
  }
  expect(errors).toEqual([]);
});

test('shows the complete support portrait on mobile', async ({ page }) => {
  await page.goto('/unbound/support/');
  const portrait = page.locator('.owner-card img');
  await expect(portrait).toBeVisible();
  await expect(portrait).toHaveJSProperty('naturalWidth', 719);
  await expect(portrait).toHaveJSProperty('naturalHeight', 900);
  const box = await portrait.boundingBox();
  expect(box.height / box.width).toBeCloseTo(900 / 719, 2);
});

test('devices respond to scroll, pause, resume, and stop updating when idle', async ({ page }) => {
  await page.goto('/unbound/');
  const mobile = await page.evaluate(() => innerWidth <= 900);
  await jump(page, mobile ? 320 : 0);
  const before = await transforms(page);
  await jump(page, mobile ? 600 : 900);
  expect(await transforms(page)).not.toEqual(before);
  await page.getByRole('button', { name: 'Pause motion' }).click();
  await expect(page.getByRole('button', { name: 'Resume motion' })).toHaveAttribute('aria-pressed', 'true');
  const paused = await transforms(page);
  await jump(page, mobile ? 500 : 600);
  expect(await transforms(page)).toEqual(paused);
  await page.getByRole('button', { name: 'Resume motion' }).click();
  await page.waitForTimeout(1000);
  expect(await transforms(page)).not.toEqual(paused);
  await page.evaluate(() => {
    window.deviceUpdates = 0;
    new MutationObserver(records => { window.deviceUpdates += records.length; }).observe(document.querySelector('.device-canvas'), { attributes: true, subtree: true, attributeFilter: ['style'] });
  });
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.deviceUpdates)).toBe(0);
});

test('reduced motion is static on load and after preference changes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/unbound/');
  const before = await transforms(page);
  await expect(page.locator('.motion-toggle')).toBeHidden();
  await jump(page, 600);
  expect(await transforms(page)).toEqual(before);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
  expect(await page.locator('[data-reveal]').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).opacity === '1'))).toBe(true);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('.motion-toggle')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.motion-toggle')).toBeHidden();
  await expect.poll(() => transforms(page)).toEqual(before);
});

test('no horizontal overflow across phone, tablet, landscape, and desktop widths', async ({ page }) => {
  await page.goto('/unbound/');
  for (const width of [320, 375, 390, 768, 844, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 900 });
    await jump(page, 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}`).toBe(true);
  }
});

test('header navigation stays on one row inside the bar at phone widths', async ({ page }) => {
  for (const path of ['/unbound/', '/unbound/experience/']) {
    await page.goto(path);
    for (const width of [320, 360, 375, 390, 430, 480]) {
      await page.setViewportSize({ width, height: 800 });
      const layout = await page.evaluate(() => {
        const box = node => node.getBoundingClientRect();
        const header = box(document.querySelector('.site-header'));
        const shell = box(document.querySelector('.site-header .shell'));
        const brand = box(document.querySelector('.site-header .brand'));
        const links = [...document.querySelectorAll('.site-header nav a')].filter(link => link.offsetWidth).map(box);
        return {
          inside: links.every(link => link.top >= header.top && link.bottom <= header.bottom && link.right <= shell.right + 0.5),
          oneRow: links.every(link => Math.abs(link.top + link.height / 2 - (links[0].top + links[0].height / 2)) < 2),
          clearOfBrand: links.every(link => link.left >= brand.right),
        };
      });
      expect(layout, `${path} at ${width}px`).toEqual({ inside: true, oneRow: true, clearOfBrand: true });
    }
  }
});

test('keyboard access and WCAG accessibility checks', async ({ page, browserName }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/unbound/');
  // WebKit on macOS uses Option+Tab to include links with default keyboard settings.
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
});

test('content remains available without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:8080/unbound/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.motion-toggle')).toBeHidden();
  await page.locator('#features').scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading', { name: 'Bring your own world.' })).toBeVisible();
  await context.close();
});

test('device choreography is identical at 30 and 120 fps', async ({ context }) => {
  // Each rate gets a fresh tab, so no scroll position or entrance state carries over between runs.
  async function sample(fps) {
    const page = await context.newPage();
    await page.addInitScript(() => {
      sessionStorage.setItem('unbound-intro-seen', '1');
      let callbacks = new Map(), next = 0;
      window.requestAnimationFrame = callback => { callbacks.set(++next, callback); return next; };
      window.cancelAnimationFrame = id => callbacks.delete(id);
      window.tick = time => {
        const batch = callbacks;
        callbacks = new Map();
        for (const callback of batch.values()) callback(time);
      };
    });
    await page.goto('/unbound/', { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const values = await page.evaluate(fps => {
      const phone = document.querySelector('.phone');
      const watch = document.querySelector('.watch');
      // Both runs measure the settled layout before scrolling.
      window.dispatchEvent(new Event('resize'));
      window.scrollTo({ top: 700, behavior: 'instant' });
      window.dispatchEvent(new Event('scroll'));
      const values = [];
      for (let frame = 1; frame <= fps * 2; frame++) {
        tick(frame * 1000 / fps);
        if (frame % (fps / 2) === 0) values.push([phone.style.transform, watch.style.transform]);
      }
      return values;
    }, fps);
    await page.close();
    return values;
  }
  const numbers = value => value.match(/-?[\d.]+/g).map(Number);
  const low = await sample(30);
  const high = await sample(120);
  expect(low.length).toBe(high.length);
  // The first half second differs by one frame of start-up latency; afterwards the poses must match.
  low.slice(1).forEach((pair, index) => pair.forEach((value, device) => {
    const a = numbers(value), b = numbers(high[index + 1][device]);
    a.forEach((n, i) => expect(Math.abs(n - b[i]), `frame ${index}, device ${device}`).toBeLessThan(.2));
  }));
  expect(low.at(-1)).not.toEqual(low[0]);
});

test('ambient device motion follows pause and reduced-motion preferences', async ({ page }) => {
  await page.goto('/unbound/');
  const phone = page.locator('.phone');
  await expect.poll(() => phone.evaluate(node => getComputedStyle(node).animationName)).toBe('device-float');
  await page.getByRole('button', { name: 'Pause motion' }).click();
  expect(await phone.evaluate(node => getComputedStyle(node).animationPlayState)).toBe('paused');
  expect(await page.locator('.transfer-chip').evaluate(node => getComputedStyle(node).opacity)).toBe('0');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => phone.evaluate(node => getComputedStyle(node).animationName)).toBe('none');
});

test('visible text is never smaller than 11px', async ({ page }) => {
  for (const path of ['/unbound/', '/unbound/experience/']) {
    await page.goto(path);
    const small = await page.evaluate(() => [...document.querySelectorAll('body *')]
      .filter(node => !node.closest('.device-canvas, .site-intro, [hidden]'))
      .filter(node => [...node.childNodes].some(child => child.nodeType === 3 && child.textContent.trim()))
      .filter(node => node.getClientRects().length && parseFloat(getComputedStyle(node).fontSize) < 11)
      .map(node => `${node.className || node.tagName}: ${getComputedStyle(node).fontSize}`));
    expect(small, path).toEqual([]);
  }
});

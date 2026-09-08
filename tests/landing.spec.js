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

async function jump(page, y) {
  await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), y);
  await page.waitForTimeout(800);
}
async function transforms(page) {
  return page.locator('.device').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).transform));
}

test('renders branded assets, working navigation, and all public routes', async ({ page, request }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
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

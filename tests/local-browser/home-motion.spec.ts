import { expect, test } from '@playwright/test';

test('sonar animates automatically without controls; workflow heading follows scroll', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const canvas = page.locator('[data-slot="sonar-grid"] canvas');
  const frame = () => canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL());
  await expect.poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.width)).toBeGreaterThan(1000);
  await expect(page.getByRole('button', { name: /(?:Pause|Play) background/ })).toHaveCount(0);
  const initial = await frame();
  await expect.poll(frame).not.toBe(initial);
  const pieces = page.locator('#workflow-title .scroll-reveal-piece');
  await expect.poll(() => pieces.last().evaluate(el => Number(getComputedStyle(el).opacity))).toBeLessThan(1);
  await page.locator('#workflow-title').evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 100));
  await expect.poll(() => pieces.last().evaluate(el => Number(getComputedStyle(el).opacity))).toBe(1);
  await page.screenshot({ path: 'test-results/home-scroll-desktop.png' });
  expect(errors).toEqual([]);
});

test('mobile reduced motion stays still and preserves content', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const canvas = page.locator('[data-slot="sonar-grid"] canvas');
  await expect.poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.width)).toBe(390);
  const before = await canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL());
  await page.waitForTimeout(250);
  expect(await canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL())).toBe(before);
  await expect(page.getByRole('button', { name: 'Pause background' })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'The whole investigation. Already connected.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('link', { name: 'Explore the working demo' })).toHaveAttribute('href', '/demo/');
  await page.screenshot({ path: 'test-results/home-sonar-mobile.png', fullPage: true });
});

test('live reduced-motion change restores readable heading', async ({ page }) => {
  await page.goto('/');
  const piece = page.locator('#workflow-title .scroll-reveal-piece').last();
  await expect.poll(() => piece.evaluate(el => Number(getComputedStyle(el).opacity))).toBeLessThan(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => piece.evaluate(el => Number(getComputedStyle(el).opacity))).toBe(1);
  await expect.poll(() => piece.evaluate(el => getComputedStyle(el).transform)).toBe('none');
});

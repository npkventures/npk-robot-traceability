import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

test('extension is discoverable and install instructions and package are available at mobile and desktop sizes', async ({ page }) => {
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Get the Chrome extension' })).toBeVisible();
    await page.getByRole('navigation').getByRole('link', { name: 'Chrome extension', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bring the reference with you.');
    await expect(page.getByText('Not published in the Chrome Web Store', { exact: false })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `test-results/extension-browser/install-${width}.png`, fullPage: true });
  }
  const response = await page.request.get('/downloads/tav-chrome-extension.zip');
  expect(response.status()).toBe(200);
  expect((await response.body()).equals(readFileSync('public/downloads/tav-chrome-extension.zip'))).toBe(true);
});

test('reviewed browser capture becomes an exact test draft and preserves page provenance through export', async ({ page }) => {
  await page.goto('/workspace/');
  const form = page.getByRole('form', { name: 'Add a robot' });
  await form.getByLabel('Robot ID', { exact: false }).fill('synthetic-arm');
  await form.getByLabel('Robot name').fill('Synthetic browser test arm');
  await form.getByLabel('Task / cell').fill('Synthetic import verification');
  await form.getByRole('button', { name: 'Add robot', exact: true }).click();
  await page.getByText('Import Chrome capture', { exact: true }).click();
  const capture = { format: 'tav-browser-capture', version: 1, id: '12aaa111-2222-4333-8444-555555555555', reality: 'real', author: 'Synthetic test author',
    source: { url: 'https://example.invalid/camera', title: 'Synthetic calibration', observedAt: '2026-11-17T10:00:00Z' },
    field: { id: 'camera.calibration', component: 'Camera', name: 'Calibration revision', value: 'C18' } };
  const upload = async (value: unknown) => page.getByLabel('Chrome capture file').setInputFiles({ name: 'synthetic-capture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
  await upload({ ...capture, rawHtml: 'must reject' });
  await expect(page.getByRole('alert')).toContainText('unexpected');
  await upload(capture);
  await expect(page.getByRole('button', { name: 'Add browser snapshot' })).toBeDisabled();
  await page.getByLabel('I approve this metadata for the selected robot.').check();
  await page.getByRole('button', { name: 'Add browser snapshot' }).click();
  await expect(page.getByRole('group', { name: 'Test snapshot fields' })).toContainText('C18');
  await expect(page.getByLabel('Exact snapshot revision', { exact: true })).toHaveValue(`browser-${capture.id}:1`);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const download = await pending;
  const bundle = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  const snapshot = bundle.records.snapshots[0];
  expect(snapshot.custom[0].provenance.evidence).toBe(capture.source.url);
  expect(snapshot.custom[0].provenance.method).toContain('Engineer-entered');
  expect(bundle.records.runs).toHaveLength(0);
  await upload(capture);
  await page.getByLabel('I approve this metadata for the selected robot.').check();
  await page.getByRole('button', { name: 'Add browser snapshot' }).click();
  await expect(page.getByLabel('Exact snapshot revision', { exact: true }).locator('option:not([disabled])')).toHaveCount(1);
});

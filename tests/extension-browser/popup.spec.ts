import { test, expect, chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

test('installed MV3 action captures two unrelated sites with temporary permission and produces approved local JSON', async () => {
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, acceptDownloads: true, args: ['--enable-unsafe-extension-debugging'] });
  try {
    const site = await context.newPage();
    const client = await context.newCDPSession(site);
    const { id } = await client.send('Extensions.loadUnpacked', { path: resolve('extensions/chrome') });
    await site.route('https://*.example.invalid/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Synthetic revision page</title><h1>Version C18</h1><input type="password" value="never-capture-this">' }));
    for (const host of ['cad', 'issue-tracker']) {
      await site.goto(`https://${host}.example.invalid/revision?secret=omit-this#private-fragment`);
      await site.bringToFront();
      const { targetInfo } = await client.send('Target.getTargetInfo');
      const popupPromise = context.waitForEvent('page');
      await client.send('Extensions.triggerAction', { id, targetId: targetInfo.targetId });
      const popup = await popupPromise;
      await expect(popup.getByLabel('Page reference', { exact: true })).toHaveValue(`https://${host}.example.invalid/revision`);
      await expect(popup.getByLabel('Page label')).toHaveValue('Synthetic revision page');
      await popup.getByLabel('Component', { exact: true }).fill('Camera');
      await popup.getByLabel('Field name').fill('Calibration revision');
      await popup.getByLabel('Stable field ID').fill('camera.calibration');
      await popup.getByLabel('Recorded version or value').fill('C18');
      await popup.getByLabel('Your name').fill('Synthetic reviewer');
      await popup.getByLabel('Record type').selectOption('synthetic');
      await popup.getByRole('checkbox').check();
      await popup.getByLabel('Recorded version or value').fill('C19');
      await expect(popup.getByRole('checkbox')).not.toBeChecked();
      await popup.getByRole('checkbox').check();
      expect((await new AxeBuilder({ page: popup }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
      await popup.screenshot({ path: `test-results/extension-browser/popup-${host}.png`, fullPage: true });
      const pending = popup.waitForEvent('download');
      await popup.getByRole('button', { name: 'Download approved capture' }).click();
      const download = await pending;
      const raw = readFileSync((await download.path())!, 'utf8'), capture = JSON.parse(raw);
      expect(capture.field.value).toBe('C19');
      expect(capture.source.url).toBe(`https://${host}.example.invalid/revision`);
      expect(raw).not.toMatch(/omit-this|private-fragment|never-capture-this/);
      await expect(popup.getByRole('status')).toContainText('Download requested');
      await popup.close();
    }
    await site.goto('chrome://version');
    const { targetInfo } = await client.send('Target.getTargetInfo');
    const popupPromise = context.waitForEvent('page');
    await client.send('Extensions.triggerAction', { id, targetId: targetInfo.targetId });
    const popup = await popupPromise;
    await expect(popup.getByRole('alert')).toContainText('not supported');
    await expect(popup.getByRole('button', { name: 'Download approved capture' })).toBeDisabled();
  } finally { await context.close(); }
});

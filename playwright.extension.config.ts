import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/extension-browser', outputDir: 'test-results/extension-browser', workers: 1, timeout: 60000,
  use: { baseURL: process.env.TAV_TEST_URL || 'http://127.0.0.1:3013', headless: true },
  webServer: process.env.TAV_TEST_URL ? undefined : { command: 'node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3013', url: 'http://127.0.0.1:3013', reuseExistingServer: false, timeout: 120000 }
});

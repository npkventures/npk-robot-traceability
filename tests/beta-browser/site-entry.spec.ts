import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { emptyBundle } from '../../lib/local/records';

const org = '00000000-0000-4000-8000-000000000001';
const token = 'ui_' + 'a'.repeat(64);

test('one origin: homepage, sign-in, explicit invitation acceptance, workspace and sign-out', async ({ page }) => {
  let signedIn = false, accepted = false, acceptCalls = 0;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = {}, status = 200;
    if (path === '/api/login') signedIn = true;
    if (path === '/api/logout') signedIn = false;
    if (path === '/api/session') {
      status = signedIn ? 200 : 401;
      data = signedIn ? { user: { id: 'synthetic-user', email: 'invited@example.invalid' }, memberships: accepted ? [{ org_id: org, role: 'member', organizations: { name: 'Invited team' } }] : [] } : { error: 'Sign in' };
    }
    if (path === '/api/accept-invite') {
      expect(signedIn).toBe(true);
      expect(route.request().postDataJSON().token).toBe(token);
      acceptCalls++; accepted = true;
    }
    if (path.endsWith('/workspace')) {
      expect(accepted).toBe(true);
      data = { bundle: emptyBundle(), role: 'member', version: 0 };
    }
    await route.fulfill({ status, json: data });
  });
  await page.goto('/');
  await page.locator('.t-card-account').getByRole('link', { name: 'Sign in', exact: false }).click();
  await expect(page).toHaveURL(/\/login(?:\?next=.*)?$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
  await page.goto('/login#invitation=' + token);
  await expect(page.getByText('Your team invitation is ready.', { exact: false })).toBeVisible();
  expect(new URL(page.url()).hash).toBe('');
  expect(acceptCalls).toBe(0);
  await page.getByLabel('Email', { exact: true }).fill('invited@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('synthetic-passphrase');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/app(?:\?org=[a-f0-9-]+)?$/);
  await expect(page.getByLabel('Invitation token')).toHaveValue(token);
  await expect(page.getByRole('combobox', { name: 'Organization', exact: true })).toHaveValue('');
  await expect(page.getByLabel('Robot ID', { exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: 'Accept invitation', exact: true }).click();
  await expect.poll(() => acceptCalls).toBe(1);
  await page.getByRole('combobox', { name: 'Organization', exact: true }).selectOption(org);
  await expect(page.getByLabel('Robot ID', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Tavrik home', exact: true }).click();
  await page.getByRole('link', { name: 'Open workspace', exact: false }).click();
  await expect(page.getByRole('combobox', { name: 'Organization', exact: true })).toBeVisible({timeout:30000});
  await expect(page).toHaveURL(/\/app(?:\?org=[a-f0-9-]+)?$/);
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login(?:\?next=.*)?$/);
  await expect(page.getByLabel('Robot ID', { exact: false })).toHaveCount(0);
});

test('unified public pages and account entry remain usable on mobile', async ({ page, request }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.t-card-account').getByRole('link', { name: 'Sign in', exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  for (const href of await page.locator('a[href^="/"]').evaluateAll(nodes => [...new Set(nodes.map(n => n.getAttribute('href')!))])) expect((await request.get(href)).status()).toBe(200);
  await page.screenshot({ path: 'test-results/unified-home-320.png', fullPage: true });
  for (const route of ['/services', '/about', '/contact', '/demo', '/login', '/app']) expect((await request.get(route)).status()).toBe(200);
  for (const route of ['/workspace', '/local', '/.env.local', '/build.md']) expect((await request.get(route)).status()).toBe(404);
});

test('owner invitation exposes a same-origin link and can hide its secret', async ({ page }) => {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = {};
    if (path === '/api/session') data = { user: { id: 'synthetic-owner', email: 'owner@example.invalid' }, memberships: [{ org_id: org, role: 'owner', organizations: { name: 'Synthetic team' } }] };
    if (path.endsWith('/workspace')) data = { bundle: emptyBundle(), role: 'owner', version: 0 };
    if (path.endsWith('/members')) data = [];
    if (path.endsWith('/access')) data = { invitations: [], credentials: [] };
    if (path.endsWith('/invite')) {
      expect(route.request().postDataJSON()).toEqual({ email: 'invited@example.invalid', role: 'viewer' });
      data = { token };
    }
    await route.fulfill({ json: data });
  });
  await page.goto('/app');
  await page.getByRole('combobox', { name: 'Organization', exact: true }).selectOption(org);
  await page.getByRole('button', { name: 'History and team tools', exact: true }).click();
  await page.getByText('Manage team and collector access', { exact: true }).click();
  await page.getByLabel('Invite email', { exact: true }).fill('invited@example.invalid');
  await page.getByRole('combobox', { name: 'Role', exact: true }).selectOption('viewer');
  await page.getByRole('button', { name: 'Create invitation', exact: true }).click();
  await expect(page.getByLabel('Invitation link', { exact: false })).toHaveValue(new URL(page.url()).origin + '/login#invitation=' + token);
  await page.getByRole('button', { name: 'Hide token', exact: true }).click();
  await expect(page.getByLabel('Invitation link', { exact: false })).toHaveCount(0);
});

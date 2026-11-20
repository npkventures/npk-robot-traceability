import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('account creation validates confirmation and shows email guidance without signing in',async({page})=>{
 let registrations=0;
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/session')return route.fulfill({status:401,json:{error:'Sign in'}});
  if(path==='/api/signup')registrations++;
  await route.fulfill({json:path==='/api/signup'?{message:'If eligible, check your inbox.'}:{configured:true}});
 });
 await page.goto('/app');await page.screenshot({path:'.cache/account-desktop.png',fullPage:true});await page.getByRole('button',{name:'New here? Create an account'}).click();
 await page.getByLabel('Email',{exact:true}).fill('synthetic@example.invalid');
 await page.getByLabel('Password',{exact:true}).fill('synthetic-passphrase-1');
 await page.getByLabel('Confirm password').fill('synthetic-passphrase-2');
 await page.getByRole('button',{name:'Create account',exact:true}).click();
 await expect(page.locator('.account-card [role=alert]')).toContainText('do not match');expect(registrations).toBe(0);
 await page.getByLabel('Confirm password').fill('synthetic-passphrase-1');
 await page.getByRole('button',{name:'Show passwords'}).click();await expect(page.getByLabel('Password',{exact:true})).toHaveAttribute('type','text');
 await page.getByRole('button',{name:'Create account',exact:true}).click();await expect(page.getByRole('status')).toContainText('check your inbox');expect(registrations).toBe(1);
 await expect(page.getByLabel('Organization',{exact:true})).toHaveCount(0);
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await page.setViewportSize({width:375,height:812});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:'.cache/account-mobile.png',fullPage:true});
});

test('recovery link is removed from URL and password setup returns to login',async({page})=>{
 let exchanged=0,updated=0;
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/session')return route.fulfill({json:{user:{id:'10000000-0000-4000-8000-000000000001',email:'synthetic@example.invalid'},memberships:[]}});
  if(path==='/api/auth-session'){exchanged++;expect(route.request().postDataJSON().access_token).toBe('synthetic-link-token');}
  if(path==='/api/password')updated++;
  await route.fulfill({json:{}});
 });
 await page.goto('/login#access_token=synthetic-link-token&refresh_token=synthetic-refresh&type=recovery');
 await expect(page.getByRole('heading',{name:'Choose a new password'})).toBeVisible();expect(new URL(page.url()).hash).toBe('');expect(exchanged).toBe(1);
 await page.getByLabel('Password',{exact:true}).fill('synthetic-new-passphrase');await page.getByLabel('Confirm password').fill('synthetic-new-passphrase');
 await page.getByRole('button',{name:'Save password',exact:true}).click();await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();expect(updated).toBe(1);
});

test('forgot password and demo are reachable without a session',async({page})=>{
 await page.route('**/api/**',async route=>{
  if(new URL(route.request().url()).pathname==='/api/session')return route.fulfill({status:401,json:{error:'Sign in'}});
  await route.fulfill({json:{message:'If eligible, check your inbox.'}});
 });
 await page.goto('/app');await page.getByRole('button',{name:'Forgot password?'}).click();await page.getByLabel('Email',{exact:true}).fill('synthetic@example.invalid');await page.getByRole('button',{name:'Send reset link'}).click();await expect(page.getByRole('status')).toContainText('check your inbox');
 await page.getByRole('link',{name:'Try the demo without signing in'}).click();await expect(page.getByRole('heading',{name:'See what changed'})).toBeVisible();await expect(page.getByRole('combobox',{name:'Test to check',exact:true})).toBeVisible();
});

 test('email card restores focus and respects reduced motion',async({page})=>{
 await page.setViewportSize({width:320,height:800});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/api/**',async route=>{
  if(new URL(route.request().url()).pathname==='/api/session')return route.fulfill({status:401,json:{error:'Sign in'}});
  await route.fulfill({json:{message:'If eligible, check your inbox.'}});
 });
 await page.goto('/login');
 await page.getByRole('button',{name:'Forgot password?'}).click();
 await page.getByLabel('Email',{exact:true}).fill('synthetic@example.invalid');
 await page.getByRole('button',{name:'Send reset link'}).click();
 const notice=page.getByRole('region',{name:'Check your inbox'});
 await expect(notice).toBeFocused();
 await expect(page.locator('.account-stack > .account-card').first()).toHaveAttribute('inert','');
 await expect(notice).toHaveCSS('transform','none');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Back to password reset'}).click();
 await expect(page.getByRole('heading',{name:'Reset your password'})).toBeFocused();
 await expect(page.getByLabel('Email',{exact:true})).toHaveValue('synthetic@example.invalid');
 });

import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('anonymous product entry redirects and private APIs reject access',async({request})=>{
 const page=await request.get('/app',{maxRedirects:0});expect(page.status()).toBe(307);expect(page.headers().location).toBe('/login?next=%2Fapp');
 const forged=await request.get('/app',{headers:{cookie:'unify_session=forged'},maxRedirects:0});expect(forged.status()).toBe(307);
 expect([401,503]).toContain((await request.get('/api/session')).status());
 for(const path of ['/workspace','/local'])expect((await request.get(path)).status()).toBe(404);
});

for(const width of [320,1440])test(`provider controls and background at ${width}px`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width,height:900});
 let provider='';
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/session'||path==='/api/refresh')return route.fulfill({status:401,json:{error:'Sign in'}});
  if(path==='/api/auth-options')return route.fulfill({json:{google:true,github:true}});
  if(path==='/api/github'||path==='/api/google'){provider=path;return route.fulfill({status:503,json:{error:'Provider setup pending'}});}
  return route.fulfill({json:{configured:true}});
 });
 await page.goto('/login');
 await page.getByRole('button',{name:'Sign up',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Create your account'})).toBeVisible();
 expect(await page.locator('.account-provider').first().evaluate(el=>Boolean(el.compareDocumentPosition(document.querySelector('input[name=email]')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
 await page.getByRole('button',{name:'Continue with GitHub'}).click();await expect(page.locator('.account-card [role="alert"]')).toContainText('Provider setup pending');expect(provider).toBe('/api/github');
 await page.getByRole('button',{name:'Continue with Google'}).click();await expect.poll(()=>provider).toBe('/api/google');
 await expect(page.locator('.account-paths svg')).toHaveCount(2);
 await page.getByRole('button',{name:'Pause background'}).click();await expect(page.getByRole('button',{name:'Play background'})).toHaveAttribute('aria-pressed','true');
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.getByRole('button',{name:'Play background'})).toBeHidden();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
 await page.screenshot({path:`test-results/auth-paths-${width}.png`,fullPage:true});expect(errors).toEqual([]);
});

test('unconfigured providers stay visible and cannot start OAuth',async({page})=>{
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/session'||path==='/api/refresh')return route.fulfill({status:401,json:{error:'Sign in'}});
  if(path==='/api/auth-options')return route.fulfill({json:{google:false,github:false}});
  return route.fulfill({json:{configured:true}});
 });
 await page.goto('/login');
 await page.getByRole('button',{name:'Sign up',exact:true}).click();
 for(const provider of ['Google','GitHub']){
  await expect(page.getByRole('button',{name:`Continue with ${provider}`})).toBeDisabled();
  await expect(page.getByText(`${provider} signup is not available yet.`)).toBeVisible();
 }
 await expect(page.getByRole('button',{name:'Create account',exact:true})).toBeEnabled();
});

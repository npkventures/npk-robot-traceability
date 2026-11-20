import { test, expect } from '@playwright/test';
import { demoRecords } from '../../lib/demo/fixtures';
const A='00000000-0000-4000-8000-000000000001', B='00000000-0000-4000-8000-000000000002';
const user='10000000-0000-4000-8000-000000000001';
const fixture={format:'unify-local',version:1,synthetic:true,records:demoRecords,corrections:[]};

test('anonymous demo uses shared light workspace without data or integration requests',async({page,request})=>{
  const calls:string[]=[];
  page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))calls.push(r.url());});
  await page.goto('/demo');
  await expect(page.getByText('Demo · Invented data',{exact:true})).toBeVisible();
  await expect(page.locator('.local-app')).toHaveAttribute('data-demo','true');
  await expect(page.locator('input[type=file]')).toHaveCount(0);
  await page.getByRole('combobox',{name:'Compare with a successful test',exact:true}).selectOption('run-042');
  await expect(page.getByRole('region',{name:'Run comparison',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'History',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Saved setups'})).toBeVisible();
  expect(calls).toEqual([]);
  expect(await page.locator('.local-app').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/readiness-demo-mobile.png',fullPage:true});
  const denied=await request.get(`/api/org/${A}/workspace`);
  expect([401,503]).toContain(denied.status());
  expect(await denied.text()).not.toContain('records');
});

test('onboarded single team opens automatically, logout removes all records',async({page})=>{
  let signed=false;
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    let data:unknown={},status=200;
    if(path==='/api/login')signed=true;
    if(path==='/api/logout')signed=false;
    if(path==='/api/refresh')status=401;
    if(path==='/api/session'){status=signed?200:401;data=signed?{user:{id:user,email:'member@example.invalid'},memberships:[{org_id:A,role:'member',organizations:{name:'Team A'}}]}:{error:'Sign in'};}
    if(path.endsWith('/workspace')){expect(signed).toBe(true);expect(route.request().headers()['x-tavrik-account']).toBe(user);data={version:1,role:'member',bundle:fixture};}
    await route.fulfill({status,json:data});
  });
  await page.goto('/login');
  await page.getByLabel('Email',{exact:true}).fill('member@example.invalid');
  await page.getByLabel('Password',{exact:true}).fill('synthetic-passphrase');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Organization',exact:true})).toHaveValue(A);
  await expect(page.locator('.local-app')).toBeVisible();
  await expect(page).toHaveURL(new RegExp('/app\\?org='+A));
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/readiness-product-mobile.png',fullPage:true});
  page.on('dialog',d=>d.accept());
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page.locator('.local-app')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
});

test('team destination survives sign-in; foreign team never loads; expiry clears records',async({page})=>{
  let expired=false;
  const requests:string[]=[];
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;let data:unknown={},status=200;
    if(path==='/api/session'){status=expired?401:200;data=expired?{error:'Session expired'}:{user:{id:user,email:'member@example.invalid'},memberships:[A,B].map((org_id,i)=>({org_id,role:'viewer',organizations:{name:'Team '+i}}))};}
    if(path==='/api/refresh')status=401;
    if(path.endsWith('/workspace')){requests.push(path);data={version:1,role:'viewer',bundle:fixture};}
    await route.fulfill({status,json:data});
  });
  await page.goto('/login?next='+encodeURIComponent('/app?org='+B));
  await expect(page.getByRole('combobox',{name:'Organization',exact:true})).toHaveValue(B);
  await expect(page.locator('.local-app')).toBeVisible();
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.every(path=>path===`/api/org/${B}/workspace`)).toBe(true);
  await expect(page.getByRole('button',{name:'Record',exact:true})).toHaveCount(0);
  expired=true;
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.local-app')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
  expired=false;requests.length=0;
  await page.goto('/login?next='+encodeURIComponent('/app?org=00000000-0000-4000-8000-000000000099'));
  await expect(page.getByText('You do not have access to the requested team.',{exact:false})).toBeVisible();
  expect(requests).toEqual([]);
});

test('new user has onboarding and explicit invitation without implicit team access',async({page})=>{
  const token='ui_'+'a'.repeat(64);let accepted=false;let writes=0;
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;let data:unknown={};
    if(path==='/api/session')data={user:{id:user,email:'new@example.invalid'},memberships:accepted?[{org_id:A,role:'viewer',organizations:{name:'Invited team'}}]:[]};
    if(path==='/api/accept-invite'){expect(route.request().postDataJSON().token).toBe(token);accepted=true;writes++;}
    if(path.endsWith('/workspace')){expect(accepted).toBe(true);data={version:1,role:'viewer',bundle:fixture};}
    await route.fulfill({json:data});
  });
  await page.goto('/login#invitation='+token);
  await expect(page.getByText('Your account is ready; team access requires an invitation.',{exact:false})).toBeVisible();
  expect(writes).toBe(0);await expect(page.locator('.local-app')).toHaveCount(0);
  await page.getByRole('button',{name:'Accept invitation',exact:true}).click();
  await expect(page.locator('.local-app')).toBeVisible();expect(writes).toBe(1);
});

test('multiple teams require a choice and cross-tab sign-out removes protected state',async({page,context})=>{
  let signed=true;
  await context.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;let data:unknown={},status=200;
    if(path==='/api/logout')signed=false;
    if(path==='/api/refresh')status=401;
    if(path==='/api/session'){status=signed?200:401;data=signed?{user:{id:user,email:'member@example.invalid'},memberships:[A,B].map(org_id=>({org_id,role:'viewer',organizations:{name:org_id===A?'Team A':'Team B'}}))}:{error:'Sign in'};}
    if(path.endsWith('/workspace'))data={version:1,role:'viewer',bundle:fixture};
    await route.fulfill({status,json:data});
  });
  await page.goto('/login');
  await expect(page.getByRole('combobox',{name:'Organization',exact:true})).toHaveValue('');
  await expect(page.locator('.local-app')).toHaveCount(0);
  await page.getByRole('combobox',{name:'Organization',exact:true}).selectOption(A);
  await expect(page.locator('.local-app')).toBeVisible();
  const other=await context.newPage();await other.goto('/login');
  other.on('dialog',d=>d.accept());
  await other.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page.locator('.local-app')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
});

test('late workspace response cannot restore records after sign-out',async({page})=>{
  let release:()=>void=()=>{};
  const pending=new Promise<void>(resolve=>release=resolve);
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;let data:unknown={};
    if(path==='/api/session')data={user:{id:user,email:'member@example.invalid'},memberships:[{org_id:A,role:'viewer',organizations:{name:'Team A'}}]};
    if(path.endsWith('/workspace')){await pending;data={version:1,role:'viewer',bundle:fixture};}
    await route.fulfill({json:data});
  });
  await page.goto('/login');
  await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();
  page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Sign out',exact:true}).click();
  release();
  await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
  await expect(page.locator('.local-app')).toHaveCount(0);
});

test('operator records a run without receiving configuration edit capabilities',async({page})=>{
  let bundle=structuredClone(fixture),saved=false;
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;let data:unknown={};
    if(path==='/api/session')data={user:{id:user,email:'operator@example.invalid'},memberships:[{org_id:A,role:'operator',organizations:{name:'Operator team'}}]};
    if(path.endsWith('/workspace'))data={version:saved?2:1,role:'operator',bundle};
    if(path.endsWith('/save')){
      const incoming=route.request().postDataJSON().bundle;
      expect(incoming.records.runs).toHaveLength(1);expect(incoming.records.runs[0].id).toBe('operator-new');
      expect(incoming.corrections).toEqual([]);expect(incoming.investigations).toBeUndefined();
      bundle.records.runs.push(incoming.records.runs[0]);saved=true;data={version:2};
    }
    await route.fulfill({json:data});
  });
  await page.goto('/login');
  await expect(page.locator('.local-app')).toBeVisible();
  await expect(page.locator('input[type=file]')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Add robot',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Record',exact:true}).click();
  await page.getByText('Record a test run',{exact:true}).click();
  await page.getByLabel('Run ID',{exact:true}).fill('operator-new');
  await page.getByRole('combobox',{name:'Exact snapshot revision',exact:true}).selectOption('snap-042:1');
  await page.getByLabel('Run time (UTC)',{exact:false}).fill('2026-11-18T12:00:00Z');
  await page.getByRole('combobox',{name:'Outcome',exact:true}).selectOption('failure');
  await page.getByLabel('Successful picks',{exact:true}).fill('1');await page.getByLabel('Attempted picks',{exact:true}).fill('2');
  await page.getByRole('button',{name:'Record run',exact:true}).click();
  await page.getByRole('button',{name:'Save to organization',exact:true}).click();
  await expect.poll(()=>saved).toBe(true);
});


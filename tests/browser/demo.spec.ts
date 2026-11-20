import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('shared synthetic demo compares exact records and preserves uncertainty',async({page})=>{
 await page.goto('/demo/');
 await expect(page.getByRole('heading',{name:'See what changed',exact:true})).toBeVisible();
 const baseline=page.getByRole('combobox',{name:'Compare with a successful test',exact:true});
 await expect(baseline).toHaveValue('run-042');
 await expect(page.getByText('Test details: run-043')).toBeVisible();
 await expect(page.getByText('Saved setup: snap-043', {exact:false})).toBeHidden();
 await page.getByText('Test details: run-043',{exact:true}).click();
 await expect(page.getByText('Saved setup: snap-043',{exact:false})).toBeVisible();
 await expect(page.getByText('6 recorded changes',{exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Run comparison',exact:true}).getByRole('cell',{name:'Unknown',exact:true})).toBeVisible();
 await expect(page.getByText('Successful test setup: snap-042 · revision 1')).toBeVisible();
 await baseline.selectOption('run-044');
 await expect(page.getByText('The baseline does not precede the selected run.').first()).toBeVisible();
 await page.getByRole('button',{name:/Robot 03/}).click();
 await expect(page.getByRole('combobox',{name:'Compare with a successful test',exact:true})).toHaveCount(0);
 await expect(page.locator('input[type=file]')).toHaveCount(0);
});
for(const width of [320,390,768,1440])test(`shared demo accessibility at ${width}px`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width,height:900});await page.goto('/demo/');
 await page.getByRole('combobox',{name:'Compare with a successful test',exact:true}).selectOption('run-042');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
 await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex, nofollow');
 expect(errors).toEqual([]);await page.screenshot({path:`test-results/demo-${width}.png`,fullPage:true});
});

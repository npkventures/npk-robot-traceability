import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import {reviewFixture} from '../failure-review-fixture.mjs';

test('batch review groups repeated changes, retrieves prior findings, exports and opens an explicit pair',async({page})=>{
 await page.goto('/workspace/');
 await page.getByLabel('Import JSON').setInputFiles({name:'synthetic-review.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(reviewFixture()))});
 const panel=page.getByRole('region',{name:'Failure review',exact:true});
 await panel.getByRole('button',{name:'Review all failed tests'}).click();
 await expect(panel).toContainText('2 comparisons prepared');
 await expect(panel.getByRole('status')).toContainText('Showing 1 of 1');
 const card=panel.getByRole('article',{name:'Failure failure-repeat',exact:true});
 await card.getByText('Earlier engineer findings (1)',{exact:true}).click();
 await expect(card).toContainText('Synthetic calibration investigation.');
 await expect(card).toContainText('does not establish the same cause');
 const download=page.waitForEvent('download');await panel.getByRole('button',{name:'Download review packet',exact:true}).click();
 const packet=JSON.parse(await readFile((await (await download).path())!,'utf8'));
 expect(packet.failures).toHaveLength(2);expect(packet.synthetic).toBe(true);expect(packet.investigationHistory).toHaveLength(1);
 expect(packet.evidence.runs.every((r:{robotId:string})=>r.robotId==='robot-01')).toBe(true);
 await panel.getByLabel('Find failure or changed field').fill('does-not-exist');await expect(panel.getByRole('status')).toContainText('Showing 0');
 await panel.getByLabel('Find failure or changed field').fill('');
 await card.getByRole('button',{name:'Investigate failure-repeat with success-repeat',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Test to check',exact:true})).toHaveValue('failure-repeat');
 await expect(page.getByRole('combobox',{name:'Compare with a successful test',exact:true})).toHaveValue('success-repeat');
 await expect(page.getByRole('heading',{name:'Compare tests'})).toBeFocused();
 for(const width of [320,1440]){
  await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect((await new AxeBuilder({page}).include('[aria-label="Failure review"]').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await panel.screenshot({path:`test-results/failure-review-${width}.png`});
 }
 await page.getByRole('button',{name:/Robot 02/}).click();
 await panel.getByRole('button',{name:'Review all failed tests'}).click();await expect(panel).toContainText('0 failures');
 await expect(panel).not.toContainText('Synthetic calibration investigation.');
});
test('large review paginates without dropping exports and shows missing-baseline failures',async({page})=>{
 const bundle=reviewFixture(),base=bundle.records.runs.find(r=>r.id==='run-042')!,failed=bundle.records.runs.find(r=>r.id==='run-043')!;
 bundle.investigations=[];
 bundle.records.runs=[base,...Array.from({length:25},(_,i)=>({...failed,id:`failed-${i}`,at:new Date(Date.parse('2026-09-02T00:00:00Z')+i*1000).toISOString().replace('.000Z','Z')}))];
 await page.goto('/workspace/');await page.getByLabel('Import JSON').setInputFiles({name:'synthetic-many.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bundle))});
 const panel=page.getByRole('region',{name:'Failure review',exact:true});await panel.getByRole('button',{name:'Review all failed tests'}).click();
 await expect(panel.getByRole('status')).toContainText('Showing 20 of 25');await panel.getByRole('button',{name:'Next failures'}).click();await expect(panel.getByRole('status')).toContainText('Showing 5 of 25');
 await panel.getByLabel('Find failure or changed field').fill('failed-24');await expect(panel.getByRole('status')).toContainText('Showing 1 of 1');
 const download=page.waitForEvent('download');await panel.getByRole('button',{name:'Download review packet',exact:true}).click();const data=JSON.parse(await readFile((await (await download).path())!,'utf8'));expect(data.failures).toHaveLength(25);
 await page.getByRole('button',{name:'Load synthetic example'}).click();await panel.getByRole('button',{name:'Review all failed tests'}).click();await panel.getByLabel('Failure review filter').selectOption('No baseline');
 await expect(panel.getByRole('article',{name:'Failure run-045',exact:true})).toContainText('not fully known');
});

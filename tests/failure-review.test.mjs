import {test} from 'node:test';
import assert from 'node:assert/strict';
import {failureReview,failureReviewText} from '../lib/local/failure-review.ts';
import {validateBundle,correctField} from '../lib/local/records.ts';
import {reviewFixture} from './failure-review-fixture.mjs';
test('batch review prepares comparable baselines, exact repeated transitions and prior findings without mutation',()=>{
 const b=reviewFixture();validateBundle(b);const original=JSON.stringify(b),r=failureReview(b,'robot-01');
 assert.equal(r.counts.comparisonsPrepared,2);assert.equal(r.counts.repeatedGroups,1);assert.equal(r.counts.withPriorFindings,1);
 const latest=r.failures[0];assert.equal(latest.baseline.id,'success-repeat');assert.equal(latest.matchingCases[0].target.id,'run-043');assert.equal(latest.status,'not_started');
 assert.equal(r.failures[1].status,'engineer_confirmed');assert.equal(r.investigationHistory.length,1);
 assert.ok(r.evidence.runs.every(run=>run.robotId==='robot-01'));assert.ok(r.evidence.snapshots.every(s=>s.robotId==='robot-01'));
 assert.match(failureReviewText(r),/SYNTHETIC EXAMPLE/);assert.match(failureReviewText(r),/not causes/);assert.equal(JSON.stringify(b),original);
 const reversed=structuredClone(b);reversed.records.runs.reverse();reversed.records.snapshots.reverse();
 assert.deepEqual(failureReview(reversed,'robot-01').failures,r.failures);
});
test('unknown configuration, dirty software, missing conditions and changed units never establish repeated matches',()=>{
 for(const mode of ['unknown','dirty','conditions','units']){
  const b=reviewFixture(),s=b.records.snapshots.find(s=>s.id==='snap-043');
  if(mode==='unknown')s.values.gripForce={state:'unknown',reason:'Missing'};
  if(mode==='dirty')s.values.software.value.dirty=true;
  if(mode==='conditions')s.values.conditions={state:'unknown',reason:'Missing'};
  if(mode==='units'){
   const before=b.records.snapshots.find(s=>s.id==='snap-042');
   const f={id:'speed',component:'arm',name:'speed',type:'number',unit:'m/s',category:'condition',value:{state:'known',value:1},provenance:before.provenance.conditions};
   before.custom=[f];s.custom=[{...f,unit:'mm/s'}];
  }
  const r=failureReview(b,'robot-01');assert.equal(r.counts.repeatedGroups,0);assert.equal(r.counts.withPriorFindings,0);
  if(['conditions','units'].includes(mode))assert.equal(r.counts.withoutBaseline,2);
 }
});
test('reopened findings are excluded and export retains exact prior revisions and retest evidence',()=>{
 const b=reviewFixture(),first=b.investigations[0];
 b.investigations.push({...first,revision:2,state:'unresolved',note:'Reopened after contradictory evidence.',recordedAt:'2026-09-01T13:00:00Z',retestId:'failure-repeat'});
 validateBundle(b);const r=failureReview(b,'robot-01');
 assert.equal(r.counts.withPriorFindings,0);assert.equal(r.counts.needsFollowUp,2);assert.equal(r.investigationHistory.length,2);
 assert.ok(r.evidence.runs.some(run=>run.id==='failure-repeat'));
});
test('future, tied and other-robot successes cannot become baselines; missing exact snapshots fail closed',()=>{
 const b=reviewFixture();b.records.runs=b.records.runs.filter(r=>!['run-042','success-repeat'].includes(r.id));
 const f=b.records.runs.find(r=>r.id==='run-043');b.records.runs.push({...f,id:'same-time-success',outcome:'success'});
 assert.equal(failureReview(b,'robot-01').failures.find(r=>r.target.id==='run-043').baseline,null);
 b.records.snapshots=b.records.snapshots.filter(s=>s.id!=='snap-043');assert.throws(()=>failureReview(b,'robot-01'),/exact run snapshot/);
});
test('custom outcome measurements do not fragment configuration groups',()=>{
 const b=reviewFixture(),base=b.records.snapshots.find(s=>s.id==='snap-042'),failed=b.records.snapshots.find(s=>s.id==='snap-043');
 const measurement={id:'duration',component:'test',name:'duration',type:'number',unit:'s',category:'measurement',value:{state:'known',value:2},provenance:base.provenance.conditions};
 base.custom=[measurement];failed.custom=[{...measurement,value:{state:'known',value:10}}];
 assert.equal(failureReview(b,'robot-01').counts.repeatedGroups,1);
});
test('a custom configuration field absent on one side cannot establish a repeated transition',()=>{
 const b=reviewFixture(),s=b.records.snapshots.find(s=>s.id==='snap-043');
 s.custom=[{id:'cad',component:'gripper',name:'CAD revision',type:'text',unit:'',category:'configuration',value:{state:'known',value:'B'},provenance:s.provenance.hardware}];
 const r=failureReview(b,'robot-01');assert.equal(r.counts.comparisonsPrepared,2);assert.equal(r.counts.repeatedGroups,0);assert.equal(r.counts.withPriorFindings,0);
 assert.ok(r.failures.every(f=>f.analysis.counts.unknown>0));
});
test('later snapshot corrections do not rebind historical reviews',()=>{
 const b=reviewFixture(),snapshot=b.records.snapshots.find(s=>s.id==='snap-043');
 const revised=correctField(b,snapshot,'calibration',{state:'known',value:'corrected-later'},{...snapshot.provenance.calibration,author:'Synthetic reviewer',method:'Manual correction',recordedAt:'2026-09-01T13:00:00Z'},'Synthetic transcription correction');
 const r=failureReview(revised,'robot-01');assert.equal(r.counts.repeatedGroups,1);
 assert.equal(r.failures[0].target.snapshot.revision,1);assert.ok(r.evidence.snapshots.every(s=>s.revision===1));
});
test('loaded-history scan handles 1,000 runs and rejects overflow explicitly',()=>{
 const b=reviewFixture(),success=b.records.runs.find(r=>r.id==='run-042'),failed=b.records.runs.find(r=>r.id==='run-043');
 b.investigations=[];b.records.runs=Array.from({length:1000},(_,i)=>({...i%2?failed:success,id:`run-${i}`,at:new Date(Date.parse('2026-09-02T00:00:00Z')+i*1000).toISOString().replace('.000Z','Z')}));
 const start=performance.now(),r=failureReview(b,'robot-01');assert.equal(r.counts.comparisonsPrepared,500);assert.equal(r.counts.repeatedGroups,1);
 console.log(JSON.stringify({benchmark:'synthetic failure review',runs:1000,comparisons:500,elapsedMs:Math.round(performance.now()-start)}));
 b.records.runs.push({...success,id:'overflow'});assert.throws(()=>failureReview(b,'robot-01'),/1,000/);
});

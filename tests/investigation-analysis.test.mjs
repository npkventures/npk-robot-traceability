import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoRecords} from '../lib/demo/fixtures.ts';
import {investigationComparison} from '../lib/local/investigations.ts';
import {investigationAnalysis,investigationHandoff,valueDifferences} from '../lib/local/investigation-analysis.ts';
const known=value=>({state:'known',value});
test('measurement-only changes remain visible without becoming configuration leads',()=>{
 const records=structuredClone(demoRecords);
 const a=records.snapshots.find(s=>s.id==='snap-042'), b=records.snapshots.find(s=>s.id==='snap-043');
 b.values=structuredClone(a.values);
 const field={id:'episode',component:'Source',name:'Episode',type:'number',unit:'1',category:'measurement',value:known(1),provenance:a.provenance.conditions};
 a.custom=[field];b.custom=[{...field,value:known(2)}];
 const result=investigationAnalysis(investigationComparison(records,'run-042','run-043'));
 assert.equal(result.counts.changed,1);
 assert.equal(result.checks.find(c=>c.id==='retest').title,'Investigate beyond the recorded fields');
 assert.match(result.checks.find(c=>c.id==='retest').detail,/No recorded configuration or condition differences/);
});
test('nested differences preserve types, array order and escaped paths without inherited keys',()=>{
 const result=valueDifferences(known(JSON.parse('{"a/b":{"~key":1},"list":[1,2],"gone":false}')),known(JSON.parse('{"list":[2,1],"a/b":{"~key":"1"},"__proto__":"literal"}')));
 assert.deepEqual(result.differences.map(d=>d.path),['/__proto__','/a~1b/~0key','/gone','/list/0','/list/1']);
 assert.equal(result.differences[0].before,'Not recorded');
 assert.equal(valueDifferences(known({a:1,b:2}),known({b:2,a:1})).differences.length,0);
 assert.equal(valueDifferences({state:'unknown',reason:'Missing'},known(1)).differences.length,0);
 const many=valueDifferences(known(Array(110).fill(1)),known(Array(110).fill(2)));
 assert.equal(many.differences.length,100);assert.equal(many.omitted,10);
});
test('analysis and handoff retain exact evidence and avoid diagnosing causes',()=>{
 const records=structuredClone(demoRecords),original=JSON.stringify(records);
 const comparison=investigationComparison(records,'run-042','run-043');
 const a=investigationAnalysis(comparison);
 assert.equal(a.target.snapshot.revision,1);assert.ok(a.counts.changed>0);assert.ok(a.counts.evidenceGaps>0);
 assert.ok(a.checks.some(c=>c.id==='evidence'));
 const text=investigationHandoff(comparison,true);assert.match(text,/SYNTHETIC EXAMPLE/);assert.match(text,/do not prove causation/);assert.match(text,/observed .*recorded /);
 assert.equal(JSON.stringify(records),original);
 comparison.after.values.software=known({commit:'a'.repeat(40),dirty:true});
 assert.ok(investigationAnalysis(comparison).checks.some(c=>c.id==='dirty:run-043'));
});
test('unknown fields and incompatible custom units stay unknown',()=>{
 const records=structuredClone(demoRecords),before=records.snapshots.find(s=>s.id==='snap-042'),after=records.snapshots.find(s=>s.id==='snap-043');
 const field={id:'speed',component:'arm',name:'Speed',type:'number',unit:'m/s',category:'condition',value:known(1),provenance:before.provenance.conditions};
 before.custom=[field];after.custom=[{...field,unit:'mm/s'}];
 const a=investigationAnalysis(investigationComparison(records,'run-042','run-043'));
 assert.equal(a.rows.find(r=>r.key==='custom:speed').result,'Unknown');assert.ok(a.checks.some(c=>c.id==='comparability'));
});

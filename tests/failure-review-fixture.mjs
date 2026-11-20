import {demoRecords} from '../lib/demo/fixtures.ts';
export function reviewFixture(){
 const records=structuredClone(demoRecords);
 for(const snapshot of records.snapshots)snapshot.values.gripForce={state:'known',value:20};
 const success=records.runs.find(r=>r.id==='run-042'),failure=records.runs.find(r=>r.id==='run-043');
 records.runs=records.runs.filter(r=>r.robotId!=='robot-01'||['run-042','run-043'].includes(r.id));
 records.runs.push({...success,id:'success-repeat',at:'2026-09-01T11:05:00Z'}, {...failure,id:'failure-repeat',at:'2026-09-01T12:05:00Z'});
 return {format:'unify-local',version:2,synthetic:true,records,corrections:[],investigations:[{
  id:'10000000-0000-4000-8000-000000000001',revision:1,runId:'run-043',baselineId:'run-042',state:'confirmed-by-engineer',author:'Synthetic engineer',recordedAt:'2026-09-01T10:30:00Z',note:'Synthetic calibration investigation.',evidenceNote:'Synthetic worksheet reviewed; not customer evidence.',retestId:''
 }]};
}

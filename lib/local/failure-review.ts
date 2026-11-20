import { canonical, compareRuns } from '../demo/records.ts';
import type { Run, Snapshot, Value } from '../demo/records.ts';
import { compareCustom } from './custom.ts';
import type { Bundle } from './records.ts';
import type { Investigation } from './investigations.ts';
import { investigationAnalysis } from './investigation-analysis.ts';

const reference = (run: Run) => ({id:run.id,at:run.at,outcome:run.outcome,snapshot:{id:run.snapshotId,revision:run.snapshotRevision}});
const snapshotKey = (id:string, revision:number) => JSON.stringify([id,revision]);
const stable = (value:unknown) => canonical(value as Value);
function contextKey(snapshot:Snapshot):string|null {
  const core=['procedure','object','conditions'] as const;
  const custom=(snapshot.custom??[]).filter(f=>f.category==='condition').sort((a,b)=>a.id.localeCompare(b.id));
  if(core.some(k=>snapshot.values[k].state!=='known')||custom.some(f=>f.value.state!=='known'))return null;
  return stable([core.map(k=>snapshot.values[k]),custom.map(({provenance,...field})=>field)]);
}
function configurationKey(snapshot:Snapshot):string|null {
  const custom=(snapshot.custom??[]).filter(f=>f.category!=='measurement').sort((a,b)=>a.id.localeCompare(b.id));
  const software=snapshot.values.software;
  if(Object.values(snapshot.values).some(f=>f.state==='unknown')||custom.some(f=>f.value.state==='unknown'))return null;
  if(software.state==='known'&&typeof software.value==='object'&&!Array.isArray(software.value)&&software.value.dirty===true)return null;
  return stable([snapshot.values,custom.map(({provenance,...field})=>field)]);
}

/** Retrospective review of one authorized, validated workspace. Never fetches other history. */
export function failureReview(bundle:Bundle,robotId:string) {
  const robot=bundle.records.robots.find(r=>r.id===robotId);
  if(!robot)throw Error('Choose a robot in the loaded workspace.');
  const runs=bundle.records.runs.filter(r=>r.robotId===robotId).sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id));
  if(runs.length>1000)throw Error('Failure review supports up to 1,000 loaded runs per robot. Narrow the workspace before reviewing.');
  const snapshots=new Map(bundle.records.snapshots.filter(s=>s.robotId===robotId).map(s=>[snapshotKey(s.id,s.revision),s]));
  const getSnapshot=(run:Run)=>{const s=snapshots.get(snapshotKey(run.snapshotId,run.snapshotRevision));if(!s)throw Error('An exact run snapshot is missing. Review cannot continue.');return s;};
  const contexts=new Map<string,string|null>(),configurations=new Map<string,string|null>();
  for(const [key,s] of snapshots){contexts.set(key,contextKey(s));configurations.set(key,configurationKey(s));}
  const context=(r:Run)=>contexts.get(snapshotKey(r.snapshotId,r.snapshotRevision))??null;
  const config=(r:Run)=>configurations.get(snapshotKey(r.snapshotId,r.snapshotRevision))??null;
  const pair=(baseline:Run,target:Run)=>{
    const before=getSnapshot(baseline),after=getSnapshot(target);
    const core=compareRuns({robots:[robot],runs:[baseline,target],snapshots:[before,after]},baseline,target),custom=compareCustom(before,after);
    return {baseline,target,before,after,rows:[...core.rows,...custom.rows],warnings:[...core.warnings,...custom.warnings]};
  };
  const latest=new Map<string,Investigation>();
  for(const entry of bundle.investigations??[])if(!latest.has(entry.id)||latest.get(entry.id)!.revision<entry.revision)latest.set(entry.id,entry);
  const runIndex=new Map(runs.map(r=>[r.id,r]));
  const transition=(baseline:Run,target:Run)=>{
    const a=config(baseline),b=config(target);
    const ids=(run:Run)=>(getSnapshot(run).custom??[]).filter(f=>f.category!=='measurement').map(f=>f.id).sort();
    if(stable(ids(baseline))!==stable(ids(target)))return null;
    return a!==null&&b!==null&&a!==b?stable([a,b]):null;
  };
  const priorCases=[...latest.values()].filter(e=>e.state==='confirmed-by-engineer').flatMap(entry=>{
    const baseline=runIndex.get(entry.baselineId),target=runIndex.get(entry.runId);
    if(!baseline||!target||target.outcome!=='failure'||pair(baseline,target).warnings.length)return [];
    const key=transition(baseline,target);
    return key===null?[]:[{entry,baseline,target,key}];
  });
  const successes=new Map<string,Run[]>(),groups=new Map<string,{id:string;runIds:string[];changedFields:string[]}>();
  let comparisonsPrepared=0;
  const failures=[];
  for(const target of runs){
    getSnapshot(target);
    const key=context(target);
    if(target.outcome==='success'){
      if(key!==null){const list=successes.get(key)??[];list.push(target);successes.set(key,list);}continue;
    }
    const candidates=key===null?[]:successes.get(key)??[];
    let comparison:ReturnType<typeof pair>|undefined;
    for(let i=candidates.length-1;i>=0;i--){
      if(candidates[i].at>=target.at)continue;
      const p=pair(candidates[i],target);if(!p.warnings.length){comparison=p;break;}
    }
    const investigations=[...latest.values()].filter(e=>e.runId===target.id);
    const status=investigations.length===0?'not_started':investigations.some(e=>e.state!=='confirmed-by-engineer')?'needs_follow_up':'engineer_confirmed';
    if(!comparison){
      failures.push({target:reference(target),baseline:null,baselineReason:key===null?'Procedure, object or conditions are not fully known.':'No earlier success with matching recorded conditions and compatible custom definitions exists in the loaded history.',status,investigations,analysis:null,groupId:null,matchingCases:[],groupingReason:'No comparable baseline.'});continue;
    }
    comparisonsPrepared++;
    const analysis=investigationAnalysis(comparison),signature=transition(comparison.baseline,target);
    let groupId:string|null=null;
    if(signature!==null){
      let group=groups.get(signature);
      if(!group){
        const changedFields=analysis.rows.filter(r=>r.result==='Changed'&&(!r.key.startsWith('custom:')||comparison.after.custom?.some(f=>`custom:${f.id}`===r.key&&f.category!=='measurement'))).map(r=>r.label);
        group={id:`transition-${groups.size+1}`,runIds:[],changedFields};groups.set(signature,group);
      }
      group.runIds.push(target.id);groupId=group.id;
    }
    const matchingCases=signature===null?[]:priorCases.filter(c=>c.target.at<target.at&&c.key===signature).map(c=>({
      investigation:c.entry,baseline:reference(c.baseline),target:reference(c.target),
      retest:c.entry.retestId&&runIndex.has(c.entry.retestId)?reference(runIndex.get(c.entry.retestId)!):null,
      caution:'Engineer-reported conclusion from a matching recorded transition. This does not establish the same cause or a successful/comparable retest.'
    }));
    failures.push({target:reference(target),baseline:reference(comparison.baseline),baselineReason:'Latest earlier successful run with matching known procedure, object and conditions and compatible custom definitions. Suggested only; choose explicitly to investigate.',status,investigations,analysis,groupId,matchingCases,groupingReason:signature===null?'Unknown configuration, uncommitted software, or no recorded configuration transition; repeated-change matching is not established.':'Exact recorded before/after configurations match; custom outcome measurements are excluded. Physical equivalence and causation are not established.'});
  }
  const repeatedGroups=[...groups.values()].filter(g=>g.runIds.length>1);
  const investigationIds=new Set(failures.flatMap(f=>[...f.investigations.map(e=>e.id),...f.matchingCases.map(c=>c.investigation.id)]));
  const investigationHistory=(bundle.investigations??[]).filter(e=>investigationIds.has(e.id));
  const referencedRuns=new Set([
    ...failures.flatMap(f=>[f.target.id,...(f.baseline?[f.baseline.id]:[]),...f.matchingCases.flatMap(c=>[c.target.id,c.baseline.id,...(c.retest?[c.retest.id]:[])])]),
    ...investigationHistory.flatMap(e=>[e.runId,e.baselineId,...(e.retestId?[e.retestId]:[])])
  ]);
  const evidenceRuns=runs.filter(r=>referencedRuns.has(r.id));
  const evidenceKeys=new Set(evidenceRuns.map(r=>snapshotKey(r.snapshotId,r.snapshotRevision)));
  return {format:'tavrik-failure-review',version:1,synthetic:bundle.synthetic,robot,
    scope:'Reviews only this robot in the loaded workspace. History outside this workspace is not assessed. Baselines remain suggestions until you choose them.',
    limitations:['Recorded differences are not causes.','Unknown configuration and dirty software cannot establish repeated-transition matches.','Prior conclusions are retrospective, engineer-reported and may have been recorded after later runs.','Evidence availability is reported, not independently verified.','No source-code diagnosis, prediction, automatic retest or robot control.'],
    counts:{loadedRuns:runs.length,failures:failures.length,comparisonsPrepared,withoutBaseline:failures.length-comparisonsPrepared,repeatedGroups:repeatedGroups.length,withPriorFindings:failures.filter(f=>f.matchingCases.length>0).length,needsFollowUp:failures.filter(f=>f.status!=='engineer_confirmed').length},
    repeatedGroups,failures:[...failures].reverse(),investigationHistory,evidence:{runs:evidenceRuns,snapshots:[...snapshots].filter(([key])=>evidenceKeys.has(key)).map(([,s])=>s).sort((a,b)=>a.id.localeCompare(b.id)||a.revision-b.revision)}
  };
}

export function failureReviewText(review:ReturnType<typeof failureReview>) {
  return ['Tavrik failure review',review.synthetic?'SYNTHETIC EXAMPLE':'User-supplied records',`${review.robot.name} (${review.robot.id})`,review.scope,...review.limitations,'',
    `${review.counts.loadedRuns} loaded runs; ${review.counts.failures} failures; ${review.counts.comparisonsPrepared} comparisons prepared; ${review.counts.withoutBaseline} without a comparable baseline.`,
    '',...review.failures.flatMap(f=>[
      `FAILURE ${f.target.id} at ${f.target.at} | ${f.target.snapshot.id} revision ${f.target.snapshot.revision}`,
      `Review status: ${f.status}`,f.baseline?`Suggested baseline ${f.baseline.id} | ${f.baseline.snapshot.id} revision ${f.baseline.snapshot.revision}`:'No comparable baseline',f.baselineReason,f.groupingReason,
      ...(f.analysis?.rows.filter(r=>r.result!=='Unchanged'&&r.result!=='Not applicable').map(r=>`${r.group} / ${r.label}: ${r.result}`)??[]),
      ...(f.analysis?.checks.flatMap(c=>[c.title,c.detail,c.action])??[]),
      ...f.matchingCases.flatMap(c=>[`PRIOR FINDING ${c.investigation.id} revision ${c.investigation.revision} (${c.target.id})`,`${c.investigation.author} recorded ${c.investigation.recordedAt}`,c.investigation.note,c.investigation.evidenceNote,c.retest?`Retest ${c.retest.id}: ${c.retest.outcome}`:'No retest reference',c.caution]),''
    ]),'Use the JSON packet for complete comparison values, exact snapshots, provenance and investigation references.'].join('\n');
}

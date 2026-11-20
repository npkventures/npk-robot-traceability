'use client';
import { useState } from 'react';
import type { Bundle } from '../../lib/local/records';
import { appendInvestigation } from '../../lib/local/records';
import { investigationComparison, investigationReport, investigationStates, suggestedBaseline } from '../../lib/local/investigations';
import type { Investigation } from '../../lib/local/investigations';
import { formatField, hardwareStale } from '../../lib/demo/records';
import InvestigationSummary from './investigation-summary';

export default function InvestigationPanel({bundle,runId,baselineId,chooseBaseline,commit,readOnly=false}:{bundle:Bundle;runId:string;baselineId:string;chooseBaseline:(id:string)=>void;commit:(bundle:Bundle,label:string)=>void;readOnly?:boolean}) {
  const [selected,setSelected] = useState('');
  const history = bundle.investigations ?? [];
  const entries = history.filter(e=>e.runId===runId);
  const latest = [...new Map(entries.map(e=>[e.id,e])).values()];
  const current = latest.find(e=>e.id===selected);
  const suggestion = suggestedBaseline(bundle.records,runId);
  const left = current?.baselineId ?? baselineId;
  const comparison = left && runId ? investigationComparison(bundle.records,left,runId) : undefined;
  const validPair = comparison && comparison.baseline.outcome==='success' && comparison.baseline.robotId===comparison.target.robotId && comparison.baseline.at<comparison.target.at;
  function download(id:string) {
    const report=investigationReport(bundle.records,history,id,bundle.synthetic);
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=`tavrik-investigation-${id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  return <section className="local-panel" aria-label="Investigation">
    <h3>Notes and findings</h3><p>Record what you checked and what you found. A change alone does not prove a cause.</p>
    {!runId ? <p>Choose a test above to see or add notes.</p> : <>
      {suggestion ? <p>Suggested successful test: <strong>{suggestion.id}</strong> — the most recent earlier success with the same recorded test steps, object and conditions. Missing details are still unknown. <button type="button" onClick={()=>{chooseBaseline(suggestion.id);setSelected('');}}>Use this successful test</button></p> : <p>No matching successful test found. Choose an earlier success above and check the warnings.</p>}
      <label className="local-input">Investigation history<select value={current?.id ?? ''} onChange={e=>setSelected(e.target.value)}><option value="">New notes for these two tests</option>{latest.map(e=><option key={e.id} value={e.id}>{e.id} · {e.state} · revision {e.revision}</option>)}</select></label>
      {comparison && <><p>Tests: {comparison.baseline.id} → {comparison.target.id}. Saved setup versions: {comparison.before.id} · revision {comparison.before.revision} → {comparison.after.id} · revision {comparison.after.revision}.</p>
        <InvestigationSummary key={`${left}:${runId}`} comparison={comparison} synthetic={bundle.synthetic}/>
        {comparison.warnings.length>0 && <div className="local-warning"><strong>Investigation comparability is limited</strong><ul>{comparison.warnings.map(w=><li key={w}>{w}</li>)}</ul></div>}
        {[...new Set(comparison.rows.map(r=>r.group))].map(group=><details className="local-details" key={group}><summary>{group} — recorded differences and evidence</summary>{comparison.rows.filter(r=>r.group===group).map(row=><div key={row.key}><h4>{row.label}: {row.result}</h4><p>{formatField(row.before)} → {formatField(row.after)}</p>{[comparison.before,comparison.after].map(snapshot=>{
          const p=row.key.startsWith('custom:') ? snapshot.custom?.find(f=>`custom:${f.id}`===row.key)?.provenance : snapshot.provenance[row.key as keyof typeof snapshot.provenance];
          return <p key={`${snapshot.id}:${snapshot.revision}`}><strong>{snapshot.id} · revision {snapshot.revision}:</strong> {p ? <>{p.evidence} — {p.available?'Reported available; not checked':'Unavailable'}. {p.method}; {p.author}. Observed {p.observedAt}; recorded {p.recordedAt}.</> : 'Evidence not recorded.'}</p>;
        })}</div>)}</details>)}
        {[comparison.baseline,comparison.target].map(run=>{const s=run.id===comparison.baseline.id?comparison.before:comparison.after;return hardwareStale(s,run)?<p key={run.id} className="local-warning">{run.id}: stale manual hardware report (over 24 hours; prototype policy).</p>:null;})}
      </>}
      {current && <><p>Current state: <strong>{current.state}</strong>. This is an engineer-reported assessment.</p><button type="button" onClick={()=>download(current.id)}>Export investigation report</button><p>Report reflects this draft, including unsaved entries. Keep private reports outside this repository.</p><ol className="local-timeline">{entries.filter(e=>e.id===current.id).map(e=><li key={e.revision}><strong>Revision {e.revision} · {e.state}</strong><p>{e.note}</p><p>{e.evidenceNote || 'No evidence note supplied.'}{e.retestId && ` Retest: ${e.retestId}.`}</p><small>{e.author} · {e.recordedAt}</small></li>)}</ol></>}
      {readOnly ? <p>Read-only. You can view and download saved notes.</p> : validPair ? <InvestigationForm key={`${current?.id ?? 'new'}:${current?.revision ?? 0}:${left}`} current={current} bundle={bundle} runId={runId} save={data=>{
        const entry:Investigation={id:current?.id ?? crypto.randomUUID(),revision:(current?.revision ?? 0)+1,runId,baselineId:left,state:String(data.get('state')) as Investigation['state'],author:String(data.get('author')).trim(),recordedAt:new Date().toISOString().replace(/\.\d{3}Z$/,'Z'),note:String(data.get('note')).trim(),evidenceNote:String(data.get('evidence')).trim(),retestId:String(data.get('retest')??'')};
        commit(appendInvestigation(bundle,entry),'Investigation revision appended. Export to save this workspace.');setSelected(entry.id);
      }}/> : <p>To write an investigation, choose an earlier successful run for the same robot.</p>}
    </>}
  </section>;
}
function InvestigationForm({current,bundle,runId,save}:{current?:Investigation;bundle:Bundle;runId:string;save:(data:FormData)=>void}) {
  const [error,setError]=useState('');
  const run=bundle.records.runs.find(r=>r.id===runId)!;
  return <form className="local-form" aria-label="Record investigation" onSubmit={e=>{e.preventDefault();try{save(new FormData(e.currentTarget));setError('');}catch(err){setError(err instanceof Error?err.message:'Investigation could not be recorded.');}}}>
    <div className="local-form-grid"><label className="local-input">Investigation state<select name="state" defaultValue={current?.state ?? 'investigating'}>{investigationStates.map(s=><option key={s}>{s}</option>)}</select></label><label className="local-input">Investigation author<input name="author" required maxLength={512} defaultValue={current?.author ?? ''}/></label><label className="local-input local-wide">Investigation note<textarea name="note" required maxLength={2048} rows={3}/></label><label className="local-input local-wide">Resolution evidence note<textarea name="evidence" maxLength={2048} rows={3}/><small>Confirmation requires this note or a retest reference. Describe the evidence supporting your conclusion.</small></label><label className="local-input">Retest reference<select name="retest"><option value="">No retest selected</option>{bundle.records.runs.filter(r=>r.robotId===run.robotId && r.at>run.at).map(r=><option key={r.id} value={r.id}>{r.id} · {r.outcome}</option>)}</select></label></div>
    {error && <p role="alert" className="local-error">{error}</p>}<button type="submit" className="local-primary">Append investigation entry</button>
  </form>;
}

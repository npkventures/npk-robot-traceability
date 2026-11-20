'use client';
import {useMemo,useState} from 'react';
import type {Bundle} from '../../lib/local/records';
import {failureReview,failureReviewText} from '../../lib/local/failure-review';

type Props={bundle:Bundle;robotId:string;choose:(runId:string,baselineId:string)=>void};
export default function FailureReviewPanel(props:Props) {
  const [open,setOpen]=useState(false);
  return <section className="local-failure-review" aria-label="Failure review">
    <button type="button" aria-expanded={open} aria-controls="failure-review-content" onClick={()=>setOpen(!open)}>{open?'Close failure review':'Review all failed tests'}</button>
    <div id="failure-review-content">{open&&<ReviewContent {...props}/>}</div>
  </section>;
}
function ReviewContent({bundle,robotId,choose}:Props) {
  const result=useMemo(()=>{try{return {review:failureReview(bundle,robotId),error:null};}catch(error){return {review:null,error:error instanceof Error?error.message:'Review unavailable.'};}},[bundle,robotId]);
  const [filter,setFilter]=useState('Needs follow-up'),[query,setQuery]=useState(''),[group,setGroup]=useState(''),[page,setPage]=useState(0);
  const [downloadError,setDownloadError]=useState('');
  const review=result.review;
  if(!review)return <p role="alert" className="local-error">{result.error}</p>;
  const filtered=review.failures.filter(f=>(filter==='All failures'||filter==='Needs follow-up'&&f.status!=='engineer_confirmed'||filter==='No baseline'&&!f.baseline||filter==='Prior findings'&&f.matchingCases.length>0||filter==='Engineer confirmed'&&f.status==='engineer_confirmed')&&(!group||f.groupId===group)&&`${f.target.id} ${f.target.snapshot.id} ${f.analysis?.rows.filter(r=>r.result==='Changed').map(r=>r.label).join(' ')??''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const currentPage=Math.min(page,Math.max(0,Math.ceil(filtered.length/20)-1)),visible=filtered.slice(currentPage*20,currentPage*20+20);
  function download(format:'json'|'txt') {
    try{
      const data=format==='json'?JSON.stringify(review,null,2):failureReviewText(review!);
      const url=URL.createObjectURL(new Blob([data],{type:format==='json'?'application/json':'text/plain;charset=utf-8'}));
      const a=document.createElement('a');a.href=url;a.download=`tavrik-failure-review.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);setDownloadError('');
    }catch{setDownloadError('Could not prepare the review download. Your records are unchanged.');}
  }
  return <>
    <p className="local-notice">{review.synthetic?'SYNTHETIC EXAMPLE. ':''}{review.scope} Draft edits are included. Review findings describe recorded evidence, not causes or predictions.</p>
    <div className="local-comparison-summary"><strong>{review.counts.failures} failures</strong><span>{review.counts.comparisonsPrepared} comparisons prepared</span><span>{review.counts.withoutBaseline} without a baseline</span><span>{review.counts.withPriorFindings} with prior findings</span></div>
    <div className="local-toolbar"><button type="button" onClick={()=>download('json')}>Download review packet</button><button type="button" onClick={()=>download('txt')}>Download review brief</button></div>
    {downloadError&&<p role="alert" className="local-error">{downloadError}</p>}
    <p className="local-help">Downloads include all {review.counts.failures} failures for this robot, regardless of the filters below. JSON includes exact evidence; the text brief is for handoff. Keep private files outside the repository. Neither publishes findings nor saves the workspace.</p>
    {review.repeatedGroups.length>0?<details className="local-details"><summary>{review.repeatedGroups.length} repeated recorded configuration transitions</summary>{review.repeatedGroups.map(g=><div key={g.id}><strong>{g.runIds.length} failures: {g.changedFields.join(', ')}</strong><p>{g.runIds.join(', ')}</p><button type="button" onClick={()=>{setGroup(g.id);setFilter('All failures');setPage(0);}}>Show {g.id}</button></div>)}<p>These match the full recorded configurations before and after the change. Outcome measurements are excluded. Repetition does not establish a common cause.</p></details>:<p>No repeated fully known configuration transition was established. Unknown values and uncommitted software prevent matching.</p>}
    <div className="local-form-grid">
      <label className="local-input">Failure review filter<select value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}}>{['Needs follow-up','All failures','No baseline','Prior findings','Engineer confirmed'].map(f=><option key={f}>{f}</option>)}</select></label>
      <label className="local-input">Find failure or changed field<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/></label>
    </div>
    {group&&<p>Filtering {group}. <button type="button" onClick={()=>{setGroup('');setPage(0);}}>Clear transition filter</button></p>}
    <p role="status">Showing {visible.length} of {filtered.length} matching failures from {review.counts.loadedRuns} loaded runs.</p>
    {!filtered.length&&<p>No failures match this view. Choose All failures or clear the search and transition filter.</p>}
    {visible.map(f=><article className="local-run" key={f.target.id} aria-label={`Failure ${f.target.id}`}>
      <h4>{f.target.id}</h4><p>{f.target.at} · {f.target.snapshot.id} revision {f.target.snapshot.revision}</p>
      <p>Investigation status: {f.status.replaceAll('_',' ')}. {f.status==='engineer_confirmed'?'Engineer-reported; not independent verification.':''}</p>
      {f.baseline?<><p>Suggested baseline: <strong>{f.baseline.id}</strong> · {f.baseline.snapshot.id} revision {f.baseline.snapshot.revision}</p><p>{f.baselineReason}</p><p>{f.analysis!.counts.changed} changes · {f.analysis!.counts.unknown} unknown comparisons · {f.analysis!.counts.evidenceGaps} evidence gaps</p><button type="button" onClick={()=>choose(f.target.id,f.baseline!.id)}>Investigate {f.target.id} with {f.baseline.id}</button></>:<><p className="local-warning">{f.baselineReason}</p><button type="button" onClick={()=>choose(f.target.id,'')}>Inspect {f.target.id} and choose a baseline</button></>}
      <details className="local-details"><summary>Recorded changes and follow-up checks</summary><p>{f.groupingReason}</p>{f.analysis?<><ul>{f.analysis.rows.filter(r=>r.result==='Changed'||r.result==='Unknown').map(r=><li key={r.key}>{r.group} / {r.label}: {r.result}</li>)}</ul>{f.analysis.checks.map(c=><div key={c.id}><strong>{c.title}</strong><p>{c.detail}</p><p>{c.action}</p></div>)}</>:<p>No comparison is asserted without a comparable baseline.</p>}</details>
      {f.investigations.length>0&&<details className="local-details"><summary>Existing investigations ({f.investigations.length})</summary>{f.investigations.map(e=><div key={e.id}><p>{e.id} revision {e.revision} · {e.state} · {e.author} · {e.recordedAt}</p><p>{e.note}</p><button type="button" onClick={()=>choose(e.runId,e.baselineId)}>Open pair for investigation {e.id}</button></div>)}</details>}
      {f.matchingCases.length>0&&<details className="local-details"><summary>Earlier engineer findings ({f.matchingCases.length})</summary>{f.matchingCases.map(c=><div key={c.investigation.id}><h5>{c.target.id} · {c.investigation.state}</h5><p>{c.investigation.note}</p><p>{c.investigation.evidenceNote||'No evidence note; inspect the referenced retest.'}</p><p>{c.investigation.author} recorded {c.investigation.recordedAt} · revision {c.investigation.revision}</p><p>{c.retest?`Retest ${c.retest.id}: ${c.retest.outcome}`:'No retest reference.'}</p><p>{c.caution}</p><button type="button" onClick={()=>choose(c.target.id,c.baseline.id)}>Review earlier pair {c.target.id}</button></div>)}</details>}
    </article>)}
    {filtered.length>20&&<div className="local-toolbar" role="group" aria-label="Failure review pages"><button type="button" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Previous failures</button><span>Page {currentPage+1} of {Math.ceil(filtered.length/20)}</span><button type="button" disabled={(currentPage+1)*20>=filtered.length} onClick={()=>setPage(currentPage+1)}>Next failures</button></div>}
  </>;
}

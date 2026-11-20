'use client';
import { useState } from 'react';
import { investigationAnalysis, investigationHandoff } from '../../lib/local/investigation-analysis';
import type { investigationComparison } from '../../lib/local/investigations';
import { formatField } from '../../lib/demo/records';

export default function InvestigationSummary({comparison,synthetic}:{comparison:ReturnType<typeof investigationComparison>;synthetic:boolean}) {
  const [filter,setFilter] = useState('Changed');
  const [query,setQuery] = useState('');
  const analysis = investigationAnalysis(comparison);
  const rows = analysis.rows.filter(r=>(filter==='All' || (filter==='Evidence gaps'?r.evidenceGap:r.result===filter)) && `${r.group} ${r.label} ${r.key}`.toLowerCase().includes(query.toLowerCase().trim()));
  function download() {
    const url=URL.createObjectURL(new Blob([investigationHandoff(comparison,synthetic)],{type:'text/plain;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='tavrik-investigation-handoff.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  return <section aria-label="Investigation summary" className="local-details">
    <h4>Investigation summary</h4>
    <p>{analysis.counts.changed} recorded changes · {analysis.counts.unknown} unknown comparisons · {analysis.counts.evidenceGaps} fields with evidence gaps.</p>
    <p>Follow-up checks are based on recorded facts. They do not identify a cause or predict the next test.</p>
    <ol>{analysis.checks.map(c=><li key={c.id}><strong>{c.title}</strong><p>{c.detail}</p><p>{c.action}</p></li>)}</ol>
    <button type="button" onClick={download}>Download investigation handoff</button>
    <p>The text handoff includes this pair's exact references, comparisons and evidence, including unsaved records. Saved investigation conclusions remain in the investigation report. Keep private exports outside the repository.</p>
    <div className="local-form-grid">
      <label className="local-input">Filter analysis<select value={filter} onChange={e=>setFilter(e.target.value)}>{['Changed','Unknown','Evidence gaps','Unchanged','Not applicable','All'].map(f=><option key={f}>{f}</option>)}</select></label>
      <label className="local-input">Find analysis field<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Component or field name"/></label>
    </div>
    <p role="status">Showing {rows.length} of {analysis.rows.length} fields.</p>
    {!rows.length && <p>No fields match these filters. Select All or clear the search to inspect the complete comparison.</p>}
    {rows.map(row=><details key={row.key} className="local-details"><summary>{row.group} / {row.label}: {row.result}{row.evidenceGap?' · Evidence gap':''}</summary>
      <p>Recorded before: {formatField(row.before)}</p><p>Recorded after: {formatField(row.after)}</p>
      {row.differences.length>0?<ul>{row.differences.map(d=><li key={d.path}><code>{d.path}</code><p>Before: {d.before}</p><p>After: {d.after}</p></li>)}</ul>:<p>No comparable nested change details. Inspect the recorded field values and evidence below.</p>}
      {row.omitted>0 && <p>{row.omitted} additional changes omitted from this preview; inspect the complete snapshot values.</p>}
      {row.evidence.map(e=><p key={e.runId}><strong>{e.runId} · {e.snapshot.id} revision {e.snapshot.revision}:</strong> {e.provenance?`${e.provenance.evidence} (${e.provenance.available?'reported available; not checked':'unavailable'}). ${e.provenance.method}; ${e.provenance.author}. Observed ${e.provenance.observedAt}; recorded ${e.provenance.recordedAt}.`:'Evidence not recorded.'}</p>)}
    </details>)}
  </section>;
}

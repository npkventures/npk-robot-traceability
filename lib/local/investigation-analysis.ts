import { canonical, formatField, hardwareStale } from '../demo/records.ts';
import type { Field, Provenance, Value } from '../demo/records.ts';
import type { investigationComparison } from './investigations.ts';

type Comparison = ReturnType<typeof investigationComparison>;
type Difference = { path: string; before: string; after: string };
const absent = 'Not recorded';

// JSON Pointer paths preserve keys containing dots, slashes or array indices.
export function valueDifferences(before: Field, after: Field) {
  const differences: Difference[] = [];
  let omitted = 0;
  function add(path: string, a: Value | undefined, b: Value | undefined) {
    if (differences.length >= 100) { omitted++; return; }
    differences.push({path: path || '/', before: a === undefined ? absent : canonical(a), after: b === undefined ? absent : canonical(b)});
  }
  function walk(a: Value | undefined, b: Value | undefined, path: string, depth: number) {
    if (a !== undefined && b !== undefined && canonical(a) === canonical(b)) return;
    if (depth < 20 && a !== null && b !== null && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) {
      const left = a as Record<string, Value>, right = b as Record<string, Value>;
      for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
        const token = key.replaceAll('~', '~0').replaceAll('/', '~1');
        walk(Object.hasOwn(left,key) ? left[key] : undefined, Object.hasOwn(right,key) ? right[key] : undefined, `${path}/${token}`, depth + 1);
      }
    } else add(path,a,b);
  }
  if (before.state === 'known' && after.state === 'known') walk(before.value, after.value, '', 0);
  return {differences, omitted};
}

export function investigationAnalysis(comparison: Comparison) {
  const {before,after,baseline,target} = comparison;
  const rows = comparison.rows.map(row => {
    const evidence = [before,after].map((snapshot,index) => {
      const provenance: Provenance | undefined = row.key.startsWith('custom:')
        ? snapshot.custom?.find(f => `custom:${f.id}` === row.key)?.provenance
        : snapshot.provenance[row.key as keyof typeof snapshot.provenance];
      return {runId: index === 0 ? baseline.id : target.id, snapshot: {id:snapshot.id,revision:snapshot.revision}, provenance: provenance ?? null};
    });
    // Custom comparison display already encodes units and incompatible definitions.
    const detail = row.result === 'Changed' ? valueDifferences(row.before,row.after) : {differences:[],omitted:0};
    return {...row,...detail,evidence,evidenceGap:evidence.some(e=>!e.provenance?.available)};
  });
  const checks: {id:string;title:string;detail:string;action:string}[] = [];
  if (comparison.warnings.length) checks.push({id:'comparability',title:'Review baseline suitability',detail:comparison.warnings.join(' '),action:'Confirm procedure, object, conditions and units before interpreting the differences. Choose another baseline if needed.'});
  for (const [run,snapshot] of [[baseline,before],[target,after]] as const) {
    const software = snapshot.values.software;
    if (software.state === 'known' && typeof software.value === 'object' && !Array.isArray(software.value) && software.value.dirty === true)
      checks.push({id:`dirty:${run.id}`,title:`Uncommitted software in ${run.id}`,detail:'The commit reference does not identify the complete working tree used for this test.',action:'Inspect the local Git diff and test output in the source repository. Preserve an approved patch/build reference; source code is not stored or analyzed here.'});
    if (hardwareStale(snapshot,run)) checks.push({id:`hardware:${run.id}`,title:`Stale manual hardware in ${run.id}`,detail:'Confirmation predates the run by more than 24 hours under the prototype policy.',action:'Ask the operator to verify the installed component and confirmation time. Record corrections as new revisions.'});
  }
  const unknown = rows.filter(r=>r.result==='Unknown');
  if (unknown.length) checks.push({id:'unknown',title:'Resolve unknown comparisons',detail:unknown.map(r=>r.label).join(', '),action:'Record missing values or reconcile field definitions and units. Missing evidence cannot establish sameness.'});
  const gaps = rows.filter(r=>r.evidenceGap);
  if (gaps.length) checks.push({id:'evidence',title:'Retrieve supporting evidence',detail:`${gaps.length} fields have absent or reportedly unavailable supporting evidence.`,action:'Use the exact run and snapshot references below to request the missing evidence. Availability is reported, not independently checked.'});
  const changed = rows.filter(r=>r.result==='Changed');
  // Outcome measurements and source episode/order identifiers are displayed for
  // traceability, but are not configuration changes to test as possible causes.
  const leads = changed.filter(row => !row.key.startsWith('custom:') ||
    ![before, after].some(snapshot => snapshot.custom?.some(field => `custom:${field.id}` === row.key && field.category === 'measurement')));
  const measurements = changed.length - leads.length;
  const leadDetail = leads.length === 1
    ? '1 recorded configuration or condition difference is an investigation lead, not an established cause.'
    : leads.length ? `${leads.length} recorded configuration or condition differences are investigation leads, not established causes.`
    : 'No recorded configuration or condition differences were found. This does not rule out unrecorded changes or a software defect.';
  const measurementDetail = measurements ? ` ${measurements} measurement ${measurements === 1 ? 'difference is' : 'differences are'} shown for context, not as configuration-change leads.` : '';
  checks.push({id:'retest',title:leads.length?'Test the recorded changes':'Investigate beyond the recorded fields',detail:leadDetail + measurementDetail,action:'Record a specific hypothesis, an engineer-controlled test and its outcome. Attach the retest or evidence note before confirming a resolution.'});
  return {version:1,baseline:{id:baseline.id,snapshot:{id:before.id,revision:before.revision}},target:{id:target.id,snapshot:{id:after.id,revision:after.revision}},counts:{changed:changed.length,unknown:unknown.length,evidenceGaps:gaps.length,unchanged:rows.filter(r=>r.result==='Unchanged').length},checks,rows};
}

export function investigationHandoff(comparison: Comparison, synthetic: boolean) {
  const analysis = investigationAnalysis(comparison);
  return [
    'Tavrik investigation handoff', synthetic?'SYNTHETIC EXAMPLE':'Recorded evidence; source claims are not independently verified.',
    ...[analysis.baseline,analysis.target].map(r=>`${r.id}: ${r.snapshot.id} revision ${r.snapshot.revision}`),
    'Recorded differences do not prove causation. No source-code diagnosis or live prediction is performed.',
    '', 'FOLLOW-UP CHECKS', ...analysis.checks.flatMap(c=>[c.title,c.detail,c.action,'']),
    'FIELD COMPARISON', ...analysis.rows.flatMap(r=>[
      `${r.group} / ${r.label}: ${r.result}`,`${formatField(r.before)} -> ${formatField(r.after)}`,
      ...r.differences.map(d=>`${d.path}: ${d.before} -> ${d.after}`),
      ...(r.omitted?[`${r.omitted} additional differences omitted; inspect original snapshot values.`]:[]),
      ...r.evidence.map(e=>`${e.runId}: ${e.provenance ? `${e.provenance.evidence}; ${e.provenance.available?'reported available':'unavailable'}; ${e.provenance.method}; ${e.provenance.author}; observed ${e.provenance.observedAt}; recorded ${e.provenance.recordedAt}`:'Evidence not recorded'}`),''
    ])
  ].join('\n');
}

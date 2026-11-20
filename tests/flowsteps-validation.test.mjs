import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { researchExample, flowstepsSource } from '../lib/local/research-example.ts';
import { parseBundle } from '../lib/local/records.ts';
import { investigationComparison, suggestedBaseline, investigationReport } from '../lib/local/investigations.ts';
import { investigationAnalysis, investigationHandoff } from '../lib/local/investigation-analysis.ts';
import { failureReview } from '../lib/local/failure-review.ts';

// Expected outcomes come from a hash-verified public source extraction, independently
// of the application fixture. No expected outcomes are inferred from Euler steps.
const source = JSON.parse(readFileSync(new URL('./fixtures/flowsteps-metadata.json', import.meta.url)));
const episodes = source.rows.map(row => Object.fromEntries(source.columns.map((key, i) => [key, row[i]])));
const pairs = Map.groupBy(episodes, row => row.pair_index);

test('pinned physical robot evidence has complete pairing and original human labels', () => {
  assert.equal(source.metadataSha256, flowstepsSource.metadataSha256);
  assert.equal(source.revision, flowstepsSource.revision);
  assert.equal(episodes.length, 4800);
  assert.equal(new Set(episodes.map(e => e.episode_index)).size, 4800);
  assert.equal(pairs.size, 2400);
  assert.equal(episodes.filter(e => e.success === 0).length, 2060);
  assert.equal(episodes.filter(e => e.success === 1).length, 2740);
  const selected = researchExample();
  assert.deepEqual(selected, researchExample(pairs.get(1984)));
});

test('all 2400 physical pairs preserve outcomes, detect the source setting, and abstain from unsupported diagnosis', t => {
  const patterns = { bothSuccess: 0, bothFailure: 0, successThenFailure: 0, failureThenSuccess: 0 };
  let lowOnly = 0, highOnly = 0;
  for (const [pairId, pair] of pairs) {
    assert.equal(pair.length, 2);
    assert.deepEqual(pair.map(e => e.run_number).sort(), [1, 2]);
    const ordered = [...pair].sort((a, b) => a.run_number - b.run_number);
    const bundle = parseBundle(JSON.stringify(researchExample(pair)));
    const original = JSON.stringify(bundle);
    const [first, second] = bundle.records.runs;
    for (let i = 0; i < 2; i++) {
      assert.equal(bundle.records.runs[i].outcome, ordered[i].success ? 'success' : 'failure', `pair ${pairId}`);
      assert.equal(bundle.records.runs[i].snapshotId, `flowsteps-episode-${ordered[i].episode_index}`);
    }
    const comparison = investigationComparison(bundle.records, first.id, second.id);
    const analysis = investigationAnalysis(comparison);
    const steps = analysis.rows.find(r => r.key === 'custom:euler-steps');
    assert.equal(steps.result, 'Changed');
    assert.equal(steps.before.value, `${ordered[0].num_euler_steps} 1`);
    assert.equal(steps.after.value, `${ordered[1].num_euler_steps} 1`);
    assert.equal(analysis.counts.changed, 3); // setting plus source episode/order
    assert.equal(analysis.counts.unknown, 9);
    assert.match(analysis.checks.find(c => c.id === 'retest').detail, /^1 recorded configuration or condition difference is/);
    assert.match(analysis.checks.find(c => c.id === 'retest').detail, /2 measurement differences/);
    assert.ok(comparison.warnings.some(w => w.startsWith('Procedure version: unknown')));
    assert.ok(comparison.warnings.some(w => w.startsWith('Conditions with units: unknown')));
    assert.equal(suggestedBaseline(bundle.records, second.id), undefined);
    const review = failureReview(bundle, bundle.records.robots[0].id);
    assert.equal(review.counts.failures, pair.filter(e => !e.success).length);
    assert.equal(review.counts.comparisonsPrepared, 0);
    assert.equal(review.counts.withPriorFindings, 0);
    assert.equal(review.counts.repeatedGroups, 0);
    for (const f of review.failures) {
      assert.equal(f.status, 'not_started');
      assert.equal(f.baseline, null);
      assert.match(f.baselineReason, /not fully known/);
    }
    assert.match(investigationHandoff(comparison, true), /do not prove causation/);
    assert.equal(JSON.stringify(bundle), original);
    const pattern = ordered[0].success ? (ordered[1].success ? 'bothSuccess' : 'successThenFailure') : (ordered[1].success ? 'failureThenSuccess' : 'bothFailure');
    patterns[pattern]++;
    if (pair[0].success !== pair[1].success) {
      if (pair.find(e => e.success).num_euler_steps === 1) lowOnly++; else highOnly++;
    }
  }
  assert.ok(Object.values(patterns).every(n => n > 0));
  assert.ok(lowOnly > 0 && highOnly > 0, 'Outcomes must not be inferred from step count');
  t.diagnostic(JSON.stringify({ pairs: pairs.size, episodes: episodes.length, patterns, lowOnly, highOnly }));
});

test('source-backed investigation export preserves uncertainty and rejects unsupported confirmation', () => {
  const bundle = researchExample();
  const [baseline, target] = bundle.records.runs;
  const entry = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', revision: 1, runId: target.id, baselineId: baseline.id,
    state: 'unresolved', author: 'Automated regression test (not a researcher conclusion)', recordedAt: '2026-01-02T00:00:00Z',
    note: 'Source labels success then failure; setting changed. Individual physical cause is not established.', evidenceNote: '', retestId: '' };
  const report = investigationReport(bundle.records, [entry], entry.id, true);
  assert.equal(report.investigation.state, 'unresolved');
  assert.equal(report.evidence[1].run.outcome, 'failure');
  assert.equal(report.evidence[1].snapshot.revision, 1);
  assert.match(report.disclaimer, /do not prove causation/);
  assert.throws(() => investigationReport(bundle.records, [{ ...entry, state: 'confirmed-by-engineer' }], entry.id, true), /confirmation requires/);
  assert.throws(() => researchExample([episodes[0], episodes[2]]), /matched Flowsteps pair/);
});

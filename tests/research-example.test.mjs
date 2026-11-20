import test from 'node:test';
import assert from 'node:assert/strict';
import { researchExample } from '../lib/local/research-example.ts';
import { validateBundle, parseBundle } from '../lib/local/records.ts';
import { compareRuns } from '../lib/demo/records.ts';
import { compareCustom } from '../lib/local/custom.ts';

test('source-backed demo preserves exact pair order, uncertainty and synthetic status through import', () => {
  const bundle = researchExample();
  validateBundle(bundle);
  const imported = parseBundle(JSON.stringify(bundle));
  assert.equal(imported.synthetic, true);
  const [success, failure] = imported.records.runs;
  assert.equal(success.id, 'flowsteps-3969-success');
  assert.equal(failure.id, 'flowsteps-3968-failure');
  assert.equal(success.outcome, 'success');
  assert.equal(failure.outcome, 'failure');
  assert.ok(success.at < failure.at);
  for (const run of imported.records.runs) assert.equal(run.attemptedPicks, undefined);
  for (const snapshot of imported.records.snapshots) {
    for (const field of ['hardware', 'software', 'calibration', 'firmware', 'model', 'lineage', 'gripForce', 'conditions', 'procedure']) {
      assert.equal(snapshot.values[field].state, 'unknown');
    }
    assert.match(snapshot.provenance.hardware.method, /synthetic placeholders/);
    assert.match(snapshot.provenance.hardware.evidence, /7b6a29a20c866ce3caaa4a5461a2c5ca873f8bc7/);
  }
  assert.ok(compareRuns(imported.records, success, failure).warnings.length > 0);
  const { rows } = compareCustom(...imported.records.snapshots);
  const steps = rows.find(row => row.key === 'custom:euler-steps');
  assert.equal(steps.result, 'Changed');
  assert.equal(steps.before.value, '10 1');
  assert.equal(steps.after.value, '1 1');
  assert.deepEqual(parseBundle(JSON.stringify(imported)), imported);
});

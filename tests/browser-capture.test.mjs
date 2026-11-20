import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { pageReference, parseCapture } from '../extensions/chrome/capture.mjs';
import { addBrowserCapture } from '../lib/local/browser-capture.ts';
import { emptyBundle, addRobot, addRun, exportBundle, parseBundle } from '../lib/local/records.ts';
import { compareCustom } from '../lib/local/custom.ts';

const time = '2026-11-17T10:00:00Z', recordedAt = '2026-11-17T10:05:00Z';
const fixture = () => ({ format: 'tav-browser-capture', version: 1, id: randomUUID(), reality: 'synthetic', author: 'Synthetic engineer',
  source: { url: 'https://example.invalid/revisions/camera', title: 'Synthetic calibration page', observedAt: time },
  field: { id: 'camera.calibration', component: 'Camera', name: 'Calibration revision', value: 'C17' } });
const workspace = () => addRobot({ ...emptyBundle(), synthetic: true }, { id: 'arm', name: 'Synthetic arm', task: 'Synthetic test' });

test('cross-site references strip credentials, query and fragment; restricted schemes and store pages fail closed', () => {
  for (const host of ['example.invalid', 'cad.example.invalid', 'localhost:3000']) {
    assert.equal(pageReference(`https://user:password@${host}/revision?token=private#fragment`), `https://${host}/revision`);
  }
  for (const url of ['chrome://settings', 'file:///private/export', 'javascript:alert(1)', 'data:text/html,hello', 'https://chromewebstore.google.com/detail/x', 'https://chrome.google.com/webstore/detail/x', 'not a URL', undefined]) assert.throws(() => pageReference(url));
});

test('strict capture envelope rejects unexpected fields, malformed values, private URL decorations and oversized input', () => {
  const changes = [x => x.extra = 'raw body', x => x.source.html = '<script>', x => x.field.value = ['C18'], x => x.reality = true,
    x => x.source.observedAt = '2026-02-30T00:00:00Z', x => x.id = '../capture', x => x.field.id = '__proto__',
    x => x.field.name = 'API key', x => x.source.url += '?secret=abc', x => x.source.url = 'https://a:b@example.invalid/',
    x => x.field.value = 'x'.repeat(513), x => x.author = '', x => x.field.value = 'line\nbreak', x => x.version = '1'];
  for (const change of changes) { const capture = fixture(); change(capture); assert.throws(() => parseCapture(JSON.stringify(capture))); }
  assert.throws(() => parseCapture(' '.repeat(16385)), /16 KiB/);
  assert.throws(() => parseCapture('{'), /invalid JSON/);
});

test('browser captures preserve source and reported author, keep core fields unknown and compare stable versions across exact runs', () => {
  const first = fixture(), raw = JSON.stringify(first);
  const imported = addBrowserCapture(workspace(), raw, 'arm', recordedAt);
  const snap = imported.bundle.records.snapshots[0];
  assert.equal(snap.custom[0].provenance.evidence, first.source.url);
  assert.equal(snap.custom[0].provenance.observedAt, time);
  assert.equal(snap.custom[0].provenance.recordedAt, recordedAt);
  assert.equal(snap.custom[0].provenance.author, first.author);
  assert.equal(snap.custom[0].provenance.available, false);
  assert.match(snap.custom[0].provenance.method, /Engineer-entered/);
  assert.ok(Object.values(snap.values).every(field => field.state === 'unknown'));
  const withRun = addRun(imported.bundle, { id: 'pass', robotId: 'arm', snapshotId: imported.snapshotId, snapshotRevision: 1, at: recordedAt, outcome: 'success' });
  const prior = exportBundle(withRun);
  const second = fixture(); second.field.value = 'C18';
  const next = addBrowserCapture(withRun, JSON.stringify(second), 'arm', recordedAt).bundle;
  assert.equal(exportBundle(withRun), prior);
  assert.deepEqual(next.records.runs, withRun.records.runs);
  assert.equal(compareCustom(next.records.snapshots[0], next.records.snapshots[1]).rows[0].result, 'Changed');
  assert.deepEqual(parseBundle(exportBundle(next)), next);
  assert.equal(next.mappings.length, 1);
});

test('duplicate capture is idempotent but reassigned, altered and mixed-reality imports cannot rewrite history', () => {
  const capture = fixture(), raw = JSON.stringify(capture);
  const first = addBrowserCapture(workspace(), raw, 'arm', recordedAt);
  const retry = addBrowserCapture(first.bundle, raw, 'arm', '2026-11-17T11:00:00Z');
  assert.equal(retry.bundle, first.bundle); assert.equal(retry.duplicate, true);
  for (const change of [x => x.field.value = 'C18', x => x.source.title = 'Other', x => x.author = 'Other', x => x.source.observedAt = recordedAt]) {
    const altered = structuredClone(capture); change(altered);
    assert.throws(() => addBrowserCapture(first.bundle, JSON.stringify(altered), 'arm', recordedAt), /already exists/);
  }
  const other = addRobot(first.bundle, { id: 'other', name: 'Other synthetic arm', task: 'Synthetic test' });
  assert.throws(() => addBrowserCapture(other, raw, 'other', recordedAt), /different robot/);
  assert.throws(() => addBrowserCapture({ ...workspace(), synthetic: false }, raw, 'arm', recordedAt), /separate/);
  assert.throws(() => addBrowserCapture(workspace(), raw, 'missing', recordedAt), /select a robot/);
  assert.throws(() => addBrowserCapture(workspace(), raw, 'arm', '2026-11-16T00:00:00Z'), /time order/);
  const renamed = fixture(); renamed.field.name = 'Different meaning';
  assert.throws(() => addBrowserCapture(first.bundle, JSON.stringify(renamed), 'arm', recordedAt), /saved mapping differs/);
});

test('distribution matches reviewed source and requests only temporary tab and download permissions', () => {
  const manifest = JSON.parse(readFileSync('extensions/chrome/manifest.json', 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['activeTab', 'downloads']);
  for (const key of ['host_permissions', 'content_scripts', 'background', 'externally_connectable', 'web_accessible_resources']) assert.equal(manifest[key], undefined);
  assert.match(manifest.content_security_policy.extension_pages, /connect-src 'none'/);
  execFileSync(process.execPath, ['scripts/package-extension.mjs', '--check']);
});

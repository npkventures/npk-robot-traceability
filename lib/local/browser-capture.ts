import { parseCapture } from '../../extensions/chrome/capture.mjs';
import { addMappedSnapshot, parseBundle, exportBundle, validateBundle } from './records.ts';
import type { Bundle } from './records.ts';
import type { Mapping } from './custom.ts';

export { parseCapture };
export type BrowserCapture = {
  format: 'tav-browser-capture'; version: 1; id: string; reality: 'real' | 'synthetic'; author: string;
  source: { url: string; title: string; observedAt: string };
  field: { id: string; component: string; name: string; value: string };
};

export function addBrowserCapture(bundle: Bundle, raw: string, robotId: string, recordedAt: string): { bundle: Bundle; snapshotId: string; duplicate: boolean } {
  validateBundle(bundle);
  const capture = parseCapture(raw) as BrowserCapture;
  if (bundle.synthetic !== (capture.reality === 'synthetic')) throw new Error('Chrome capture: synthetic and real records must stay in separate workspaces.');
  if (!bundle.records.robots.some(robot => robot.id === robotId)) throw new Error('Chrome capture: select a robot first.');
  const snapshotId = `browser-${capture.id}`;
  const fieldId = `browser.${capture.field.id}`;
  const provenance = { source: `Tav Chrome capture: ${capture.source.title}`, author: capture.author,
    observedAt: capture.source.observedAt, recordedAt, evidence: capture.source.url,
    method: 'Engineer-entered browser metadata; page reference only; physical state unverified', available: false };
  const existing = bundle.records.snapshots.find(snapshot => snapshot.id === snapshotId && snapshot.revision === 1);
  if (existing) {
    const field = existing.custom?.[0];
    if (existing.robotId !== robotId || existing.custom?.length !== 1 || !field ||
        field.id !== fieldId || field.component !== capture.field.component || field.name !== capture.field.name ||
        field.value.state !== 'known' || field.value.value !== capture.field.value ||
        field.provenance.source !== provenance.source || field.provenance.author !== provenance.author ||
        field.provenance.observedAt !== provenance.observedAt || field.provenance.evidence !== provenance.evidence ||
        field.provenance.method !== provenance.method) throw new Error('Chrome capture: this capture ID already exists with different contents or a different robot.');
    return { bundle, snapshotId, duplicate: true };
  }
  const mapping: Mapping = { id: fieldId, name: 'Chrome capture', format: 'json', fields: [
    { id: fieldId, component: capture.field.component, name: capture.field.name, type: 'text', unit: '', category: 'configuration', source: '/value' }
  ] };
  const next = addMappedSnapshot(bundle, { id: snapshotId, robotId, mapping,
    document: { format: 'json', rows: [{ value: capture.field.value }], candidates: [] }, row: 0, provenance });
  next.records.snapshots.at(-1)!.custom![0].provenance = provenance;
  return { bundle: parseBundle(exportBundle(next)), snapshotId, duplicate: false };
}

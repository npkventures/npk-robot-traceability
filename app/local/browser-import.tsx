'use client';

import { useState } from 'react';
import { addBrowserCapture, parseCapture } from '../../lib/local/browser-capture';
import type { BrowserCapture } from '../../lib/local/browser-capture';
import type { Bundle } from '../../lib/local/records';
import { MAX_CAPTURE_BYTES } from '../../extensions/chrome/capture.mjs';

export default function BrowserImport({ bundle, robotId, save }: { bundle: Bundle; robotId: string; save: (bundle: Bundle, id: string) => void }) {
  const [raw, setRaw] = useState('');
  const [capture, setCapture] = useState<BrowserCapture>();
  const [error, setError] = useState('');
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  return <details className="local-details"><summary>Import Chrome capture</summary>
    <p>Bring a reviewed page reference and component version from the Tav Chrome extension. Select a robot, open the capture JSON, then confirm the snapshot. Page references are not fetched or independently verified.</p>
    {!robotId ? <p>Select or add a robot first.</p> : <fieldset disabled={busy}><legend>Chrome capture import</legend>
      <label className="local-file">Chrome capture file<input type="file" accept=".json,application/json" onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = ''; setCapture(undefined); setRaw(''); setError(''); setApproved(false);
        if (!file) return;
        setBusy(true);
        try { if (file.size > MAX_CAPTURE_BYTES) throw new Error('Maximum capture size is 16 KiB.'); const text = await file.text(); const value = parseCapture(text) as BrowserCapture; setRaw(text); setCapture(value); }
        catch (e) { setError(e instanceof Error ? e.message : 'Unable to read capture.'); }
        finally { setBusy(false); }
      }} /></label>
      {capture && <><h3>Review browser metadata</h3><dl className="local-provenance">
        <dt>Robot</dt><dd>{robotId}</dd><dt>Record type</dt><dd>{capture.reality}</dd>
        <dt>Page label</dt><dd>{capture.source.title}</dd><dt>Page reference</dt><dd>{capture.source.url}</dd>
        <dt>Reported author</dt><dd>{capture.author}</dd><dt>Page observed at</dt><dd>{capture.source.observedAt}</dd>
        <dt>Component / field</dt><dd>{capture.field.component} / {capture.field.name}</dd><dt>Stable field ID</dt><dd>{capture.field.id}</dd><dt>Recorded value</dt><dd>{capture.field.value}</dd>
      </dl><p>Engineer-entered metadata. Physical hardware is unverified; other configuration fields remain unknown. This creates a new snapshot, not a test outcome. Use the same stable field ID and labels in later captures to compare versions.</p>
        <label className="local-check"><input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} />I approve this metadata for the selected robot.</label>
        <button type="button" className="local-primary" disabled={!approved} onClick={() => {
          try { const result = addBrowserCapture(bundle, raw, robotId, new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')); save(result.bundle, result.snapshotId); setCapture(undefined); setRaw(''); setApproved(false); setError(''); }
          catch (e) { setError(e instanceof Error ? e.message : 'Unable to add capture.'); }
        }}>Add browser snapshot</button>
      </>}
      {error && <p role="alert" className="local-error">{error}</p>}
    </fieldset>}
  </details>;
}

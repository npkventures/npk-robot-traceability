import { pageReference, utcNow, validateCapture } from './capture.mjs';

const element = id => document.getElementById(id);
let observedAt;
let captureId = crypto.randomUUID();
const report = message => { element('error').textContent = message; element('error').focus(); };

try {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  element('url').value = pageReference(tab?.url);
  element('title').value = (tab?.title || 'Page reference').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 120);
  observedAt = utcNow();
  element('observed').textContent = observedAt;
  element('fields').disabled = false;
  element('status').textContent = 'Review the reference and enter the version you want to record.';
} catch {
  element('status').textContent = 'This page is unavailable.';
  report('Open an ordinary HTTP or HTTPS website, then click Tav again. Browser settings, extension pages, the Chrome Web Store and local files are not supported.');
}

element('capture-form').addEventListener('input', () => {
  element('approved').checked = false;
  captureId = crypto.randomUUID();
});
// Checkbox changes must not reset their own approval.
element('approved').addEventListener('input', event => event.stopPropagation());

element('capture-form').addEventListener('submit', async event => {
  event.preventDefault();
  element('error').textContent = '';
  if (!element('approved').checked || !observedAt) return;
  let url;
  element('fields').disabled = true;
  try {
    const capture = validateCapture({ format: 'tav-browser-capture', version: 1, id: captureId,
      reality: element('reality').value, author: element('author').value.trim(),
      source: { url: element('url').value.trim(), title: element('title').value.trim(), observedAt },
      field: { id: element('field-id').value.trim(), component: element('component').value.trim(), name: element('name').value.trim(), value: element('value').value.trim() } });
    url = URL.createObjectURL(new Blob([JSON.stringify(capture, null, 2)], { type: 'application/json' }));
    await chrome.downloads.download({ url, filename: `tav-browser-${capture.id}.json`, saveAs: true, conflictAction: 'uniquify' });
    element('status').textContent = 'Download requested. Verify it saved, then use Import Chrome capture in Tav. Nothing was uploaded.';
  } catch (error) {
    report(error instanceof Error && error.message.startsWith('Chrome capture:') ? error.message : 'The download could not start. Keep this popup open and try again.');
  } finally {
    element('fields').disabled = false;
    if (url) setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
});

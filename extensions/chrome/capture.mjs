// Shared by the popup and Tav importer. No page HTML, scripts or credentials.
export const MAX_CAPTURE_BYTES = 16384;
export const utcNow = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

function fail(message) { throw new Error(`Chrome capture: ${message}`); }
function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) fail('unexpected or missing fields.');
}
function text(value, max, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) fail(`${label} must be nonempty text, at most ${max} characters, without control characters.`);
}

export function pageReference(raw) {
  let url;
  try { url = new URL(raw); } catch { fail('open an ordinary HTTP or HTTPS website first.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.hostname === 'chromewebstore.google.com' ||
      url.hostname === 'chrome.google.com' && url.pathname.startsWith('/webstore')) fail('this browser or store page is not supported. Open an ordinary HTTP or HTTPS website.');
  url.username = ''; url.password = ''; url.search = ''; url.hash = '';
  const result = url.href;
  text(result, 512, 'Page reference');
  return result;
}

export function validateCapture(capture) {
  object(capture, ['format', 'version', 'id', 'reality', 'author', 'source', 'field']);
  if (capture.format !== 'tav-browser-capture' || capture.version !== 1) fail('expected a Tav browser capture, version 1.');
  if (typeof capture.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(capture.id)) fail('invalid capture identity.');
  if (!['real', 'synthetic'].includes(capture.reality)) fail('choose real or synthetic records.');
  text(capture.author, 120, 'Author');
  object(capture.source, ['url', 'title', 'observedAt']);
  text(capture.source.url, 512, 'Page reference');
  if (pageReference(capture.source.url) !== capture.source.url) fail('remove URL credentials, query parameters and fragments.');
  text(capture.source.title, 120, 'Page label');
  const time = capture.source.observedAt;
  if (typeof time !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(time) ||
      !Number.isFinite(Date.parse(time)) || new Date(time).toISOString().replace('.000Z', 'Z') !== time) fail('invalid page observation time.');
  object(capture.field, ['id', 'component', 'name', 'value']);
  if (typeof capture.field.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(capture.field.id)) fail('field ID needs 1–80 letters, digits, dots, underscores or hyphens.');
  text(capture.field.component, 120, 'Component');
  text(capture.field.name, 120, 'Field name');
  text(capture.field.value, 512, 'Recorded value');
  if (/(password|secret|credential|private.?key|api.?key|token|source.?code|raw.?data|recording)/i.test(`${capture.field.id} ${capture.field.name}`)) fail('record approved version metadata, not sensitive fields.');
  return capture;
}

export function parseCapture(raw) {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > MAX_CAPTURE_BYTES) fail('maximum capture size is 16 KiB.');
  let capture;
  try { capture = JSON.parse(raw); } catch { fail('invalid JSON.'); }
  return validateCapture(capture);
}

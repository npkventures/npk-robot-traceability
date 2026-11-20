'use client';

let user = '';
let generation = 0;
let renewal: Promise<boolean> | null = null;
export const accountChannelId = typeof window === 'undefined' ? '' : crypto.randomUUID();
export function bindAccount(id: string) { if (id !== user) { user = id; generation++; } }
export function discardRequests() { generation++; }
export function announceAccountChange() {
  const channel = new BroadcastChannel('tavrik-account');
  channel.postMessage({ source: accountChannelId }); channel.close();
}
export async function workspaceApi(path: string, body?: unknown) {
  const started = generation;
  const account = user;
  const assertCurrent = () => { if (started !== generation && !['status', 'auth-options'].includes(path)) throw new Error('Account or workspace changed. Reopen the current team.'); };
  const send = () => fetch(`/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST', cache: 'no-store',
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(account ? { 'X-Tavrik-Account': account } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let response = await send();
  if (response.status === 401 && !['logout', 'auth-session'].includes(path)) {
    renewal ??= fetch('/api/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', cache: 'no-store' }).then(r => r.ok).catch(() => false).finally(() => { renewal = null; });
    if (await renewal) { assertCurrent(); response = await send(); }
  }
  assertCurrent();
  const data = await response.json();
  assertCurrent();
  if (!response.ok) {
    if ((response.status === 401 && account) || (response.status === 403 && path.startsWith('org/'))) {
      generation++;
      window.dispatchEvent(new CustomEvent('tavrik-access-lost', { detail: { expired: response.status === 401, message: data.error } }));
    }
    throw new Error(data.error || 'Request failed.');
  }
  return data;
}

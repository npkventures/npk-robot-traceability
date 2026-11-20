// Notifications contain only publication watermarks. Records are fetched through
// their independently authorized endpoints. Each tick rechecks current access.
export function portalStream(check: () => Promise<string>, signal: AbortSignal, interval = 5000) {
  let stopped = false, ticks = 0, timer: ReturnType<typeof setTimeout> | undefined;
  let wake: (() => void) | undefined;
  let streamController: ReadableStreamDefaultController<Uint8Array>;
  const stop = () => { stopped = true; clearTimeout(timer); wake?.(); };
  const cleanup = () => { stop(); signal.removeEventListener('abort', abort); };
  const abort = () => {
    if (stopped) return;
    cleanup(); streamController.close();
  };
  return new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    },
    async pull(controller) {
      if (stopped) return;
      if (ticks++) await new Promise<void>(resolve => { wake = resolve; timer = setTimeout(resolve, interval); });
      if (stopped) return;
      try {
        const revision = await check();
        if (stopped) return;
        controller.enqueue(new TextEncoder().encode(`event: checked\ndata: ${JSON.stringify({ revision, checkedAt: new Date().toISOString() })}\n\n`));
        // Bound requests so session renewal and hosting timeouts can recover.
        if (ticks >= 5) { cleanup(); controller.close(); }
      } catch {
        if (stopped) return;
        if (!stopped) {
          controller.enqueue(new TextEncoder().encode('event: unavailable\ndata: {}\n\n'));
          cleanup(); controller.close();
        }
      }
    },
    cancel() { cleanup(); },
  });
}

'use client';
import { useEffect, useState } from 'react';

// The server remains the authority. This probe changes only the navigation label.
export default function ProductEntry() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    // Preserve older email links that returned to the homepage. Fragments never reach the server.
    const fragment = new URLSearchParams(location.hash.slice(1));
    if (fragment.has('access_token') || fragment.has('error')) {
      location.replace('/login' + location.hash);
      return () => controller.abort();
    }
    void fetch('/api/session', { cache: 'no-store', signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setSignedIn(response.ok); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return <><a className="m-product-link t-account-entry" href={signedIn ? '/app' : '/login'}>{signedIn ? 'Open workspace' : 'Sign in'} <span aria-hidden="true">↗</span></a>{!signedIn && <a className="m-product-link" href="/login?mode=signup">Get started</a>}<a className="m-product-link" href="/demo">Explore demo</a></>;
}

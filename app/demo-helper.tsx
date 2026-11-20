import Link from 'next/link';

// Native disclosure: usable without JavaScript; no chat, tracking, or data capture.
export default function DemoHelper({ href }: { href: string }) {
  return <details className="t-helper"><summary aria-label="Tav demo and contact"><span className="t-thinking" aria-hidden="true"><i /><i /><i /></span><span>Meet Tav</span><span className="t-helper-plus" aria-hidden="true">+</span></summary><div className="t-helper-panel"><span className="t-eyebrow">A good place to start</span><h2>Curious about Tav?</h2><p>Explore an example or talk through your workflow with the founders.</p><a className="t-button" href={href}>Book a demo ↗</a><Link href="/demo/">Explore the synthetic demo →</Link><small>Demo &amp; contact guide · Not a live chat</small></div></details>;
}

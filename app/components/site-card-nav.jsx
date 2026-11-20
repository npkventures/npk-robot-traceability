'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import CardNav from './CardNav';

export function SiteCardNav({ bookingHref, productEntry, active }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const items = [
    { label: 'Product', description: 'Start with the record.', links: [{ label: 'Home', href: '/' }, { label: 'Services', href: '/services/' }, { label: 'Run comparison', href: '/services/run-comparison/' }] },
    { label: 'For your team', description: 'See how the pieces connect.', links: [{ label: 'Sectors', href: '/sectors/' }, { label: 'Product walkthrough', href: '/walkthrough/' }, { label: 'Book a demo', href: bookingHref }] },
    { label: 'Meet Tavrik', description: 'A direct line to the founders.', links: [{ label: 'About', href: '/about/' }, { label: 'Contact', href: '/contact/' }, { label: 'Security & data handling', href: '/security/' }] },
  ];
  for (const item of items) for (const link of item.links) link.current = link.label === active;
  return <header className="t-card-header m-wrap">
    {ready ? <CardNav logo={<strong className="t-card-brand">Tavrik ↗</strong>} logoAlt="Tavrik home" logoHref="/" theme="light" surface="solid" items={items} cta={{ label: 'Open product', href: '/app' }} maxWidth={1160} cardHeight={210} intro={false} bounce={0} ariaLabel="Main navigation" linkComponent={Link} /> : <nav className="t-nav-fallback" aria-label="Main navigation"><Link href="/">Tavrik</Link>{items.flatMap(item => item.links).map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}<a href={bookingHref}>Book a demo</a></nav>}
    <div className="t-card-account">{productEntry}</div>
  </header>;
}

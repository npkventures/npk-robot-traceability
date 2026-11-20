'use client';

import { useEffect, useState } from 'react';
import LogoLoop from './LogoLoop';
import AnimatedContent from './AnimatedContent';
import { CircularCarousel } from './circular-carousel';

const offerings = [
  { id: 'record', tag: '01 / Record', title: 'Configuration history', description: 'Keep hardware, software, model and calibration versions attached to the exact test that used them.', href: '/services/configuration-history/' },
  { id: 'compare', tag: '02 / Compare', title: 'Run comparison', description: 'Choose a successful baseline. Inspect recorded differences and see where evidence is missing.', href: '/services/run-comparison/' },
  { id: 'review', tag: '03 / Review', title: 'Batch failure review', description: 'Review loaded failures together in the local/private workspace. Find repeated recorded transitions and earlier engineer findings.', href: '/walkthrough/#team-review' },
  { id: 'investigate', tag: '04 / Investigate', title: 'Evidence & findings', description: 'Keep hypotheses, notes, retest references and engineer-confirmed conclusions with their revision history.', href: '/walkthrough/#team-review' },
  { id: 'capture', tag: '05 / Capture', title: 'Approved metadata', description: 'Bring approved JSON/CSV metadata and collector captures into the record. Review fields before saving.', href: '/walkthrough/#developer-tools' },
  { id: 'handoff', tag: '06 / Share', title: 'Investigation handoffs', description: 'Export comparisons, evidence gaps and exact run references so teammates can pick up the investigation.', href: '/walkthrough/#team-review' },
];

export function OfferingsCarousel() {
  return <AnimatedContent distance={70} duration={0.85} scale={0.94} animateOpacity={false} data-animated-content><CircularCarousel items={offerings} /></AnimatedContent>;
}

const tools = [
  { name: 'GitHub', label: 'Sign-in activation pending', href: 'https://github.com/', color: '#24292f', icon: '/brands/github.svg' },
  { name: 'Python', label: 'Local collector', href: 'https://www.python.org/', color: '#346284', icon: '/brands/python.svg' },
  { name: 'Onshape', label: 'Connector · activation pending', href: 'https://www.onshape.com/', color: '#296239', icon: '/brands/onshape.png' },
];
function ToolMark({ tool }) {
  return <span className="t-tool-wordmark"><span className="t-tool-identity"><img src={tool.icon} alt="" width={44} height={44} draggable={false} /><strong>{tool.name}</strong></span></span>;
}
const logos = tools.map(tool => ({ node: <ToolMark tool={tool} />, title: `${tool.name}: ${tool.label}`, href: tool.href, hoverColor: tool.color }));

export function DeveloperTools() {
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update(); setReady(true);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return <AnimatedContent className="t-developer-tools" distance={55} duration={0.8} animateOpacity={false} data-animated-content>
    {ready && !reduced ? <LogoLoop logos={logos} speed={65} direction="left" logoHeight={44} gap={85} pauseOnHover={false} scaleOnHover={false} intro={false} ariaLabel="Developer tools and connection status" /> : <ul className="t-tools-static">{tools.map(tool => <li key={tool.name}><a href={tool.href} target="_blank" rel="noreferrer noopener"><ToolMark tool={tool} /></a></li>)}</ul>}
  </AnimatedContent>;
}



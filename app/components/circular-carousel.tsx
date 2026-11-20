'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useMotionValueEvent, useTransform, type MotionValue, type AnimationPlaybackControls } from 'motion/react';

export type CarouselItem = { id: string; title: string; description: string; tag: string; href: string };
const wrap = (value: number, count: number) => ((((value + count / 2) % count) + count) % count) - count / 2;
const round = (value: number) => Math.round(value * 1000) / 1000;

function WheelCard({ item, index, count, position, pick }: { item: CarouselItem; index: number; count: number; position: MotionValue<number>; pick: () => void }) {
  const offset = useTransform(() => wrap(index - position.get(), count));
  const x = useTransform(() => round(300 * Math.sin(offset.get() * 27 * Math.PI / 180)));
  const y = useTransform(() => round(300 * (1 - Math.cos(offset.get() * 27 * Math.PI / 180))));
  const rotate = useTransform(() => round(offset.get() * 27));
  const scale = useTransform(() => round(1 - Math.min(2.5, Math.abs(offset.get())) * 0.07));
  const visibility = useTransform(() => Math.abs(offset.get()) > 1.7 ? 'hidden' : 'visible');
  const zIndex = useTransform(() => 10 - Math.round(Math.abs(offset.get()) * 2));
  return <motion.div className="t-wheel-card" style={{ x, y, rotate, scale, visibility, zIndex }} aria-hidden="true">
    <button type="button" tabIndex={-1} onClick={pick}><span>{item.tag}</span><strong>{item.title}</strong></button>
  </motion.div>;
}

export function CircularCarousel({ items }: { items: CarouselItem[] }) {
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);
  const position = useMotionValue(0);
  const run = useRef<AnimationPlaybackControls | null>(null);
  const count = items.length;
  useEffect(() => {
    setReady(true);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const settle = () => { run.current?.stop(); position.set(Math.round(position.get())); };
    media.addEventListener('change', settle);
    return () => { run.current?.stop(); media.removeEventListener('change', settle); };
  }, [position]);
  useMotionValueEvent(position, 'change', p => setActive(((Math.round(p) % count) + count) % count));
  const go = (index: number) => {
    run.current?.stop();
    const p = position.get();
    const target = Math.round(p + wrap(index - p, count));
    run.current = animate(position, target, matchMedia('(prefers-reduced-motion: reduce)').matches ? { duration: 0 } : { type: 'spring', stiffness: 150, damping: 24 });
  };
  if (!count) return null;
  return <div className="t-offerings" data-ready={ready}>
    <div className="t-carousel-interactive" role="region" aria-roledescription="carousel" aria-label="Tav capabilities">
      <div className="t-wheel" role="group" tabIndex={0} aria-label="Use left and right arrows to browse capabilities" onKeyDown={event => {
        if (event.key === 'ArrowRight') go(active + 1);
        else if (event.key === 'ArrowLeft') go(active - 1);
        else if (event.key === 'Home') go(0);
        else if (event.key === 'End') go(count - 1);
        else return;
        event.preventDefault();
      }}>
        {items.map((item, index) => <WheelCard key={item.id} item={item} index={index} count={count} position={position} pick={() => go(index)} />)}
        <span className="t-wheel-count" aria-hidden="true">{String(active + 1).padStart(2, '0')} <small>/ {String(count).padStart(2, '0')}</small></span>
      </div>
      <div className="t-wheel-controls">
        <button type="button" onClick={() => go(active - 1)} aria-label="Previous capability">←</button>
        <div role="group" aria-label="Choose capability">{items.map((item, index) => <button key={item.id} type="button" aria-label={`Show ${item.title}`} aria-current={index === active ? 'true' : undefined} onClick={() => go(index)}><span /></button>)}</div>
        <button type="button" onClick={() => go(active + 1)} aria-label="Next capability">→</button>
      </div>
      <div className="t-offering-detail" aria-live="polite" aria-atomic="true"><p className="t-eyebrow">{items[active].tag}</p><h3>{items[active].title}</h3><p>{items[active].description}</p><Link href={items[active].href}>Explore {items[active].title.toLowerCase()} <span aria-hidden="true">↗</span></Link></div>
    </div>
    <div className="t-offerings-fallback">{items.map(item => <article key={item.id}><h3>{item.title}</h3><p>{item.description}</p><Link href={item.href}>Explore {item.title.toLowerCase()}</Link></article>)}</div>
  </div>;
}

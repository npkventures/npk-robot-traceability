"use client";

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SonarGridProps extends React.ComponentProps<'div'> {
  spacing?: number;
  dotRadius?: number;
  baseOpacity?: number;
  color?: string;
  pingEvery?: number;
  speed?: number;
  ringWidth?: number;
  amplitude?: number;
  interactive?: boolean;
  maxRings?: number;
  seedPing?: boolean;
  pingArea?: [number, number, number, number];
  paused?: boolean;
}
interface Ring { x: number; y: number; born: number }
const AREA: [number, number, number, number] = [.15, .2, .85, .8];
const bounded = (value: number, fallback: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

/** Supplied SonarGrid, adapted with bounded inputs and an explicit pause control. */
export function SonarGrid({ spacing = 26, dotRadius = 1.4, baseOpacity = .28,
  color, pingEvery = 2.4, speed = 260, ringWidth = 90, amplitude = 2.2,
  interactive = true, maxRings = 6, seedPing = true, pingArea = AREA, paused = false,
  className, children, ref, ...rest }: SonarGridProps) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  React.useImperativeHandle(ref, () => hostRef.current!, []);
  const refresh = React.useRef<() => void>(() => {});
  const options = React.useMemo(() => ({
    spacing: bounded(spacing, 26, 8, 300), dotRadius: bounded(dotRadius, 1.4, 0, 10),
    baseOpacity: bounded(baseOpacity, .28, 0, 1), pingEvery: bounded(pingEvery, 2.4, 0, 3600),
    speed: bounded(speed, 260, 1, 2000), ringWidth: bounded(ringWidth, 90, 1, 500),
    amplitude: bounded(amplitude, 2.2, 0, 8), maxRings: Math.floor(bounded(maxRings, 6, 0, 32)),
    interactive, seedPing, paused,
    pingArea: pingArea.map((v, i) => bounded(v, AREA[i], 0, 1)),
  }), [spacing, dotRadius, baseOpacity, pingEvery, speed, ringWidth, amplitude, maxRings, interactive, seedPing, paused, pingArea]);
  const opts = React.useRef(options);

  React.useEffect(() => { opts.current = options; refresh.current(); }, [options, color, className]);
  React.useEffect(() => {
    const host = hostRef.current, canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    let width = 1, height = 1, raf = 0, timer = 0, visible = true, seeded = false;
    let rings: Ring[] = [];
    let stroke = getComputedStyle(canvas).color;
    let nextPing = performance.now() + opts.current.pingEvery * 1000;
    const still = () => reduce.matches || opts.current.paused;
    const stop = () => { cancelAnimationFrame(raf); clearTimeout(timer); raf = timer = 0; };
    const add = (x: number, y: number, born: number) => {
      rings.push({ x, y, born });
      rings = rings.slice(-Math.max(1, opts.current.maxRings));
      if (!opts.current.maxRings) rings = [];
    };
    const draw = (now: number) => {
      const o = opts.current;
      const lifetime = (Math.hypot(width, height) + o.ringWidth) / o.speed;
      rings = still() ? [] : rings.filter(r => (now - r.born) / 1000 < lifetime).slice(-Math.max(1, o.maxRings));
      if (!o.maxRings) rings = [];
      const live = rings.map(r => ({ ...r, radius: (now - r.born) / 1000 * o.speed, fade: 1 - (now - r.born) / 1000 / lifetime }));
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = stroke;
      const cols = Math.ceil(width / o.spacing) + 1, rows = Math.ceil(height / o.spacing) + 1;
      const ox = (width - (cols - 1) * o.spacing) / 2, oy = (height - (rows - 1) * o.spacing) / 2;
      const hot: number[] = [];
      ctx.globalAlpha = o.baseOpacity;
      ctx.beginPath();
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const x = ox + i * o.spacing, y = oy + j * o.spacing;
        let energy = 0;
        for (const r of live) {
          const dist = Math.abs(Math.hypot(x - r.x, y - r.y) - r.radius);
          if (dist >= o.ringWidth) continue;
          const t = 1 - dist / o.ringWidth;
          energy = Math.max(energy, t * t * (3 - 2 * t) * r.fade);
        }
        if (energy < .01) { ctx.moveTo(x + o.dotRadius, y); ctx.arc(x, y, o.dotRadius, 0, Math.PI * 2); }
        else hot.push(x, y, energy);
      }
      ctx.fill();
      for (let i = 0; i < hot.length; i += 3) {
        ctx.globalAlpha = o.baseOpacity + (1 - o.baseOpacity) * hot[i + 2];
        ctx.beginPath();
        ctx.arc(hot[i], hot[i + 1], o.dotRadius * (1 + o.amplitude * hot[i + 2]), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    const tick = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const o = opts.current;
      if (still()) { draw(now); return; }
      if (o.pingEvery > 0 && o.maxRings > 0 && now >= nextPing) {
        const [x0, y0, x1, y1] = o.pingArea;
        add(width * (x0 + Math.random() * (x1 - x0)), height * (y0 + Math.random() * (y1 - y0)), now);
        nextPing = now + Math.max(.1, o.pingEvery) * 1000;
      }
      draw(now);
      if (rings.length) raf = requestAnimationFrame(tick);
      else if (o.pingEvery > 0 && o.maxRings > 0) timer = window.setTimeout(() => { timer = 0; wake(); }, Math.max(16, nextPing - now));
    };
    const wake = () => {
      if (!visible || document.hidden || raf) return;
      clearTimeout(timer); timer = 0;
      raf = requestAnimationFrame(tick);
    };
    const resize = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width)); height = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!seeded && opts.current.seedPing && !still()) {
        const [x0, y0, x1, y1] = opts.current.pingArea;
        add(width * (x0 + (x1 - x0) * .68), height * (y0 + (y1 - y0) * .34), performance.now() - 500);
      }
      seeded = true;
      draw(performance.now()); wake();
    };
    const onDown = (event: PointerEvent) => {
      if (!opts.current.interactive || still() || (event.target instanceof Element && event.target.closest('a,button,input,select,textarea'))) return;
      const rect = host.getBoundingClientRect();
      add(event.clientX - rect.left, event.clientY - rect.top, performance.now()); wake();
    };
    const onVisibility = () => { if (document.hidden) stop(); else wake(); };
    const update = () => {
      stop(); stroke = getComputedStyle(canvas).color;
      nextPing = performance.now() + opts.current.pingEvery * 1000;
      draw(performance.now()); wake();
    };
    refresh.current = update;
    const ro = new ResizeObserver(resize);
    const io = new IntersectionObserver(([entry]) => { visible = entry?.isIntersecting ?? false; if (visible) wake(); else stop(); });
    const mo = new MutationObserver(update);
    resize(); ro.observe(host); io.observe(host);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    host.addEventListener('pointerdown', onDown);
    document.addEventListener('visibilitychange', onVisibility);
    reduce.addEventListener('change', update);
    return () => {
      stop(); rings = []; ro.disconnect(); io.disconnect(); mo.disconnect();
      host.removeEventListener('pointerdown', onDown);
      document.removeEventListener('visibilitychange', onVisibility);
      reduce.removeEventListener('change', update); refresh.current = () => {};
    };
  }, []);
  return <div ref={hostRef} data-slot="sonar-grid" className={cn('relative isolate overflow-hidden', className)} {...rest}>
    <canvas ref={canvasRef} aria-hidden="true" className="text-primary pointer-events-none absolute inset-0 -z-10 size-full" style={color ? { color } : undefined} />
    {children}
  </div>;
}
export default SonarGrid;

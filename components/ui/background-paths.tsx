'use client';
import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';

function FloatingPaths({position,animate}:{position:number;animate:boolean}) {
  return <svg className="absolute inset-0 h-full w-full text-slate-950" viewBox="0 0 696 316" fill="none" aria-hidden="true">
    {Array.from({length:36},(_,i)=><motion.path key={i}
      d={`M-${380-i*5*position} -${189+i*6}C-${380-i*5*position} -${189+i*6} -${312-i*5*position} ${216-i*6} ${152-i*5*position} ${343-i*6}C${616-i*5*position} ${470-i*6} ${684-i*5*position} ${875-i*6} ${684-i*5*position} ${875-i*6}`}
      stroke="currentColor" strokeWidth={0.5+i*0.03} strokeOpacity={Math.min(0.45,0.1+i*0.01)} initial={false}
      animate={animate?{pathLength:1,opacity:[0.3,0.6,0.3],pathOffset:[0,1,0]}:{pathLength:1,opacity:0.3,pathOffset:0}}
      transition={animate?{duration:20+(i%11),repeat:Infinity,ease:'linear'}:{duration:0}} />)}
  </svg>;
}

/** Supplied background-paths reference, adapted to Motion and accessible static rendering. */
export function BackgroundPaths({title='Build faster',decorative=false}:{title?:string;decorative?:boolean}) {
  const reduce=useReducedMotion();
  const [paused,setPaused]=useState(false);
  return <div className={decorative?'account-paths':'relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-white'}>
    <div className="pointer-events-none absolute inset-0" aria-hidden="true"><FloatingPaths position={1} animate={reduce===false&&!paused}/><FloatingPaths position={-1} animate={reduce===false&&!paused}/></div>
    {!decorative && <div className="relative z-10 mx-auto max-w-4xl px-6 text-center"><h1 className="mb-8 text-5xl font-bold tracking-tighter sm:text-7xl">{title.split(' ').map((word,wi)=><span key={wi} className="mr-4 inline-block last:mr-0">{word.split('').map((letter,li)=><motion.span key={li} className="inline-block text-neutral-900" initial={false} animate={{y:0,opacity:1}}>{letter}</motion.span>)}</span>)}</h1><Button asChild variant="outline" size="lg"><a href="/demo">Explore the working demo <span aria-hidden="true">→</span></a></Button></div>}
    <button type="button" className="account-paths-toggle absolute bottom-2 right-4 z-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700" aria-pressed={paused} hidden={reduce===true} onClick={()=>setPaused(!paused)}>{paused?'Play background':'Pause background'}</button>
  </div>;
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView } from 'motion/react';

export function TypingAnimation({ children, duration = 85, loop = true }: { children: string; duration?: number; loop?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const [displayedText, setDisplayedText] = useState(children);
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let timeout: ReturnType<typeof setTimeout>;
    const stop = () => { clearTimeout(timeout); setDisplayedText(children); setTyping(false); };
    const start = () => {
      stop();
      if (!inView || media.matches || document.hidden) return;
      const graphemes = Array.from(children);
      let index = 0;
      setDisplayedText('');
      setTyping(true);
      let deleting = false;
      const type = () => {
        index += deleting ? -1 : 1;
        setDisplayedText(graphemes.slice(0, index).join(''));
        if (index === graphemes.length) {
          setTyping(false);
          if (loop) { deleting = true; timeout = setTimeout(() => { setTyping(true); type(); }, 2200); }
        } else if (index === 0 && deleting) {
          deleting = false; timeout = setTimeout(type, 450);
        } else timeout = setTimeout(type, deleting ? 38 : duration);
      };
      timeout = setTimeout(type, duration);
    };
    start();
    media.addEventListener('change', start);
    document.addEventListener('visibilitychange', start);
    return () => { clearTimeout(timeout); media.removeEventListener('change', start); document.removeEventListener('visibilitychange', start); };
  }, [children, duration, inView, loop]);
  return <span ref={ref} className="t-typewriter">
    <span className="t-sr-only">{children}</span>
    <span className="t-typewriter-space" aria-hidden="true">{children}</span>
    <span className="t-typewriter-text" aria-hidden="true">{displayedText}{typing && <span className="t-typewriter-cursor">|</span>}</span>
  </span>;
}

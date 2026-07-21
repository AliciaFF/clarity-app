import { useEffect, useRef, useState } from 'react';

export function useCountUp(target: number, duration = 600): number {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);
  const raf = useRef<number>(0);

  useEffect(() => {
    const from = prev.current;
    const to = target;
    if (from === to) return;

    const start = performance.now();
    cancelAnimationFrame(raf.current);

    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setDisplay(from + (to - from) * ease);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else { setDisplay(to); prev.current = to; }
    }

    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return display;
}

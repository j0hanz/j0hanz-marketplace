import { useEffect, useState } from 'react';

// ponytail: rAF + easeOut, ~600ms. Good enough for a 3-digit number; for very
// long counts, swap to an integer tween. Marked in the per-call duration.
const DURATION = 600;

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function useCountUp(target: number, delay: number, animate: boolean) {
  const [value, setValue] = useState(animate ? 0 : target);

  useEffect(() => {
    if (!animate) return;
    if (target === 0) return;
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      if (now < start) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const t = Math.min((now - start) / DURATION, 1);
      setValue(Math.round(target * easeOut(t)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, delay, animate]);

  return value;
}

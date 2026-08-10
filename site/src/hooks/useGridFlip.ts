import { useRef } from 'react';
import { Flip, ScrollTrigger, gsap, motionOk, useGSAP } from '../motion';

function killDetachedTriggers() {
  for (const trigger of ScrollTrigger.getAll()) {
    if (trigger.trigger?.isConnected === false) trigger.kill();
  }
}

export function useGridFlip(items: readonly unknown[]) {
  const grid = useRef<HTMLDivElement>(null);
  const previousLayout = useRef<ReturnType<typeof Flip.getState> | null>(null);
  const rendered = useRef(items);

  if (rendered.current !== items) {
    rendered.current = items;
    previousLayout.current =
      grid.current && motionOk() ? Flip.getState(grid.current.children) : null;
  }

  useGSAP(
    () => {
      if (!previousLayout.current) return;
      Flip.from(previousLayout.current, {
        duration: 0.35,
        ease: 'power2.out',
        onEnter: (cards) => gsap.fromTo(cards, { opacity: 0 }, { opacity: 1, duration: 0.3 }),
      });
      previousLayout.current = null;
      killDetachedTriggers();
    },
    { dependencies: [items] },
  );

  return grid;
}

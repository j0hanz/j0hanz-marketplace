import { useRef } from 'react';
import { type FlipClass, ScrollTrigger, gsap, loadFlip, motionOk, useGSAP } from '../motion';

function killGridTriggers(grid: HTMLDivElement) {
  for (const trigger of ScrollTrigger.getAll()) {
    if (trigger.trigger === grid) trigger.kill();
  }
}

export function useGridFlip(items: readonly unknown[]) {
  const grid = useRef<HTMLDivElement>(null);
  const previousLayout = useRef<ReturnType<FlipClass['getState']> | null>(null);
  const flip = useRef<FlipClass | null>(null);

  useGSAP(() => {
    let active = true;
    loadFlip().then((F) => {
      if (!active || !grid.current || !motionOk()) return;
      flip.current = F;
      previousLayout.current = F.getState(grid.current.children);
    });
    return () => {
      active = false;
    };
  });

  useGSAP(
    () => {
      const F = flip.current;
      const prev = previousLayout.current;
      const node = grid.current;
      if (!F || !prev || !node) return;
      F.from(prev, {
        duration: 0.35,
        ease: 'power2.out',
        onEnter: (cards) => gsap.fromTo(cards, { opacity: 0 }, { opacity: 1, duration: 0.3 }),
      });
      previousLayout.current = F.getState(node.children);
      killGridTriggers(node);
    },
    { dependencies: [items] },
  );

  return grid;
}

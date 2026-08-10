import { useRef } from 'react';
import Flip from 'gsap/Flip';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

export function useGridFlip(items: readonly unknown[]) {
  const grid = useRef<HTMLDivElement>(null);
  const previousLayout = useRef<ReturnType<typeof Flip.getState> | null>(null);

  useGSAP(
    () => {
      const node = grid.current;
      if (!node) return;
      previousLayout.current ??= Flip.getState(node.children);
      if (!previousLayout.current) return;
      const prev = previousLayout.current;
      Flip.from(prev, {
        duration: 0.35,
        ease: 'power2.out',
        onEnter: (cards) => gsap.fromTo(cards, { opacity: 0 }, { opacity: 1, duration: 0.3 }),
      });
      previousLayout.current = Flip.getState(node.children);
      for (const trigger of ScrollTrigger.getAll()) if (trigger.trigger === node) trigger.kill();
    },
    { dependencies: [items] },
  );

  return grid;
}

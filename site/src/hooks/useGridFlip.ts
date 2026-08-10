import { useRef } from 'react';
import { type FlipClass, ScrollTrigger, gsap, loadFlip, motionOk, useGSAP } from '../motion';

function killDetachedTriggers() {
  for (const trigger of ScrollTrigger.getAll()) {
    if (trigger.trigger?.isConnected === false) trigger.kill();
  }
}

export function useGridFlip(items: readonly unknown[]) {
  const grid = useRef<HTMLDivElement>(null);
  const previousLayout = useRef<ReturnType<FlipClass['getState']> | null>(null);
  const flip = useRef<FlipClass | null>(null);

  // Prefetch the Flip plugin after first paint so it's ready before the user
  // filters; it ships in its own chunk instead of the initial bundle.
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

  // Animate from the previous grid layout to the current one on filter changes.
  // Reads the ref captured at the end of the previous run, animates old→live,
  // then snapshots the live layout for next time. Runs synchronously before
  // paint so Flip.from interpolates old→new positions rather than snapping.
  useGSAP(
    () => {
      const F = flip.current;
      const prev = previousLayout.current;
      if (!F || !prev || !grid.current) return;
      F.from(prev, {
        duration: 0.35,
        ease: 'power2.out',
        onEnter: (cards) => gsap.fromTo(cards, { opacity: 0 }, { opacity: 1, duration: 0.3 }),
      });
      previousLayout.current = F.getState(grid.current.children);
      killDetachedTriggers();
    },
    { dependencies: [items] },
  );

  return grid;
}

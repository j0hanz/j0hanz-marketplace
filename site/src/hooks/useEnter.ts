import { useEffect } from 'react';

const SELECTOR = '[data-reveal],[data-draw]';

/**
 * Marks reveals and rule draws as they enter view, once each. The start and end
 * states live in index.css; this only decides when. `key` re-runs the pass when
 * the scope's contents change.
 */
export function useEnter(scope: React.RefObject<HTMLElement | null>, key?: unknown) {
  useEffect(() => {
    const root = scope.current;
    if (!root || !document.documentElement.dataset.motion) return;

    const pending = [root, ...root.querySelectorAll<HTMLElement>(SELECTOR)].filter(
      (el) => el.matches(SELECTOR) && el.dataset.shown === undefined,
    );
    if (pending.length === 0) return;

    let queued = 0;
    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          // Reveals crossing in the same tick stagger; a lone latecomer doesn't
          // wait. Draws transition their pseudo-element, which no delay reaches,
          // and never appear as a group anyway.
          if (el.dataset.reveal !== undefined) {
            frame ||= requestAnimationFrame(() => {
              queued = 0;
              frame = 0;
            });
            el.style.transitionDelay = `${Math.min(queued++ * 60, 240)}ms`;
          }
          el.dataset.shown = '';
          observer.unobserve(el);
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    for (const el of pending) observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [scope, key]);
}

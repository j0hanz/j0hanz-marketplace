import { useLayoutEffect } from 'react';

const SELECTOR = '[data-reveal],[data-draw]';

/**
 * Marks reveals and rule draws as they enter view, once each. The start and end
 * states live in index.css; this only decides when. `key` re-runs the pass when
 * the scope's contents change. Runs against layout so the elements are never
 * painted hidden first.
 */
export function useEnter(scope: React.RefObject<HTMLElement | null>, key?: unknown) {
  useLayoutEffect(() => {
    const root = scope.current;
    if (!root || !document.documentElement.dataset.motion) return;

    const pending = [root, ...root.querySelectorAll<HTMLElement>(SELECTOR)].filter(
      (el) => el.dataset.shown === undefined,
    );
    if (pending.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.shown = '';
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    for (const el of pending) observer.observe(el);
    return () => observer.disconnect();
  }, [scope, key]);
}

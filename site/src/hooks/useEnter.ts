import { useLayoutEffect, useRef } from 'react';

const SELECTOR = '[data-reveal],[data-draw]';

// A delay left behind would hold up whatever this element transitions next.
// `transitionend` bubbles, so a card's own rule ending under the pointer reaches
// the reveal wrapper too; only the wrapper's own transition should clear it.
const clearDelay = (event: TransitionEvent) => {
  const el = event.currentTarget as HTMLElement;
  if (event.target !== el) return;
  el.style.transitionDelay = '';
  el.removeEventListener('transitionend', clearDelay);
};

/**
 * Marks reveals and rule draws as they enter view, once each. The start and end
 * states live in index.css; this only decides when. `key` re-runs the pass when
 * the scope's contents change.
 *
 * Only the first pass animates. A later one means the data changed, not that
 * the viewport moved — cards a search put back — so it lands them outright.
 * Runs against layout so they are never painted hidden first.
 */
export function useEnter(scope: React.RefObject<HTMLElement | null>, key?: unknown) {
  const passed = useRef(false);

  useLayoutEffect(() => {
    const root = scope.current;
    if (!root || !document.documentElement.dataset.motion) return;

    const pending = [root, ...root.querySelectorAll<HTMLElement>(SELECTOR)].filter(
      (el) => el.matches(SELECTOR) && el.dataset.shown === undefined,
    );
    if (pending.length === 0) return;

    if (passed.current) {
      // Exempted and shown together, then resolved on the spot: the read forces
      // the style pass that would have started the transition, and with the
      // exemption still applied there is nothing left for it to run on.
      for (const el of pending) {
        el.dataset.instant = '';
        el.dataset.shown = '';
      }
      void getComputedStyle(pending[0]).opacity;
      for (const el of pending) delete el.dataset.instant;
      return;
    }

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
            el.style.transitionDelay = `${Math.min(queued++ * 40, 160)}ms`;
            el.addEventListener('transitionend', clearDelay);
          }
          el.dataset.shown = '';
          observer.unobserve(el);
        }
        // Set here, not next to `observe`: the first delivery lands after the
        // mount StrictMode throws away, so dev still sees the load reveal.
        passed.current = true;
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

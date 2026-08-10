import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const MOTION_QUERY = '(prefers-reduced-motion: no-preference)';

export const motionOk = () => matchMedia(MOTION_QUERY).matches;

export { ScrollTrigger, gsap, useGSAP };

function importFlip() {
  return import('gsap/Flip').then((m) => {
    gsap.registerPlugin(m.Flip);
    return m.Flip;
  });
}

/** Flip plugin class. Type-only — the runtime import is deferred (see loadFlip). */
export type FlipClass = Awaited<ReturnType<typeof importFlip>>;

let flipPromise: ReturnType<typeof importFlip> | null = null;

/**
 * Load + register the Flip plugin on demand; prefetched after first paint. A
 * failed load resets the cache so the next call retries instead of hanging on a
 * rejected promise.
 */
export function loadFlip(): ReturnType<typeof importFlip> {
  flipPromise ??= importFlip().catch((e) => {
    flipPromise = null;
    throw e;
  });
  return flipPromise;
}

type TweenVars = Parameters<typeof gsap.to>[1];

/**
 * Scroll-reveal items matching `selector` inside `scope`. Each batch fades + lifts
 * on first entry. `motionOk()` short-circuits everything; reduced-motion users
 * see static content immediately.
 */
export function useReveal(
  selector: string,
  tween: TweenVars = {},
  scope?: React.RefObject<HTMLElement | null>,
) {
  useGSAP(
    () => {
      if (!motionOk()) return;
      const items = gsap.utils.toArray<HTMLElement>(selector, scope?.current);
      gsap.set(items, { opacity: 0, y: 24 });
      ScrollTrigger.batch(items, {
        start: 'top 88%',
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, { duration: 0.5, stagger: 0.07, ease: 'power2.out', ...tween }),
      });
      // fonts.ready resolves after mount; refresh so item offsets match the loaded font.
      // Guard so the refresh can't fire after the context reverts (StrictMode unmount).
      let mounted = true;
      document.fonts.ready.then(() => {
        if (mounted) ScrollTrigger.refresh();
      });
      return () => {
        mounted = false;
      };
    },
    { scope },
  );
}

/**
 * Stagger-in items matching `selector` inside `scope` on mount. For hero-style
 * entrances where everything animates immediately rather than on scroll.
 */
export function useRevealMount(
  selector: string,
  tween: TweenVars,
  scope?: React.RefObject<HTMLElement | null>,
) {
  useGSAP(
    () => {
      if (!motionOk()) return;
      gsap.from(gsap.utils.toArray<HTMLElement>(selector, scope?.current), tween);
    },
    { scope },
  );
}

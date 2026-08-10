import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const MOTION_QUERY = '(prefers-reduced-motion: no-preference)';
export const motionOk = () => matchMedia(MOTION_QUERY).matches;

type TweenVars = Parameters<typeof gsap.to>[1];

let fontsRefreshed = false;
const refreshAfterFonts = () => {
  if (fontsRefreshed) return;
  fontsRefreshed = true;
  document.fonts.ready.then(() => ScrollTrigger.refresh());
};

/**
 * Scroll-reveal items matching `selector` inside `scope`. Reduced-motion users
 * see static content immediately. Defaults to `opacity: 1, y: 0` on entry;
 * `toVars` lets callers override or extend the to-state.
 */
export function useReveal(
  selector: string,
  toVars: TweenVars = {},
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
          gsap.to(batch, {
            duration: 0.5,
            opacity: 1,
            y: 0,
            stagger: 0.07,
            ease: 'power2.out',
            ...toVars,
          }),
      });
      refreshAfterFonts();
    },
    { scope },
  );
}

/** Mount-reveal: items animate from `tween` start-state immediately on mount. */
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

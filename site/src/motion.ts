import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(useGSAP, ScrollTrigger, Flip);

const MOTION_QUERY = '(prefers-reduced-motion: no-preference)';

export const motionOk = () => matchMedia(MOTION_QUERY).matches;

export { Flip, ScrollTrigger, gsap, useGSAP };

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
      document.fonts.ready.then(() => ScrollTrigger.refresh());
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

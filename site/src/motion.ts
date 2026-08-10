// Motion. GSAP writes its values as inline style, so the reduced-motion rule in the theme —
// which can only reach CSS transitions — never sees any of it. Every animation on the page is
// therefore built inside a `matchMedia` block keyed to the query below: when it does not
// match, nothing is created, and when it stops matching GSAP reverts what it made and leaves
// the page exactly as authored. That is why no animation here has a `reduce` branch.
//
// Nothing animates *into* existence from a hidden CSS state either: the markup renders
// complete, and the start state is applied by GSAP from a layout effect, before paint. A
// failed script leaves a static page, not a blank one.

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Registered once, in the module every animated component already has to import.
gsap.registerPlugin(useGSAP, ScrollTrigger, Flip);

export const MOTION_OK = '(prefers-reduced-motion: no-preference)';

/** For the one animation that starts from an event handler and cannot sit inside matchMedia. */
export const motionOk = () => matchMedia(MOTION_OK).matches;

export { Flip, ScrollTrigger, gsap, useGSAP };

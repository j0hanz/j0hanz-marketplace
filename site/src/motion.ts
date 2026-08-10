import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(useGSAP, ScrollTrigger, Flip);

export const MOTION_OK = '(prefers-reduced-motion: no-preference)';

export const motionOk = () => matchMedia(MOTION_OK).matches;

export { Flip, ScrollTrigger, gsap, useGSAP };

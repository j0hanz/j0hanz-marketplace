import Box from '@mui/material/Box';
import { useRef } from 'react';
import { Catalog } from './components/Catalog';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { Install } from './components/Install';
import { Nav } from './components/Nav';
import { SkillIndex } from './components/SkillIndex';
import { MOTION_OK, ScrollTrigger, gsap, useGSAP } from './motion';
import { steel } from './theme/tokens';

// Parked off the top edge rather than clipped away, so it animates into the same steel
// frame the rest of the chassis uses the moment a keyboard reaches it.
const skipLink = {
  position: 'fixed',
  top: 8,
  left: 8,
  zIndex: 'tooltip',
  px: 2,
  py: 1,
  bgcolor: 'background.paper',
  color: 'text.primary',
  border: `3px solid ${steel}`,
  textDecoration: 'none',
  transform: 'translateY(-300%)',
  transition: 'transform 150ms cubic-bezier(0.23, 1, 0.32, 1)',
  '&:focus-visible': { transform: 'none' },
};

export function App() {
  const main = useRef<HTMLElement>(null);

  // Everything carrying `data-reveal` — section headings, plugin cards, skill rows, install
  // steps — rises the last 24px into place as it reaches the fold. Batched rather than one
  // trigger per element, so a grid row arrives as a row instead of as six unrelated fades,
  // and `once` because arriving is an event, not a state to replay on the way back up.
  //
  // `opacity`, not `autoAlpha`: autoAlpha's `visibility: hidden` takes the subtree out of the
  // accessibility tree, and what waits below the fold here is every section's h2 and the
  // `role="status"` count beside it. A screen reader listing the page's headings would have
  // found none of them. Nothing revealed sits over a control, so there is nothing that needed
  // its pointer events killed in the first place.
  useGSAP(
    () => {
      gsap.matchMedia().add(MOTION_OK, () => {
        const items = gsap.utils.toArray<HTMLElement>('[data-reveal]', main.current);
        gsap.set(items, { opacity: 0, y: 24 });
        ScrollTrigger.batch(items, {
          start: 'top 88%',
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              opacity: 1,
              y: 0,
              duration: 0.5,
              stagger: 0.07,
              ease: 'power2.out',
            }),
        });
        // Start positions are measured against the fallback metrics until JetBrains Mono
        // lands; a heading that reflows after measurement can end up parked past its own
        // trigger and never arrive. The flag is the only thing holding this promise to the
        // lifetime of the block that opened it.
        let live = true;
        document.fonts.ready.then(() => live && ScrollTrigger.refresh());
        return () => {
          live = false;
        };
      });
    },
    { scope: main },
  );

  return (
    <>
      <Box component="a" href="#main" sx={skipLink}>
        Skip to content
      </Box>
      <Nav />
      <main id="main" ref={main}>
        <Hero />
        <Catalog />
        <SkillIndex />
        <Install />
      </main>
      <Footer />
    </>
  );
}

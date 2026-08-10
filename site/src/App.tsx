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

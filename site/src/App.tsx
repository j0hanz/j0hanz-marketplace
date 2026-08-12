import Box from '@mui/material/Box';
import { useEffect } from 'react';
import { useCatalogFilter } from './hooks/useCatalogFilter';
import { Catalog } from './components/Catalog';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { Nav } from './components/Nav';
import { SkillIndex } from './components/SkillIndex';
import { rule } from './theme/tokens';

const skipLink = {
  position: 'fixed',
  top: 8,
  left: 8,
  zIndex: 'tooltip',
  px: 2,
  py: 1,
  bgcolor: 'background.paper',
  color: 'text.primary',
  border: rule,
  textDecoration: 'none',
  transform: 'translateY(-300%)',
  transition: 'transform 150ms var(--ease-out)',
  '&:focus-visible': { transform: 'none' },
};

export function App() {
  // One filter for the page: the search reads skill and agent names, so the
  // index that lists them answers it too rather than sitting whole underneath a
  // grid that just emptied.
  const filter = useCatalogFilter();

  useEffect(() => {
    requestAnimationFrame(() => {
      document.documentElement.dataset.ready = '';
      // The browser resolves the hash against the shell, before the reveals and
      // the open accordion have any height, so a deep link lands short of its
      // section. Re-aim once the real layout exists. getElementById rather than
      // a selector: a hash like `#1` is a valid fragment and an invalid one.
      if (location.hash.length > 1)
        document.getElementById(location.hash.slice(1))?.scrollIntoView();
    });
  }, []);

  return (
    <>
      <Box component="a" href="#main" sx={skipLink}>
        Skip to content
      </Box>
      <Nav />
      <main id="main" tabIndex={-1}>
        <Hero />
        <Catalog filter={filter} />
        <SkillIndex visible={filter.visible} needle={filter.needle} />
      </main>
      <Footer />
    </>
  );
}

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
  const filter = useCatalogFilter();

  useEffect(() => {
    requestAnimationFrame(() => {
      document.documentElement.dataset.ready = '';
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
        <SkillIndex visible={filter.visible} searching={Boolean(filter.needle)} />
      </main>
      <Footer />
    </>
  );
}

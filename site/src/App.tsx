import Box from '@mui/material/Box';
import { useEffect } from 'react';
import { useCatalogFilter } from './hooks/useCatalogFilter';
import { Catalog } from './components/Catalog';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { Nav } from './components/Nav';
import { SkillIndex } from './components/SkillIndex';
import { SkipLink } from './components/SkipLink';

export function App() {
  const filter = useCatalogFilter();

  useEffect(() => {
    requestAnimationFrame(() => {
      document.documentElement.dataset.ready = '';
    });
  }, []);

  return (
    <>
      <SkipLink />
      <Nav />
      <Box component="main" id="main" tabIndex={-1}>
        <Hero />
        <Catalog filter={filter} />
        <SkillIndex visible={filter.visible} searching={Boolean(filter.needle)} />
      </Box>
      <Footer />
    </>
  );
}

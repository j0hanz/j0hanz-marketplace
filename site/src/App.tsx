import Box from '@mui/material/Box';
import { useEffect } from 'react';
import { useCatalogFilter } from './hooks/useCatalogFilter';
import { useClient } from './hooks/useClient';
import { Catalog } from './components/Catalog';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { Nav } from './components/Nav';
import { SkillIndex } from './components/SkillIndex';
import { SkipLink } from './components/SkipLink';

export function App() {
  const [client, setClient] = useClient();
  const filter = useCatalogFilter(client);

  useEffect(() => {
    requestAnimationFrame(() => {
      document.documentElement.dataset['ready'] = '';
    });
  }, []);

  return (
    <>
      <SkipLink />
      <Nav />
      <Box component="main" id="main" tabIndex={-1}>
        <Hero client={client} onClient={setClient} />
        <Catalog filter={filter} client={client} onClient={setClient} />
        <SkillIndex visible={filter.visible} searching={Boolean(filter.needle)} />
      </Box>
      <Footer />
    </>
  );
}

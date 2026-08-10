import Box from '@mui/material/Box';
import { Catalog } from './components/Catalog';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { Install } from './components/Install';
import { Nav } from './components/Nav';
import { SkillIndex } from './components/SkillIndex';
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
  return (
    <>
      <Box component="a" href="#main" sx={skipLink}>
        Skip to content
      </Box>
      <Nav />
      <main id="main">
        <Hero />
        <Catalog />
        <SkillIndex />
        <Install />
      </main>
      <Footer />
    </>
  );
}

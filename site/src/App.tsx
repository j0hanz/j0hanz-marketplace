import Box from '@mui/material/Box';
import { Catalog } from './components/Catalog';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { Install } from './components/Install';
import { Nav } from './components/Nav';
import { SkillIndex } from './components/SkillIndex';
import { copy } from './copy';
import { steel } from './theme';

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
  '&:focus-visible': { transform: 'none' },
};

export function App() {
  return (
    <>
      <Box component="a" href="#main" sx={skipLink}>
        {copy.skipLink}
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

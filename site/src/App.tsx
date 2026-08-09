import { Catalog } from './components/Catalog';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { Install } from './components/Install';
import { Nav } from './components/Nav';
import { SkillIndex } from './components/SkillIndex';

export function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Catalog />
        <SkillIndex />
        <Install />
      </main>
      <Footer />
    </>
  );
}

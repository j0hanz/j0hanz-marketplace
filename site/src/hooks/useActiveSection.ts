import { useEffect, useState } from 'react';
import { scrollOffset } from '../theme/tokens';

/**
 * Tracks which anchor (`#id`) currently sits at the top of the viewport. Returns
 * the empty string when no observed section is on screen.
 */
export function useActiveSection(hrefs: readonly string[]) {
  const [active, setActive] = useState('');

  useEffect(() => {
    const onScreen = new Set<string>();
    const updateActive = () => {
      const inBand = hrefs.findLast((href) => onScreen.has(href));
      if (inBand) {
        setActive(inBand);
        return;
      }
      const atEnd =
        window.scrollY > 0 &&
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      setActive(atEnd ? (hrefs.at(-1) ?? '') : '');
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const href = `#${entry.target.id}`;
          if (entry.isIntersecting) onScreen.add(href);
          else onScreen.delete(href);
        }
        updateActive();
      },
      { rootMargin: `-${scrollOffset}px 0px -60% 0px` },
    );

    for (const href of hrefs) {
      const section = document.querySelector(href);
      if (section) observer.observe(section);
    }
    window.addEventListener('scroll', updateActive, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', updateActive);
    };
  }, [hrefs]);

  return active;
}

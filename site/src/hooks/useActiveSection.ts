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
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const href = `#${entry.target.id}`;
          if (entry.isIntersecting) onScreen.add(href);
          else onScreen.delete(href);
        }
        setActive(hrefs.findLast((href) => onScreen.has(href)) ?? '');
      },
      { rootMargin: `-${scrollOffset}px 0px -60% 0px` },
    );

    for (const href of hrefs) {
      const section = document.querySelector(href);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, [hrefs]);

  return active;
}

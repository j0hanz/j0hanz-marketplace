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
    const pick = () => {
      // Last, not first: at a boundary two sections share the band, and the one
      // you have most recently scrolled into is the lower of the two. Taking the
      // first kept the outgoing section marked while its successor filled the
      // screen. The observer answers whenever it has one, and only the gaps fall
      // through — which is also the only path that reads layout, so an ordinary
      // scroll frame costs a Set lookup rather than a reflow.
      const inBand = hrefs.findLast((href) => onScreen.has(href));
      if (inBand) {
        setActive(inBand);
        return;
      }
      // A short last section runs out of document before it can reach the band,
      // and would stay unmarked while the one above it kept the mark. At the end
      // of a document that scrolls, the end is what you're on — but a page that
      // fits the viewport is at its end from the first frame, and being at the
      // top of it is not the same as having read to the bottom.
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
        pick();
      },
      { rootMargin: `-${scrollOffset}px 0px -60% 0px` },
    );

    for (const href of hrefs) {
      const section = document.querySelector(href);
      if (section) observer.observe(section);
    }
    // Only the end check needs this: the observer fires when the last section
    // leaves the band, which is before the scroll that reaches the bottom.
    window.addEventListener('scroll', pick, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', pick);
    };
  }, [hrefs]);

  return active;
}

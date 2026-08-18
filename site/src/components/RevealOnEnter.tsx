import { useLayoutEffect, useRef, type ReactNode } from 'react';

const SELECTOR = '[data-reveal],[data-draw]';

export function RevealOnEnter({ children, dep }: { children: ReactNode; dep?: unknown }) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = root.current;
    if (!node || !document.documentElement.dataset['motion']) return;

    const pending = [node, ...node.querySelectorAll<HTMLElement>(SELECTOR)].filter(
      (el) => el.dataset['shown'] === undefined,
    );
    if (pending.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset['shown'] = '';
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    for (const el of pending) observer.observe(el);
    return () => observer.disconnect();
  }, [dep]);
  return (
    <div ref={root} style={{ display: 'contents' }}>
      {children}
    </div>
  );
}

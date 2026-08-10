import { useEffect, useMemo, useState } from 'react';
import { copy, plural } from '../copy';
import { site } from '../site';
import type { Plugin } from '../site';

export const ALL = 'all';

/**
 * `site` is a static import, so the haystacks are joined and lowercased once at module load
 * rather than on every keystroke. Hook events are in there too, so a visitor searching
 * "PreToolUse" finds the css plugin instead of silence.
 */
const searchIndex = site.plugins.map((plugin) => ({
  plugin,
  haystack: [
    plugin.displayName,
    plugin.summary,
    plugin.hookEvents.join(' '),
    ...plugin.skills.map((s) => s.name + ' ' + s.description),
    ...plugin.agents.map((a) => a.name + ' ' + a.description),
  ]
    .join(' ')
    .toLowerCase(),
}));

export interface CatalogFilter {
  visible: Plugin[];
  category: string;
  setCategory: (next: string) => void;
  query: string;
  setQuery: (next: string) => void;
  reset: () => void;
  /** Settled label for the count chip — same string on the first render so the live region
   * doesn't announce on mount. */
  announcedCount: string;
}

export function useCatalogFilter(): CatalogFilter {
  // ?cat=<name> makes a filtered catalog a shareable link. An unknown category would
  // otherwise select nothing and render the empty state over a blank search box.
  const [category, setCategory] = useState(() => {
    const initial = new URLSearchParams(window.location.search).get('cat');
    return initial && site.categories.includes(initial) ? initial : ALL;
  });
  const [query, setQuery] = useState('');

  // Write the filter back so the address bar stays copyable. `replaceState` only, so this
  // never stacks history entries a visitor has to press back through to leave the page.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (category === ALL) params.delete('cat');
    else params.set('cat', category);
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`,
    );
  }, [category]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return searchIndex
      .filter(
        ({ plugin, haystack }) =>
          (category === ALL || plugin.category === category) &&
          (!needle || haystack.includes(needle)),
      )
      .map(({ plugin }) => plugin);
  }, [category, query]);

  // The count is a live region, and filtering runs on every keystroke: typing "mcp" would
  // send three announcements for one search. The number on screen still changes per
  // keystroke; only the spoken sentence waits for the typing to stop. Seeded with the
  // first render's label so the settle-on-mount writes the same string and says nothing.
  const [announcedCount, setAnnouncedCount] = useState(() =>
    plural(visible.length, copy.unit.plugin),
  );
  useEffect(() => {
    const next = plural(visible.length, copy.unit.plugin);
    const timer = setTimeout(() => setAnnouncedCount(next), 400);
    return () => clearTimeout(timer);
  }, [visible]);

  return {
    visible,
    category,
    setCategory,
    query,
    setQuery,
    reset: () => {
      setQuery('');
      setCategory(ALL);
    },
    announcedCount,
  };
}

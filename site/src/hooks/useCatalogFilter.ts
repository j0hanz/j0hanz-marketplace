import { useDeferredValue, useMemo, useState } from 'react';
import { site } from '../site';

export const ALL = 'all';

// `site` is a static import, so the haystacks are joined and lowercased once at module load
// rather than on every keystroke. Hook events are in there too, so a visitor searching
// "PreToolUse" finds the css plugin instead of silence.
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

export function useCatalogFilter() {
  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState('');
  // Defer the keystroke so the TextField stays responsive while the filter catches up.
  const deferred = useDeferredValue(query);

  const visible = useMemo(() => {
    const needle = deferred.trim().toLowerCase();
    return searchIndex
      .filter(
        ({ plugin, haystack }) =>
          (category === ALL || plugin.category === category) &&
          (!needle || haystack.includes(needle)),
      )
      .map(({ plugin }) => plugin);
  }, [category, deferred]);

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
  };
}

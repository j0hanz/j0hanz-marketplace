import { useDeferredValue, useMemo, useState } from 'react';
import { type Plugin, site } from '../site';

export const ALL = 'all';

const searchIndex = site.plugins.map((plugin) => ({
  plugin,
  haystack: [
    plugin.displayName,
    plugin.summary,
    plugin.hookEvents.join(' '),
    ...plugin.skills.map((skill) => skill.name + ' ' + skill.description),
    ...plugin.agents.map((agent) => agent.name + ' ' + agent.description),
  ]
    .join(' ')
    .toLowerCase(),
}));

export function useCatalogFilter() {
  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);

  const visible = useMemo(() => {
    const needle = deferred.trim().toLowerCase();
    const result: Plugin[] = [];
    for (const { plugin, haystack } of searchIndex) {
      if (
        (category === ALL || plugin.category === category) &&
        (!needle || haystack.includes(needle))
      ) {
        result.push(plugin);
      }
    }
    return result;
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

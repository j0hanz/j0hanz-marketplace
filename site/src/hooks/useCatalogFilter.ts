import { useDeferredValue, useEffect, useState } from 'react';
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

const param = (key: string) => new URLSearchParams(location.search).get(key);

export function useCatalogFilter() {
  const [category, setCategory] = useState(() => param('category') ?? ALL);
  const [query, setQuery] = useState(() => param('q') ?? '');
  const deferred = useDeferredValue(query);

  useEffect(() => {
    const next = new URLSearchParams(location.search);
    if (category === ALL) next.delete('category');
    else next.set('category', category);
    if (deferred) next.set('q', deferred);
    else next.delete('q');
    const search = next.toString();
    history.replaceState(null, '', `${location.pathname}${search && '?'}${search}${location.hash}`);
  }, [category, deferred]);

  const needle = deferred.trim().toLowerCase();
  const visible: Plugin[] = [];
  for (const { plugin, haystack } of searchIndex) {
    if (
      (category === ALL || plugin.category === category) &&
      (!needle || haystack.includes(needle))
    ) {
      visible.push(plugin);
    }
  }

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

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { type Plugin, site } from '../site';

export const ALL = 'all';

const readSearch = (key: string) => {
  try {
    return new URLSearchParams(location.search).get(key);
  } catch {
    return null;
  }
};

const haystacks = (() => {
  const map = new Map<Plugin, string>();
  for (const plugin of site.plugins) {
    map.set(
      plugin,
      [plugin.displayName, plugin.summary, plugin.hookEvents.join(' ')]
        .concat(
          plugin.skills.flatMap((skill) => [skill.name, skill.description]),
          plugin.agents.flatMap((agent) => [agent.name, agent.description]),
        )
        .join(' ')
        .toLowerCase(),
    );
  }
  return map;
})();

export function useCatalogFilter() {
  const [category, setCategory] = useState(() => {
    const value = readSearch('category');
    return value && site.categories.includes(value) ? value : ALL;
  });
  const [query, setQuery] = useState(() => readSearch('q') ?? '');
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

  const visible = useMemo(
    () =>
      site.plugins.filter((plugin) => {
        if (category !== ALL && plugin.category !== category) return false;
        if (needle && !(haystacks.get(plugin) ?? '').includes(needle)) return false;
        return true;
      }),
    [category, needle],
  );

  return {
    visible,
    needle,
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

export type CatalogFilter = ReturnType<typeof useCatalogFilter>;

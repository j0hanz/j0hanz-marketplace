import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ALL, filterCatalog } from '../catalog';
import { type ClientId, site } from '../site';

const readSearch = (key: string) => {
  try {
    return new URLSearchParams(location.search).get(key);
  } catch {
    return null;
  }
};

export function useCatalogFilter(client: ClientId) {
  const [chosen, setCategory] = useState(() => {
    const value = readSearch('category');
    return value && site.categories.includes(value) ? value : ALL;
  });
  const [query, setQuery] = useState(() => readSearch('q') ?? '');
  const deferred = useDeferredValue(query);

  const { visible, needle, categories, category } = useMemo(
    () => filterCatalog(site.plugins, site.categories, { client, chosen, query: deferred }),
    [client, chosen, deferred],
  );

  useEffect(() => {
    const next = new URLSearchParams(location.search);
    if (category === ALL) next.delete('category');
    else next.set('category', category);
    if (deferred) next.set('q', deferred);
    else next.delete('q');
    const search = next.toString();
    history.replaceState(null, '', `${location.pathname}${search && '?'}${search}${location.hash}`);
  }, [category, deferred]);

  return {
    visible,
    needle,
    categories,
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

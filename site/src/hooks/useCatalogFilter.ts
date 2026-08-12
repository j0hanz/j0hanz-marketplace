import { useDeferredValue, useEffect, useRef, useState } from 'react';
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

const categoryParam = () => {
  const value = param('category');
  return value && site.categories.includes(value) ? value : ALL;
};

export function useCatalogFilter() {
  const [category, setCategory] = useState(categoryParam);
  const [query, setQuery] = useState(() => param('q') ?? '');
  const deferred = useDeferredValue(query);
  const lastCategory = useRef(category);

  useEffect(() => {
    const next = new URLSearchParams(location.search);
    if (category === ALL) next.delete('category');
    else next.set('category', category);
    if (deferred) next.set('q', deferred);
    else next.delete('q');
    const search = next.toString();
    const url = `${location.pathname}${search && '?'}${search}${location.hash}`;
    // A category is a choice a visitor makes once and can want back, so it gets
    // a history entry; typing does not, or Back would walk the query letter by
    // letter. Both still land in the URL, which is what a shared link carries.
    const picked = category !== lastCategory.current;
    lastCategory.current = category;
    if (picked) history.pushState(null, '', url);
    else history.replaceState(null, '', url);
  }, [category, deferred]);

  // Back has to move the page, not just the address bar.
  useEffect(() => {
    const restore = () => {
      const next = categoryParam();
      lastCategory.current = next;
      setCategory(next);
      setQuery(param('q') ?? '');
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

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

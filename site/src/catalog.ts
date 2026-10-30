// The .ts extension keeps node --test resolving this value import; tsc and
// vite accept it via allowImportingTsExtensions.
import { capabilities } from './capability.ts';
import type { ClientId, Plugin } from './site.ts';

/** The sentinel category that shows every plugin the client installs. */
export const ALL = 'all';

/**
 * The install command for a client, or null when that client cannot install the
 * plugin. Null is also how a caller learns there is nothing to offer there.
 */
export const commandFor = (plugin: Plugin, client: ClientId): string | null =>
  plugin.installs[client];

/** The categories with at least one plugin the client installs, in catalog order. */
const categoriesFor = (
  plugins: readonly Plugin[],
  categories: readonly string[],
  client: ClientId,
): string[] =>
  categories.filter((category) =>
    plugins.some((plugin) => plugin.category === category && commandFor(plugin, client)),
  );

/** The lowercase blob the search needle matches against. */
const haystack = (plugin: Plugin) =>
  [plugin.displayName, plugin.summary, plugin.hookEvents.join(' ')]
    .concat(...capabilities(plugin).map((capability) => capability.searchTerms))
    .join(' ')
    .toLowerCase();

export const filterCatalog = (
  plugins: readonly Plugin[],
  categories: readonly string[],
  { client, chosen, query }: { client: ClientId; chosen: string; query: string },
) => {
  const needle = query.trim().toLowerCase();
  const installed = categoriesFor(plugins, categories, client);
  // A choice the client has no plugins for falls back without being forgotten,
  // so switching back to a client that has them restores it.
  const category = installed.includes(chosen) ? chosen : ALL;
  const visible = plugins.filter((plugin) => {
    // A plugin the chosen client cannot install has nothing to offer there.
    if (!commandFor(plugin, client)) return false;
    if (category !== ALL && plugin.category !== category) return false;
    if (needle && !haystack(plugin).includes(needle)) return false;
    return true;
  });
  return { visible, needle, categories: installed, category };
};

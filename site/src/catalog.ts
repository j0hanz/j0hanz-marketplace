import type { ClientId, Plugin } from './site';

/**
 * The install command for a client, or null when that client cannot install the
 * plugin. Null is also how a caller learns there is nothing to offer there.
 */
export const commandFor = (plugin: Plugin, client: ClientId): string | null =>
  plugin.installs[client];

/** The categories with at least one plugin the client installs, in catalog order. */
export const categoriesFor = (
  plugins: readonly Plugin[],
  categories: readonly string[],
  client: ClientId,
): string[] =>
  categories.filter((category) =>
    plugins.some((plugin) => plugin.category === category && commandFor(plugin, client)),
  );

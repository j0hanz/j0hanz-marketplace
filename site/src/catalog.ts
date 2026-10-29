import type { ClientId, Plugin } from './site';

/** The categories with at least one plugin the client installs, in catalog order. */
export const categoriesFor = (
  plugins: readonly Plugin[],
  categories: readonly string[],
  client: ClientId,
): string[] =>
  categories.filter((category) =>
    plugins.some((plugin) => plugin.category === category && plugin.installs[client]),
  );

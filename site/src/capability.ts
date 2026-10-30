// The .ts extension keeps node --test resolving this value import; tsc and
// vite accept it via allowImportingTsExtensions.
import { countLabel, type Plugin } from './site.ts';

/** One row of a Capability as the index lists it. */
export interface Entry {
  name: string;
  description: string;
  /** The argument a skill takes. */
  hint?: string;
  /** The kind word printed beside the name. */
  tag?: string;
  /** Set on a skill the agent loads itself, with no slash command. */
  note?: 'model-loaded';
}

export interface Capability {
  kind: 'skills' | 'agents' | 'mcpServers';
  /** The singular word the count labels and chips print. */
  label: string;
  count: number;
  searchTerms: string[];
  entries: Entry[];
}

const capability = (
  kind: Capability['kind'],
  label: string,
  entries: Entry[],
  searchTerms: string[],
): Capability => ({ kind, label, count: entries.length, searchTerms, entries });

/** The capability kinds a plugin ships, enumerated once for chips, counts, search and the index. */
export const capabilities = (plugin: Plugin): Capability[] => [
  capability(
    'skills',
    'skill',
    plugin.skills.map((skill) => ({
      name: skill.command ?? skill.name,
      description: skill.description,
      ...(skill.argumentHint && { hint: skill.argumentHint }),
      ...(!skill.command && { note: 'model-loaded' as const }),
    })),
    plugin.skills.flatMap((skill) => [skill.name, skill.description]),
  ),
  capability(
    'agents',
    'agent',
    plugin.agents.map((agent) => ({
      name: agent.name,
      description: agent.description,
      tag: 'agent',
    })),
    plugin.agents.flatMap((agent) => [agent.name, agent.description]),
  ),
  capability(
    'mcpServers',
    'MCP server',
    plugin.mcpServers.map((server) => ({
      name: server.name,
      description: `MCP server (${server.transport})`,
    })),
    plugin.mcpServers.flatMap((server) => [server.name, server.transport, 'mcp']),
  ),
];

/** Totals per capability kind across the given plugins, in capabilities order. */
export const totals = (plugins: readonly Plugin[]) => {
  const byKind = new Map<string, { label: string; total: number }>();
  for (const plugin of plugins) {
    for (const { kind, label, count } of capabilities(plugin)) {
      const entry = byKind.get(kind) ?? { label, total: 0 };
      entry.total += count;
      byKind.set(kind, entry);
    }
  }
  return [...byKind.values()];
};

/** "3 skills, 1 agent": the kinds a plugin ships, or '' when it ships none. */
export const summary = (plugin: Plugin) =>
  capabilities(plugin)
    .filter(({ count }) => count > 0)
    .map(({ count, label }) => countLabel(count, label))
    .join(', ');

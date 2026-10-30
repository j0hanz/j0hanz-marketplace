import raw from './data/marketplace.json' with { type: 'json' };

interface Skill {
  name: string;
  description: string;
  argumentHint?: string;
  command?: string;
}

interface Agent {
  name: string;
  description: string;
}

interface McpServer {
  name: string;
  transport: string;
}

export interface Installs {
  claude: string;
  /** Null for a plugin tagged `claude-code-only`. */
  copilot: string | null;
  /** Null until the plugin carries `.antigravity-plugin/plugin.json`. */
  antigravity: string | null;
}

export type ClientId = keyof Installs;

export interface Plugin {
  name: string;
  displayName: string;
  version: string;
  category: string;
  summary: string;
  homepage: string;
  installs: Installs;
  hookEvents: string[];
  skills: Skill[];
  agents: Agent[];
  mcpServers: McpServer[];
}

export interface Site {
  name: string;
  pageTitle: string;
  /** The pitch, without the category list the page prints as its filter row. */
  tagline: string;
  description: string;
  repo: string;
  repoUrl: string;
  categories: string[];
  plugins: Plugin[];
  /** The hero's add-the-marketplace command per client; null where the client reads no catalog. */
  add: Record<ClientId, string | null>;
}

export const site: Site = raw;

export interface Capability {
  kind: 'skills' | 'agents' | 'mcpServers';
  /** The singular word the count labels and chips print. */
  label: string;
  count: number;
  searchTerms: string[];
}

/** The capability kinds a plugin ships, enumerated once for chips, counts and search. */
export const capabilities = (plugin: Plugin): Capability[] => [
  {
    kind: 'skills',
    label: 'skill',
    count: plugin.skills.length,
    searchTerms: plugin.skills.flatMap((skill) => [skill.name, skill.description]),
  },
  {
    kind: 'agents',
    label: 'agent',
    count: plugin.agents.length,
    searchTerms: plugin.agents.flatMap((agent) => [agent.name, agent.description]),
  },
  {
    kind: 'mcpServers',
    label: 'MCP server',
    count: plugin.mcpServers.length,
    searchTerms: plugin.mcpServers.flatMap((server) => [server.name, server.transport, 'mcp']),
  },
];

export const countLabel = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

/** Anything that leaves the page wears these, plus a new-tab announcement. */
export const external = { target: '_blank', rel: 'noreferrer' } as const;

/** The new-tab announcement every `external` link carries in its accessible name. */
export const externalLabel = (name: string) => `${name} (opens in a new tab)`;

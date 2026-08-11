import raw from './data/marketplace.json';

export interface Skill {
  name: string;
  description: string;
  argumentHint?: string;
  command?: string;
}

export interface Agent {
  name: string;
  description: string;
}

export interface Plugin {
  name: string;
  displayName: string;
  version: string;
  category: string;
  summary: string;
  homepage: string;
  installCommand: string;
  hookEvents: string[];
  skills: Skill[];
  agents: Agent[];
}

export interface Site {
  name: string;
  pageTitle: string;
  description: string;
  repo: string;
  repoUrl: string;
  addCommand: string;
  categories: string[];
  totals: { plugins: number; skills: number; agents: number };
  plugins: Plugin[];
}

export const site: Site = raw;

export const countLabel = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

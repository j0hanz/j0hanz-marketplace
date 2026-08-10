// Every string on the page that is not derived from the marketplace data.
export const copy = {
  skipLink: 'Skip to content',
  navLinks: [
    { label: 'Plugins', href: '#plugins' },
    { label: 'Skills', href: '#skills' },
    { label: 'Install', href: '#install' },
  ],
  heroTitle: 'Skills and agents for Claude Code.',
  heroBody: 'Install one plugin at a time. No build step, no dependencies.',
  heroExplainer: 'Plugins bundle skills (slash-commands) and agents (autonomous helpers).',
  heroPrimary: 'Browse plugins',
  heroPrimaryHref: '#plugins',
  heroSecondary: 'GitHub',
  githubLabel: 'GitHub',
  installTitle: 'Install',
  installSteps: ['Add the marketplace', 'Install a plugin', 'Run it'],
  catalogTitle: 'Plugins',
  catalogAll: 'All',
  catalogSearch: 'Search plugins, skills, agents…',
  // The list carries agents as well as skills; the heading and its count say so.
  skillsTitle: 'Skills and agents',
  modelLoadedTag: 'model-loaded',
  modelLoadedHint: 'Claude auto-loads this skill. It is not a user-facing slash command.',
  agentTag: 'agent',
  unit: { plugin: 'plugin', skill: 'skill', agent: 'agent', hook: 'hook' },
  copyLabel: 'Copy',
  copiedLabel: 'Copied',
  selectLabel: 'Press Ctrl/⌘+C to copy',
  // Two maps, not one. The label is "<where you are>. <what this does>.", and a single
  // set of strings could only ever be one of those: phrased as actions, both halves read
  // as commands and the current mode is unrecoverable from the label.
  modeState: {
    system: 'Theme follows system',
    light: 'Light theme',
    dark: 'Dark theme',
  },
  modeNext: {
    system: 'Switch to system theme',
    light: 'Switch to light theme',
    dark: 'Switch to dark theme',
  },
  menuLabel: 'Open menu',
  catalogEmpty: 'No plugins match this search.',
  catalogClear: 'Clear filters',
  footerNote: 'MIT licensed.',
} as const;

/** Word only — pluralized when count is not one. Used where the count is shown separately. */
export const pluralWord = (count: number, word: string) => `${word}${count === 1 ? '' : 's'}`;

export const plural = (count: number, word: string) => `${count} ${pluralWord(count, word)}`;

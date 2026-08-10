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
  // Names the outcome of pressing it, which is what the toggle's label has to say.
  // Three modes, one per system state; the toggle composes a "<current> — <next>" label.
  modeToggle: {
    system: 'Follow system theme',
    light: 'Use light theme',
    dark: 'Use dark theme',
  },
  menuLabel: 'Open menu',
  catalogEmpty: 'No plugins match this search.',
  catalogClear: 'Clear filters',
  footerNote: 'MIT licensed.',
} as const;

/** Word only — pluralized when count is not one. Used where the count is shown separately. */
export const pluralWord = (count: number, word: string) => `${word}${count === 1 ? '' : 's'}`;

export const plural = (count: number, word: string) => `${count} ${pluralWord(count, word)}`;

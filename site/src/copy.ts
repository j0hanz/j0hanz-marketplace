// Every string on the page that is not derived from the marketplace data.
export const copy = {
  navLinks: [
    { label: 'Plugins', href: '#plugins' },
    { label: 'Skills', href: '#skills' },
    { label: 'Install', href: '#install' },
  ],
  heroTitle: 'Skills and agents for Claude Code.',
  heroBody: 'Installable one at a time. No build step, no dependencies.',
  heroPrimary: 'Browse plugins',
  heroPrimaryHref: '#plugins',
  heroSecondary: 'GitHub',
  githubLabel: 'GitHub',
  installTitle: 'Three commands.',
  installSteps: ['Add', 'Install', 'Use'],
  catalogTitle: 'Plugins',
  catalogAll: 'All',
  skillsTitle: 'Every skill',
  modelLoadedTag: 'model-loaded',
  agentTag: 'agent',
  unit: { plugin: 'plugin', skill: 'skill', agent: 'agent' },
  copyLabel: 'Copy',
  copiedLabel: 'Copied',
  modeLabel: 'Toggle light and dark mode',
  footerNote: 'MIT licensed.',
} as const;

/** Word only — pluralized when count is not one. Used where the count is shown separately. */
export const pluralWord = (count: number, word: string) => `${word}${count === 1 ? '' : 's'}`;

export const plural = (count: number, word: string) => `${count} ${pluralWord(count, word)}`;

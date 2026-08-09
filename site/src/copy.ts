// Every string on the page that is not derived from the marketplace data.
export const copy = {
  navLinks: [
    { label: 'Plugins', href: '#plugins' },
    { label: 'Install', href: '#install' },
  ],
  heroTitle: 'Skills and agents for Claude Code.',
  heroBody: 'Installable one at a time. No build step, no dependencies.',
  heroPrimary: 'Browse plugins',
  heroSecondary: 'GitHub',
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
  footerNote: 'MIT licensed.',
} as const;

export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

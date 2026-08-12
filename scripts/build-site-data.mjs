// Builds the landing-page data file, and the README's plugin sections, from the marketplace
// catalog. Reads the catalog rather than a hardcoded list, so a new plugin is covered the
// moment it gets an entry. The data file is regenerated on every dev and build run and never
// committed, so the site cannot drift from the plugins; the README is committed, so its
// generated regions are rewritten in place and a test holds them to what this produces.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const OUT = 'site/src/data/marketplace.json';
const README = 'README.md';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

// site.ts carries the same rule for the page. Not shared: importing across the
// build/runtime line to save one line costs more than the line.
const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ponytail: regex frontmatter reader, scalar keys at column 0 only. Indented keys
// (metadata.category) are skipped on purpose. Swap for a YAML parser if a SKILL.md ever
// needs block scalars.
const frontmatter = (src) =>
  Object.fromEntries(
    [
      ...(src.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '').matchAll(/^([\w-]+):[ \t]*(.*)$/gm),
    ].map(([, key, value]) => [key, value.trim().replace(/^['"]|['"]$/g, '')]),
  );

const list = (dir, keep) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter(keep)
        .map((e) => e.name)
        .sort()
    : [];
const dirsIn = (dir) => list(dir, (e) => e.isDirectory());
const docsIn = (dir) => list(dir, (e) => e.isFile() && e.name.endsWith('.md'));

// Install commands need owner/repo. Git knows it, and a Vercel checkout that arrives without
// a .git directory carries the same two names in its system environment. Deriving it both
// ways means no plugin has to restate the repo it already lives in.
const repoSlug = () => {
  let remote = '';
  try {
    remote = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    remote = '';
  }
  const { VERCEL_GIT_REPO_OWNER: owner, VERCEL_GIT_REPO_SLUG: name } = process.env;
  const slug =
    remote.match(/([^/:]+\/[^/]+?)(?:\.git)?\/?$/)?.[1] ||
    (owner && name ? `${owner}/${name}` : '');
  if (!slug) {
    throw new Error(
      'No git remote and no VERCEL_GIT_REPO_OWNER/VERCEL_GIT_REPO_SLUG: ' +
        'cannot build install commands.',
    );
  }
  return slug;
};

const readSkills = (root, pluginName) =>
  dirsIn(join(root, 'skills')).flatMap((dir) => {
    const path = join(root, 'skills', dir, 'SKILL.md');
    // A directory under skills/ with no SKILL.md is work in progress, not a skill. Reading it
    // anyway took the whole site down over a folder someone had not finished making.
    if (!existsSync(path)) return [];
    const fm = frontmatter(readFileSync(path, 'utf8'));
    const name = fm.name || dir;
    const skill = { name, description: fm.description ?? '' };
    if (fm['argument-hint']) skill.argumentHint = fm['argument-hint'];
    // Absent means invocable: only an explicit `false` takes the slash command away.
    if (fm['user-invocable'] !== 'false') skill.command = `/${pluginName}:${name}`;
    return [skill];
  });

const readAgents = (root) =>
  docsIn(join(root, 'agents')).map((file) => {
    const fm = frontmatter(readFileSync(join(root, 'agents', file), 'utf8'));
    return { name: fm.name || basename(file, '.md'), description: fm.description ?? '' };
  });

const readHookEvents = (root) => {
  const path = join(root, 'hooks/hooks.json');
  return existsSync(path) ? Object.keys(readJson(path).hooks ?? {}) : [];
};

export function build() {
  const catalog = readJson('.claude-plugin/marketplace.json');

  const sources = catalog.plugins.map((entry) => {
    if (typeof entry.source !== 'string') {
      throw new Error(
        `Plugin "${entry.name}" has a non-local source; the site renders local plugins only.`,
      );
    }
    return {
      entry,
      root: entry.source,
      manifest: readJson(join(entry.source, '.claude-plugin/plugin.json')),
    };
  });

  const repo = repoSlug();

  const plugins = sources.map(({ entry, root, manifest }) => {
    // Defaulting it to '' put a nameless button in the filter row and a "Categories: ,"
    // in the meta description, and only the tests noticed. The build owns this now.
    if (!entry.category) {
      throw new Error(`Plugin "${manifest.name}" has no category in its catalog entry.`);
    }
    return {
      name: manifest.name,
      displayName: manifest.displayName || manifest.name,
      version: manifest.version ?? '',
      category: entry.category,
      // Catalog line is the one-breath pitch, and the only prose the cards show.
      summary: entry.description ?? '',
      // No manifest `homepage` override: a hardcoded one is this same URL until the repo is
      // forked or renamed, and then it is the one card still pointing at the old place.
      homepage: `https://github.com/${repo}/tree/main/${root.replace(/^\.\//, '')}`,
      installCommand: `/plugin install ${manifest.name}@${catalog.name}`,
      hookEvents: readHookEvents(root),
      skills: readSkills(root, manifest.name),
      agents: readAgents(root),
    };
  });

  // The install section walks a real plugin through steps 2 and 3. Fail here rather than
  // let the page ship with nothing to put in them.
  if (!plugins.some((p) => p.skills.some((s) => s.command))) {
    throw new Error('No invocable skill in any plugin: the install steps have no command to show.');
  }

  const total = (fn) => plugins.reduce((n, p) => n + fn(p), 0);
  const skills = total((p) => p.skills.length);
  const agents = total((p) => p.agents.length);
  const categories = [...new Set(plugins.map((p) => p.category))].sort();

  const tagline =
    `${count(skills, 'skill')} and ${count(agents, 'agent')} across ` +
    `${count(plugins.length, 'Claude Code plugin')}. Install one at a time, no build step.`;

  // The first command a visitor actually runs after `marketplace add`. Picked at build
  // time, so the hero ships its install steps in one import, not a flatMap at render.
  const example =
    plugins
      .flatMap((p) =>
        p.skills.flatMap((s) => (s.command ? { install: p.installCommand, run: s.command } : [])),
      )
      .at(0) ?? null;

  return {
    name: catalog.name,
    // The catalog line names the marketplace; a <title> has to name what the page
    // is about first. Same words the hero opens with, so the tab and the headline
    // agree. Marketplace name trails it as the brand.
    pageTitle: `Skills and agents for Claude Code · ${catalog.name}`,
    // Counted rather than authored: the catalog is the description, and one that
    // is written by hand goes stale the first time a plugin ships a skill. Front
    // sentence carries the pitch, so a search engine clipping the tail only ever
    // loses the category list.
    tagline,
    // The tail is for search results only: the page lists the categories itself,
    // in the filter row under the hero, so the hero prints the tagline alone.
    description: `${tagline} Categories: ${categories.join(', ')}.`,
    repo,
    repoUrl: `https://github.com/${repo}`,
    addCommand: `/plugin marketplace add ${repo}`,
    categories,
    plugins,
    example,
  };
}

// README regions. The install list and the plugin sections were the last hand-kept copy of
// the catalog, and the one that lied: it advertised nine `/mcp-hub:*` commands for skills
// marked `user-invocable: false`. Both are spliced between markers so the prose around them
// stays authored.
const fence = (lines) => ['```text', ...lines, '```'].join('\n');
const code = (value) => `\`${value}\``;
const bullet = (label, items) => (items.length ? [`- ${label}: ${items.join(', ')}`] : []);

const section = (plugin) =>
  [
    `### ${plugin.name}`,
    '',
    // Printed as authored: the catalog line ends however its author ended it.
    plugin.summary,
    '',
    ...bullet(
      'Commands',
      plugin.skills.filter((s) => s.command).map((s) => code(s.command)),
    ),
    ...bullet(
      'Model-loaded skills',
      plugin.skills.filter((s) => !s.command).map((s) => code(s.name)),
    ),
    ...bullet(
      'Agents',
      plugin.agents.map((a) => code(a.name)),
    ),
    ...bullet('Hooks', plugin.hookEvents.map(code)),
  ].join('\n');

const REGIONS = {
  install: (site) => fence(site.plugins.map((p) => p.installCommand)),
  plugins: (site) => site.plugins.map(section).join('\n\n'),
};

const splice = (markdown, key, body) => {
  const [open, close] = [`<!-- ${key}:start -->`, `<!-- ${key}:end -->`];
  const from = markdown.indexOf(open);
  const to = markdown.indexOf(close);
  if (from < 0 || to < from) throw new Error(`${README} is missing its ${key} markers.`);
  return `${markdown.slice(0, from + open.length)}\n\n${body}\n\n${markdown.slice(to)}`;
};

export const readme = (markdown, site) =>
  Object.entries(REGIONS).reduce((out, [key, body]) => splice(out, key, body(site)), markdown);

if (process.argv[1] === import.meta.filename) {
  const site = build();
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(site, null, 2)}\n`);

  const before = readFileSync(README, 'utf8');
  const after = readme(before, site);
  if (after !== before) writeFileSync(README, after);

  const skills = site.plugins.flatMap((p) => p.skills).length;
  const agents = site.plugins.flatMap((p) => p.agents).length;
  console.log(
    `${OUT}: ${site.plugins.length} plugins, ${skills} skills, ${agents} agents` +
      `${after === before ? '' : ` (${README} updated)`}`,
  );
}

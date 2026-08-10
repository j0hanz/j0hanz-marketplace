// Builds the landing-page data file from the marketplace catalog.
// Reads the catalog rather than a hardcoded list, so a new plugin is covered the moment
// it gets an entry. Regenerated on every dev and build run and never committed, so the
// site cannot drift from the plugins.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const OUT = 'site/src/data/marketplace.json';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

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

// Install commands need owner/repo. Git knows it; a plugin `repository` field is the
// fallback for a clone with no origin.
const repoSlug = (manifests) => {
  let remote = '';
  try {
    remote = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    remote = '';
  }
  const source = remote || manifests.find((m) => m.repository)?.repository || '';
  const slug = source.match(/([^/:]+\/[^/]+?)(?:\.git)?\/?$/)?.[1];
  if (!slug) {
    throw new Error(
      'No git remote and no plugin `repository` field: cannot build install commands.',
    );
  }
  return slug;
};

const readSkills = (root, pluginName) =>
  dirsIn(join(root, 'skills')).map((dir) => {
    const fm = frontmatter(readFileSync(join(root, 'skills', dir, 'SKILL.md'), 'utf8'));
    const name = fm.name || dir;
    const skill = { name, description: fm.description ?? '' };
    if (fm['argument-hint']) skill.argumentHint = fm['argument-hint'];
    // Absent means invocable: only an explicit `false` takes the slash command away.
    if (fm['user-invocable'] !== 'false') skill.command = `/${pluginName}:${name}`;
    return skill;
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

  const repo = repoSlug(sources.map((s) => s.manifest));

  const plugins = sources.map(({ entry, root, manifest }) => ({
    name: manifest.name,
    displayName: manifest.displayName || manifest.name,
    version: manifest.version ?? '',
    category: entry.category ?? '',
    // Catalog line is the one-breath pitch, and the only prose the cards show.
    summary: entry.description ?? '',
    homepage:
      manifest.homepage || `https://github.com/${repo}/tree/main/${root.replace(/^\.\//, '')}`,
    installCommand: `/plugin install ${manifest.name}@${catalog.name}`,
    hookEvents: readHookEvents(root),
    skills: readSkills(root, manifest.name),
    agents: readAgents(root),
  }));

  // The install section walks a real plugin through steps 2 and 3. Fail here rather than
  // let the page ship with nothing to put in them.
  if (!plugins.some((p) => p.skills.some((s) => s.command))) {
    throw new Error('No invocable skill in any plugin: the install steps have no command to show.');
  }

  const total = (fn) => plugins.reduce((n, p) => n + fn(p), 0);

  return {
    name: catalog.name,
    description: catalog.description,
    repo,
    repoUrl: `https://github.com/${repo}`,
    addCommand: `/plugin marketplace add ${repo}`,
    categories: [...new Set(plugins.map((p) => p.category))].sort(),
    totals: {
      plugins: plugins.length,
      skills: total((p) => p.skills.length),
      agents: total((p) => p.agents.length),
    },
    plugins,
  };
}

if (process.argv[1] === import.meta.filename) {
  const site = build();
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(site, null, 2)}\n`);
  const { totals } = site;
  console.log(
    `${OUT}: ${totals.plugins} plugins, ${totals.skills} skills, ${totals.agents} agents`,
  );
}

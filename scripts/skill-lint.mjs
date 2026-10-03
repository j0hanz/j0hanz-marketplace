// Lints what `claude plugin validate` never reads: the links, names, and commands inside a
// plugin's skills, agents, and hooks. Pure over the files on disk, so tests need no `claude`.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { load } from 'js-yaml';

// Checks that fail `npm run validate`; any other check prints as a warning. Add a check here
// once every plugin in the catalog passes it.
export const FAILS = new Set(['skill-name']);
// A model-invoked description loads every session. Over BUDGET words warns in every plugin and
// fails in the plugins listed here.
export const BUDGET = 40;
export const BUDGET_FAILS = new Set(['workbench']);

export const fails = (problem, plugin) =>
  FAILS.has(problem.check) || (problem.check === 'budget' && BUDGET_FAILS.has(plugin));

// Words a reader pays for: tokens holding a letter or digit, so a spaced dash is not one.
export const words = (text) =>
  text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;

const SCRIPT = /\.(?:mjs|cjs|js|sh|py|ps1)\b/;
const ROOT = /^(?:\\?")?\$(?:\{CLAUDE_PLUGIN_ROOT\}|env:CLAUDE_PLUGIN_ROOT|CLAUDE_PLUGIN_ROOT)/;
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .sort((a, b) => (a.name < b.name ? -1 : 1))
        .flatMap((entry) =>
          entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
        )
    : [];
const base = (file) => file.slice(file.lastIndexOf(sep) + 1).replace(/\.md$/, '');

// root: the plugin directory. plugin: its catalog name. plugins: every name in the catalog.
// Returns [{ check, file (relative to root, '/'-separated), line, message }].
export function lintPlugin(root, plugin, plugins = [plugin]) {
  const problems = [];
  const report = (check, file, line, message) =>
    problems.push({ check, file: relative(root, file).split(sep).join('/'), line, message });

  const skills = new Set(
    walk(join(root, 'skills'))
      .filter((file) => file === join(root, 'skills', base(dirname(file)), 'SKILL.md'))
      .map((file) => base(dirname(file))),
  );
  // A plugin-qualified name (`workbench:tdd`) may also name an agent or an output style.
  const components = new Set(skills);
  for (const dir of ['agents', 'output-styles', 'commands']) {
    for (const file of walk(join(root, dir))) if (file.endsWith('.md')) components.add(base(file));
  }
  const qualified = new RegExp(`\\b(${plugins.join('|')}):([a-z0-9-]+)`, 'g');

  const docs = [...walk(join(root, 'skills')), ...walk(join(root, 'agents'))].filter((file) =>
    file.endsWith('.md'),
  );
  const hooks = walk(join(root, 'hooks')).filter((file) => /\.(?:json|mjs|cjs|js)$/.test(file));

  for (const file of [...docs, ...hooks]) {
    let fenced = false;
    for (const [index, line] of readFileSync(file, 'utf8').split(/\r?\n/).entries()) {
      const at = index + 1;
      // A command that starts with a script path runs only where the exec bit survived.
      const command = /"(?:command|powershell)"\s*:\s*"(.*)/.exec(line)?.[1] ?? line.trim();
      const head = command.split(/\s+/)[0];
      if (ROOT.test(head) && SCRIPT.test(head)) {
        report('bare-script', file, at, 'runs a script by bare path; put its interpreter first');
      }
      for (const [, owner, name] of line.matchAll(qualified)) {
        if (owner !== plugin) {
          report('skill-name', file, at, `${owner}:${name} is another plugin's`);
        } else if (!components.has(name)) {
          report('skill-name', file, at, `${owner}:${name} not found`);
        }
      }
      if (!file.endsWith('.md')) continue;
      if (/^\s*(?:```|~~~)/.test(line)) fenced = !fenced;
      if (fenced) continue;
      // Links inside inline code are examples, not links.
      for (const [, href] of line.replace(/`[^`]*`/g, '').matchAll(/\]\(([^)\s]+)/g)) {
        if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#')) continue;
        const target = resolve(dirname(file), href.split('#')[0]);
        if (relative(resolve(root), target).startsWith('..')) {
          report('link', file, at, `${href} points outside the plugin`);
        } else if (!existsSync(target)) report('link', file, at, `${href} does not resolve`);
      }
    }
  }

  for (const skill of skills) {
    const file = join(root, 'skills', skill, 'SKILL.md');
    const text = readFileSync(file, 'utf8');
    const at = text.split(/\r?\n/).findIndex((line) => line.startsWith('description:')) + 1;
    let data;
    try {
      data = load(/^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? '');
    } catch {
      continue; // validate.mjs already reports frontmatter that is not strict YAML.
    }
    const description = String(data?.description ?? '');
    // A "Not for" clause names its neighbours in parentheses; each must be a skill here.
    const cut = description.search(/\bnot for\b/i);
    const boundary = cut < 0 ? '' : description.slice(cut);
    for (const [, group] of boundary.matchAll(/\(([^)]*)\)/g)) {
      const names = group.split(/,\s*/).map((name) => name.replace(`${plugin}:`, ''));
      if (!names.every((name) => KEBAB.test(name))) continue;
      for (const name of names.filter((name) => !skills.has(name))) {
        report('skill-name', file, at, `description names ${name}, not a skill in this plugin`);
      }
    }
    const count = words(description);
    if (data?.['disable-model-invocation'] !== true && count > BUDGET) {
      report('budget', file, at, `description is ${count} words; the budget is ${BUDGET}`);
    }
  }
  return problems;
}

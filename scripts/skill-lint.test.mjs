import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { BUDGET, fails, lintPlugin, words } from './skill-lint.mjs';

const skill = (name, description, extra = '') =>
  `---\nname: ${name}\ndescription: ${description}\n${extra}---\n`;

// Builds plugins/sample in a temp dir from { path: content } and lints it.
function lint(context, files, plugins = ['sample', 'other']) {
  const dir = mkdtempSync(join(tmpdir(), 'skill-lint-'));
  context.after(() => rmSync(dir, { recursive: true, force: true }));
  const root = join(dir, 'plugins', 'sample');
  for (const [path, content] of Object.entries({
    'skills/guide/SKILL.md': skill('guide', 'Use when guiding.'),
    ...files,
  })) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  writeFileSync(join(dir, 'outside.md'), 'Outside the plugin.\n');
  return lintPlugin(root, 'sample', plugins).map(({ check, file, line }) => [check, file, line]);
}

test('a plugin whose links, names, and commands all hold reports nothing', (context) => {
  const problems = lint(context, {
    'skills/tour/SKILL.md':
      skill('tour', 'Use when touring. Not for guiding (guide) or reviews (sample:guide).') +
      'See [guide](../guide/SKILL.md#steps), [docs](https://example.com), and [top](#top).\n' +
      'Run `[x](missing.md)` as an example.\n```markdown\n[y](missing.md)\n```\n' +
      'node "${CLAUDE_PLUGIN_ROOT}/skills/tour/run.mjs"\n',
    'hooks/hooks.json': '{ "command": "node \\"${CLAUDE_PLUGIN_ROOT}/hooks/x.mjs\\"" }\n',
  });
  assert.deepEqual(problems, []);
});

test('a relative link that does not resolve, or leaves the plugin, is a link problem', (context) => {
  const problems = lint(context, {
    'skills/tour/SKILL.md':
      skill('tour', 'Use when touring.') +
      'First.\n[gone](../gone/SKILL.md)\n[out](../../../../outside.md)\n',
  });
  assert.deepEqual(problems, [
    ['link', 'skills/tour/SKILL.md', 6],
    ['link', 'skills/tour/SKILL.md', 7],
  ]);
});

test('a Not-for name or a qualified name that is not a skill here is a skill-name problem', (context) => {
  const problems = lint(context, {
    'skills/tour/SKILL.md':
      skill('tour', 'Use when touring (ts2589). Not for guiding (guide, missing).') +
      'Hand off to other:guide, then sample:gone, then sample:guide.\n',
    'hooks/brief.mjs': "const next = 'sample:absent';\n",
  });
  assert.deepEqual(problems, [
    ['skill-name', 'skills/tour/SKILL.md', 5],
    ['skill-name', 'skills/tour/SKILL.md', 5],
    ['skill-name', 'hooks/brief.mjs', 1],
    ['skill-name', 'skills/tour/SKILL.md', 3],
  ]);
});

test('a command that starts with a bundled script path is a bare-script problem', (context) => {
  const problems = lint(context, {
    'hooks/hooks.json': '{ "command": "\\"${CLAUDE_PLUGIN_ROOT}\\"/hooks/x.sh" }\n',
    'skills/tour/SKILL.md': skill('tour', 'Use when touring.') + '"${CLAUDE_PLUGIN_ROOT}/x.mjs"\n',
  });
  assert.deepEqual(problems, [
    ['bare-script', 'skills/tour/SKILL.md', 5],
    ['bare-script', 'hooks/hooks.json', 1],
  ]);
});

test('only a model-invoked description over the budget is a budget problem', (context) => {
  const long = 'word '.repeat(BUDGET + 1).trim();
  const problems = lint(context, {
    'skills/long/SKILL.md': skill('long', long),
    'skills/typed/SKILL.md': skill('typed', long, 'disable-model-invocation: true\n'),
    'skills/fits/SKILL.md': skill('fits', `${'word '.repeat(BUDGET)}— —`),
  });
  assert.deepEqual(problems, [['budget', 'skills/long/SKILL.md', 3]]);
  assert.equal(words('one — two'), 2);
});

test('skill-name problems fail the gate; budget fails only in an enforced plugin', () => {
  assert.equal(fails({ check: 'skill-name' }, 'sample'), true);
  assert.equal(fails({ check: 'budget' }, 'no-such-plugin'), false);
});

test('every plugin in the catalog passes the checks that fail the gate', () => {
  const repo = fileURLToPath(new URL('..', import.meta.url));
  const catalog = JSON.parse(readFileSync(join(repo, '.claude-plugin/marketplace.json'), 'utf8'));
  const names = catalog.plugins.map((plugin) => plugin.name);
  const failing = catalog.plugins.flatMap(({ name, source }) =>
    lintPlugin(join(repo, source), name, names)
      .filter((problem) => fails(problem, name))
      .map((problem) => `${name}/${problem.file}:${problem.line} ${problem.message}`),
  );
  assert.deepEqual(failing, []);
});

// Validates the marketplace catalog and every plugin it lists, for both clients.
// Reads the catalog rather than a hardcoded list, so new plugins are covered
// the moment they get an entry.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { load } from 'js-yaml';

const catalog = JSON.parse(readFileSync('.claude-plugin/marketplace.json', 'utf8'));
const sources = catalog.plugins.map((p) => p.source).filter((s) => typeof s === 'string');

let failed = 0;
const fail = (message) => {
  console.error(`✘ ${message}`);
  failed++;
};

// shell: true — `claude` and `copilot` are .cmd shims on Windows.
const run = (bin, args, env) =>
  spawnSync(bin, args, { stdio: 'inherit', shell: true, env: { ...process.env, ...env } });
const onPath = (bin) =>
  spawnSync(bin, ['--version'], { stdio: 'ignore', shell: true }).status === 0;

for (const target of ['.', ...sources]) {
  if (run('claude', ['plugin', 'validate', target, '--strict']).status !== 0) failed++;
}

// Copilot CLI has no `plugin validate`. What it rejects silently, checked here instead:
// the legacy manifest location, its name rule, and frontmatter it parses as strict YAML —
// a description with an unquoted `: ` loads in Claude Code and drops the skill in Copilot.
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const frontmatter = (file) => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(file, 'utf8'));
  if (!match) return fail(`${file}: no frontmatter`);
  try {
    const data = load(match[1]);
    if (typeof data?.name !== 'string') fail(`${file}: frontmatter has no name`);
  } catch (error) {
    fail(`${file}: frontmatter is not strict YAML: ${error.message.split('\n')[0]}`);
  }
};
const entries = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : []);

for (const { name, source } of catalog.plugins) {
  if (!NAME.test(name) || name.length > 64) fail(`${name}: not a kebab-case name of ≤ 64 chars`);
  if (typeof source !== 'string') continue;
  const manifest = join(source, '.claude-plugin', 'plugin.json');
  if (!existsSync(manifest)) {
    fail(`${name}: no ${manifest}`);
    continue;
  }
  if (JSON.parse(readFileSync(manifest, 'utf8')).name !== name) {
    fail(`${manifest}: name differs from the catalog entry ${name}`);
  }
  for (const skill of entries(join(source, 'skills'))) {
    const file = join(source, 'skills', skill.name, 'SKILL.md');
    if (skill.isDirectory() && existsSync(file)) frontmatter(file);
  }
  for (const agent of entries(join(source, 'agents'))) {
    if (agent.isFile() && agent.name.endsWith('.md'))
      frontmatter(join(source, 'agents', agent.name));
  }
}

// Smoke test through the real CLI when it is installed, in a throwaway home so the
// user's own marketplaces and plugins are never touched.
if (onPath('copilot')) {
  const home = mkdtempSync(join(tmpdir(), 'copilot-home-'));
  const env = { COPILOT_HOME: home };
  try {
    if (run('copilot', ['plugin', 'marketplace', 'add', `"${resolve('.')}"`], env).status !== 0) {
      fail('copilot plugin marketplace add');
    } else {
      for (const { name, tags } of catalog.plugins) {
        if (Array.isArray(tags) && tags.includes('claude-code-only')) continue;
        const spec = `${name}@${catalog.name}`;
        if (run('copilot', ['plugin', 'install', spec], env).status !== 0) {
          fail(`copilot plugin install ${spec}`);
        }
      }
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
} else {
  console.log('copilot not on PATH: skipped the Copilot CLI install smoke test.');
}

process.exit(failed ? 1 : 0);

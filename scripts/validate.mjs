// Validates the marketplace catalog and every plugin it lists, for each client.
// Reads the catalog rather than a hardcoded list, so new plugins are covered
// the moment they get an entry.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { load } from 'js-yaml';
import { fails, lintPlugin } from './skill-lint.mjs';

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

const hasClaude = onPath('claude');
if (!hasClaude) {
  fail(
    'claude not on PATH: npm run check needs Claude Code to validate and test plugins (CLAUDE.md)',
  );
}

if (hasClaude) {
  for (const target of ['.', ...sources]) {
    if (run('claude', ['plugin', 'validate', target, '--strict']).status !== 0) failed++;
  }
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
const names = catalog.plugins.map((p) => p.name);
const entries = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : []);

// Antigravity CLI reads none of the above: it takes a plugin by its own manifest, and nothing
// generates that file from the Claude one, so what both say about the plugin is held equal
// here. Its loader also cuts a SKILL.md off at 24 KB.
const ANTIGRAVITY_SKILL_BYTES = 24 * 1024;
const antigravitySources = [];
let canonicalClient = null;

for (const { name, source } of catalog.plugins) {
  if (!NAME.test(name) || name.length > 64) fail(`${name}: not a kebab-case name of ≤ 64 chars`);
  if (typeof source !== 'string') continue;
  const manifest = join(source, '.claude-plugin', 'plugin.json');
  if (!existsSync(manifest)) {
    fail(`${name}: no ${manifest}`);
    continue;
  }
  const claude = JSON.parse(readFileSync(manifest, 'utf8'));
  if (claude.name !== name) {
    fail(`${manifest}: name differs from the catalog entry ${name}`);
  }
  const clientCjs = join(source, 'hooks', 'client.cjs');
  if (existsSync(clientCjs)) {
    fail(`${clientCjs}: use hooks/client.mjs so all plugins share one client module`);
  }
  const clientMjs = join(source, 'hooks', 'client.mjs');
  if (existsSync(clientMjs)) {
    const body = readFileSync(clientMjs, 'utf8');
    if (!canonicalClient) {
      canonicalClient = { file: clientMjs, body };
    } else if (body !== canonicalClient.body) {
      fail(
        `${clientMjs}: differs from ${canonicalClient.file} (hooks/client.mjs must stay identical across plugins)`,
      );
    }
  }
  const antigravity = join(source, '.antigravity-plugin', 'plugin.json');
  const ported = existsSync(antigravity) && JSON.parse(readFileSync(antigravity, 'utf8'));
  if (ported) {
    antigravitySources.push(source);
    for (const key of ['name', 'version', 'description']) {
      if (ported[key] !== claude[key]) fail(`${antigravity}: ${key} differs from ${manifest}`);
    }
  }
  for (const skill of entries(join(source, 'skills'))) {
    const file = join(source, 'skills', skill.name, 'SKILL.md');
    if (!skill.isDirectory() || !existsSync(file)) continue;
    frontmatter(file);
    if (ported && statSync(file).size > ANTIGRAVITY_SKILL_BYTES) {
      fail(`${file}: over the 24 KB Antigravity CLI loads`);
    }
  }
  for (const agent of entries(join(source, 'agents'))) {
    if (agent.isFile() && agent.name.endsWith('.md'))
      frontmatter(join(source, 'agents', agent.name));
  }
  for (const problem of lintPlugin(source, name, names)) {
    const where = `${join(source, problem.file)}:${problem.line}: ${problem.message} [${problem.check}]`;
    if (fails(problem, name)) fail(where);
    else console.warn(`⚠ ${where}`);
  }
}

// A plugin whose hooks.json names a hooks module (a mod) ships `*.test.ts` files that only
// `claude plugin test` can run, and a typecheck that needs the types the engine lays on load.
for (const source of sources) {
  const hooks = join(source, 'hooks', 'hooks.json');
  if (!existsSync(hooks) || !JSON.parse(readFileSync(hooks, 'utf8')).modules) continue;
  if (hasClaude && run('claude', ['plugin', 'test', source]).status !== 0)
    fail(`${source}: claude plugin test`);
  if (!existsSync(join(source, '.claude-plugin', 'types'))) {
    fail(
      `${source}: no generated types; load it once with --plugin-dir so validate can typecheck it (CLAUDE.md, "Mods")`,
    );
  } else if (run('npx', ['tsc', '-p', source]).status !== 0) fail(`${source}: tsc`);
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

// Antigravity CLI's own loader rules, through its validator, when it is installed. Not
// --strict: that fails on the warnings it raises for every other client's files
// (.claude-plugin/, hooks/hooks.json), which these plugins carry on purpose.
if (onPath('agy')) {
  for (const source of antigravitySources) {
    if (run('agy', ['plugin', 'validate', `"${resolve(source)}"`]).status !== 0) {
      fail(`agy plugin validate ${source}`);
    }
  }
} else {
  console.log('agy not on PATH: skipped Antigravity CLI validation.');
}

process.exit(failed ? 1 : 0);

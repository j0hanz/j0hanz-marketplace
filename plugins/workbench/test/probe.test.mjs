import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { BARE_CI, NOISE, runSteps, scriptSteps, SETUP } from '../lib/ci.mjs';

// What the Gates section calls setup — everything else earns a `← not declared`
// mark when no declared command runs it.
const setup = (cmd) => SETUP.test(cmd) || BARE_CI.test(cmd);

const ACTIONS = [
  'jobs:',
  '  build:',
  '    steps:',
  '      - uses: actions/checkout@v4',
  '      - run: npm ci',
  '      - run: npm test',
  '      - name: lint and build',
  '        run: |',
  '          npm run lint',
  '          npm run build',
  '        env:',
  '          CI: true',
].join('\n');

test('an inline run step is one command', () => {
  const got = runSteps(ACTIONS);
  assert.ok(got.includes('npm ci'));
  assert.ok(got.includes('npm test'));
});

test('a run block contributes one command per line', () => {
  const got = runSteps(ACTIONS);
  assert.ok(got.includes('npm run lint'));
  assert.ok(got.includes('npm run build'));
});

test('a sibling key at the step depth is not a command', () => {
  // `- run: |` measures its indent including the dash, so `env:` and its body sit
  // at or above the step's own depth and end the block.
  const got = runSteps(ACTIONS);
  assert.ok(!got.some((cmd) => cmd.startsWith('env')));
  assert.ok(!got.includes('CI: true'));
});

test('a CRLF checkout parses identically to LF', () =>
  assert.deepEqual(runSteps(ACTIONS.replace(/\n/g, '\r\n')), runSteps(ACTIONS)));

const CIRCLE = [
  'jobs:',
  '  build:',
  '    steps:',
  '      - checkout',
  '      - run: npm run lint',
  '      - run:',
  '          name: unit',
  '          command: npm run coverage',
].join('\n');

test('a circleci block step yields its command, not its metadata', () =>
  assert.deepEqual(runSteps(CIRCLE), ['npm run lint', 'npm run coverage']));

test('a shell line shaped like a mapping key survives a github run block', () => {
  // GitHub's `run: |` body is raw shell — the key filter must not eat it.
  const yaml = [
    '    steps:',
    '      - run: |',
    '          echo name: x',
    '          npm test',
  ].join('\n');
  assert.deepEqual(runSteps(yaml), ['echo name: x', 'npm test']);
});

const GITLAB = [
  'test:',
  '  before_script:',
  '    - npm ci',
  '  script:',
  '    - "npm run lint"',
  '    - npm test',
  'stages:',
  '  - test',
].join('\n');

test('gitlab script items are commands, quotes stripped', () =>
  assert.deepEqual(scriptSteps(GITLAB), ['npm ci', 'npm run lint', 'npm test']));

test('a list outside a script key is not a command', () =>
  assert.ok(!scriptSteps(GITLAB).includes('test')));

test('noise is the shell plumbing every repo runs', () => {
  assert.ok(NOISE.test('cd build'));
  assert.ok(NOISE.test('echo done'));
  assert.ok(!NOISE.test('npm test'));
});

test('dependency fetching is setup, not a gate', () => {
  assert.ok(setup('npm ci'));
  assert.ok(setup('uv sync'));
  assert.ok(setup('actions/checkout@v4'));
  assert.ok(!setup('npm test'));
});

test('a script whose name ends in ci is a gate, not setup', () => {
  assert.ok(!setup('pnpm test:ci'));
  assert.ok(!setup('make verify-ci'));
  assert.ok(!setup('npm run build:ci'));
});

test('bare ci belongs to a package manager, not to any word', () => {
  assert.ok(BARE_CI.test('npm ci'));
  assert.ok(BARE_CI.test('yarn ci'));
  assert.ok(!BARE_CI.test('pnpm test:ci'));
  assert.ok(!BARE_CI.test('npm run ci'));
});

// ── probe.mjs end to end ────────────────────────────────────────────────────
// Spawned, never imported: probe.mjs runs its whole body at import. HOME,
// USERPROFILE and CLAUDE_CONFIG_DIR all point into a temp dir, so no run here
// ever reads the developer's real ~/.claude.

const PROBE = fileURLToPath(new URL('../skills/init/probe.mjs', import.meta.url));

const write = (root, rel, text) => {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};

// A fresh `git init` (no commit) so the probe's climb stops at the temp repo and
// not at some enclosing repository. The dot and underscore in the prefix are the
// characters the old project-dir encoding kept and Claude Code does not.
const inProbeRepo = (files, fn) => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'wb.probe_')));
  const repo = join(base, 'my.repo_x');
  const config = join(base, 'config');
  try {
    mkdirSync(repo);
    execFileSync('git', ['init', '-q'], { cwd: repo, stdio: 'ignore' });
    for (const [rel, text] of Object.entries(files)) write(repo, rel, text);
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: repo,
      encoding: 'utf8',
    });
    // Claude Code's own rule: every character outside [A-Za-z0-9] becomes '-'.
    const project = join(config, 'projects', resolve(top.trim()).replace(/[^A-Za-z0-9]/g, '-'));
    const probe = () =>
      spawnSync(process.execPath, [PROBE], {
        cwd: repo,
        encoding: 'utf8',
        env: { ...process.env, HOME: base, USERPROFILE: base, CLAUDE_CONFIG_DIR: config },
      });
    fn({ repo, project, probe });
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
};

const section = (out, name) => out.split(`## ${name}\n`)[1].split('\n## ')[0];

const bash = (command) =>
  JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'Bash', input: { command } }] },
  });

test('hook leads read session history and nested-metadata memory under a dotted path', () =>
  inProbeRepo({}, ({ project, probe }) => {
    write(project, 's1.jsonl', [1, 2, 3].map(() => bash('npm test')).join('\n') + '\n');
    write(
      project,
      'memory/rule.md',
      '---\nname: rule\nmetadata:\n  node_type: memory\n  type: feedback\n---\n\n' +
        'Always run the formatter before you commit anything.\n',
    );
    const r = probe();
    assert.equal(r.status, 0, r.stderr);
    const leads = section(r.stdout, 'Hook leads');
    assert.match(leads, /^`npm test` 3×$/m);
    assert.match(
      leads,
      /memory \(feedback\): "Always run the formatter before you commit anything\."/,
    );
    assert.match(leads, /Sessions: 1 sampled/);
    assert.match(leads, /Memory: 1 file read/);
  }));

test('a CRLF memory file is read like an LF one', () =>
  inProbeRepo({}, ({ project, probe }) => {
    write(
      project,
      'memory/rule.md',
      '---\r\ntype: project\r\n---\r\n\r\nNever edit the generated tree by hand.\r\n',
    );
    assert.match(probe().stdout, /memory \(project\): "Never edit the generated tree by hand\."/);
  }));

test('hook leads past the shown cap are counted, not dropped in silence', () =>
  inProbeRepo({}, ({ project, probe }) => {
    const rules = Array.from({ length: 14 }, (_, i) => `Always run check number ${i} first.`);
    write(project, 'memory/many.md', `---\ntype: feedback\n---\n\n${rules.join('\n')}\n`);
    const leads = section(probe().stdout, 'Hook leads');
    assert.equal(leads.match(/^memory \(feedback\)/gm).length, 12);
    assert.match(leads, /^…and 2 more$/m);
  }));

test('with no session history or memory the section says unsampled, not None', () =>
  inProbeRepo({}, ({ probe }) => {
    const leads = section(probe().stdout, 'Hook leads');
    assert.doesNotMatch(leads, /^None\.$/m);
    assert.match(leads, /^Not sampled/m);
    assert.match(leads, /Sessions: none at /);
    assert.match(leads, /Memory: none at /);
  }));

test('context skips dotfiles under .claude/<kind>/ and nested CLAUDE.md is not a rival doctrine', () =>
  inProbeRepo(
    {
      'CLAUDE.md': '# root\n',
      'packages/a/CLAUDE.md': '# a\n',
      '.claude/hooks/.gitattributes': '* text\n',
      '.claude/hooks/nudge.sh': 'echo hi\n',
    },
    ({ probe }) => {
      const out = probe().stdout;
      assert.match(section(out, 'Context already here'), /^\.claude\/hooks\/ {2}nudge$/m);
      assert.doesNotMatch(out, /Multiple doctrine files/);
    },
  ));

test('two root doctrine files still raise the which-is-authoritative lead', () =>
  inProbeRepo({ 'CLAUDE.md': '# root\n', 'AGENTS.md': '# agents\n' }, ({ probe }) =>
    assert.match(probe().stdout, /Multiple doctrine files/),
  ));

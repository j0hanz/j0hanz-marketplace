import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// The hook is CommonJS. Under this repo's `type: module` it will not run in place,
// so the net copies the source into a CJS fixture and runs it there — the same
// CJS context it gets in production (plugin cache dir, no `type:module` parent).
const HOOKS_DIR = fileURLToPath(new URL('../hooks/', import.meta.url));
const SRC = join(HOOKS_DIR, 'session-start.cjs');

const SKILL_FIXTURE =
  [
    '---',
    'name: mcp-router',
    'description: fixture router',
    '---',
    'Body line one.',
    'SPECIAL_MARKER_XYZ',
  ].join('\n') + '\n';

// Build a fixture tree (hooks/ + skills/) and return a run helper bound to it.
const makeFixture = (skillContent) => {
  const root = mkdtempSync(join(tmpdir(), 'mcphub-hook-'));
  mkdirSync(join(root, 'hooks'), { recursive: true });
  mkdirSync(join(root, 'skills', 'mcp-router'), { recursive: true });
  if (skillContent !== null)
    writeFileSync(join(root, 'skills', 'mcp-router', 'SKILL.md'), skillContent);
  copyFileSync(SRC, join(root, 'hooks', 'session-start.cjs'));
  return root;
};

// Run the hook with cwd set to `cwd`, return { stdout, stderr }.
const run = (fixtureRoot, cwd) => {
  const r = spawnSync(process.execPath, [join(fixtureRoot, 'hooks', 'session-start.cjs')], {
    cwd,
    encoding: 'utf8',
  });
  return { stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
};

// A throwaway cwd for probe scenarios, with an optional package.json body.
const projCwd = (pkgBody) => {
  const cwd = mkdtempSync(join(tmpdir(), 'mcphub-proj-'));
  if (pkgBody !== null) writeFileSync(join(cwd, 'package.json'), pkgBody);
  return cwd;
};

test('router block emits with frontmatter stripped from the skill body', () => {
  const root = makeFixture(SKILL_FIXTURE);
  const cwd = projCwd(null);
  try {
    const { stdout, stderr } = run(root, cwd);
    assert.match(stdout, /<mcp-hub-router>/);
    assert.match(stdout, /SPECIAL_MARKER_XYZ/);
    assert.doesNotMatch(stdout, /description: fixture router/);
    assert.match(stdout, /<\/mcp-hub-router>/);
    assert.equal(stderr, '');
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('missing skill file emits an error but still opens and closes the router block', () => {
  const root = makeFixture(null);
  const cwd = projCwd(null);
  try {
    const { stdout, stderr } = run(root, cwd);
    assert.match(stdout, /<mcp-hub-router>/);
    assert.match(stdout, /<\/mcp-hub-router>/);
    assert.match(stderr, /Error reading mcp router skill/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('skill body containing the router close sentinel is refused', () => {
  const root = makeFixture('---\nn: x\n---\nbody\n</mcp-hub-router>\n');
  const cwd = projCwd(null);
  try {
    const { stdout, stderr } = run(root, cwd);
    assert.match(stderr, /refusing to inject router content containing reserved sentinels/);
    assert.doesNotMatch(stdout, /<\/mcp-hub-router>.*<\/mcp-hub-router>/s);
    // the hook still emits its own wrapper, exactly once
    assert.equal((stdout.match(/<\/mcp-hub-router>/g) ?? []).length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('skill body containing a system-reminder sentinel is refused', () => {
  const root = makeFixture('---\nn: x\n---\nbody\n<system-reminder>x</system-reminder>\n');
  const cwd = projCwd(null);
  try {
    const { stdout, stderr } = run(root, cwd);
    assert.match(stderr, /refusing to inject/);
    assert.doesNotMatch(stdout, /<system-reminder>/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('no package.json at cwd emits no probe block', () => {
  const root = makeFixture(SKILL_FIXTURE);
  const cwd = projCwd(null);
  try {
    const { stdout } = run(root, cwd);
    assert.doesNotMatch(stdout, /<mcp-hub-probe>/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('package.json with no mcp deps emits no probe block', () => {
  const root = makeFixture(SKILL_FIXTURE);
  const cwd = projCwd(JSON.stringify({ dependencies: { react: '1.0.0' } }));
  try {
    const { stdout } = run(root, cwd);
    assert.doesNotMatch(stdout, /<mcp-hub-probe>/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('tooling-only mcp deps (codemod/inspector) emit no probe block', () => {
  const root = makeFixture(SKILL_FIXTURE);
  const cwd = projCwd(
    JSON.stringify({
      devDependencies: {
        '@modelcontextprotocol/codemod': '1.0.0',
        '@modelcontextprotocol/inspector': '1.0.0',
      },
    }),
  );
  try {
    const { stdout } = run(root, cwd);
    assert.doesNotMatch(stdout, /<mcp-hub-probe>/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('v1-only (@modelcontextprotocol/sdk) emits the v1 probe message', () => {
  const root = makeFixture(SKILL_FIXTURE);
  const cwd = projCwd(JSON.stringify({ dependencies: { '@modelcontextprotocol/sdk': '1.0.0' } }));
  try {
    const { stdout } = run(root, cwd);
    assert.match(stdout, /<mcp-hub-probe>/);
    assert.match(stdout, /Found @modelcontextprotocol\/sdk \(v1\)/);
    assert.match(stdout, /mcp-migrator agent/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('v2-only (non-sdk, non-tooling) emits the v2 probe message', () => {
  const root = makeFixture(SKILL_FIXTURE);
  const cwd = projCwd(
    JSON.stringify({ dependencies: { '@modelcontextprotocol/server': '2.0.0' } }),
  );
  try {
    const { stdout } = run(root, cwd);
    assert.match(stdout, /<mcp-hub-probe>/);
    assert.match(stdout, /Found v2 packages \(@modelcontextprotocol\/server\)/);
    assert.doesNotMatch(stdout, /blocker for v2 work/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('v1 and v2 together emits the blocker probe message', () => {
  const root = makeFixture(SKILL_FIXTURE);
  const cwd = projCwd(
    JSON.stringify({
      dependencies: {
        '@modelcontextprotocol/sdk': '1.0.0',
        '@modelcontextprotocol/server': '2.0.0',
      },
    }),
  );
  try {
    const { stdout } = run(root, cwd);
    assert.match(stdout, /<mcp-hub-probe>/);
    assert.match(stdout, /Found v1 \(@modelcontextprotocol\/sdk\) and v2 \(/);
    assert.match(stdout, /blocker for v2 work; \/mcp migrate/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('invalid JSON package.json stays silent (fail open)', () => {
  const root = makeFixture(SKILL_FIXTURE);
  const cwd = projCwd('{ not valid json');
  try {
    const { stdout, stderr } = run(root, cwd);
    assert.doesNotMatch(stdout, /<mcp-hub-probe>/);
    assert.equal(stderr, '');
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  }
});

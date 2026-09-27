import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const json = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

test('filesystem plugin pins the server to the plugin version with project-scoped stdio defaults', () => {
  const catalog = json('../../../.claude-plugin/marketplace.json');
  const entry = catalog.plugins.find((plugin) => plugin.name === 'filesystem-mcp');
  assert.ok(entry, 'filesystem-mcp must be installable from the catalog');
  assert.equal(entry.source, './plugins/filesystem-mcp');

  const manifest = json('../.claude-plugin/plugin.json');
  assert.equal(manifest.name, entry.name);
  const { mcpServers } = json('../.mcp.json');
  assert.deepEqual(Object.keys(mcpServers), ['filesystem']);
  assert.deepEqual(mcpServers.filesystem, {
    type: 'stdio',
    command: 'npx',
    // Literal args only: the directory validator blocks any variable but
    // ${CLAUDE_PLUGIN_ROOT}. Claude Code starts the server in the project
    // directory, so the working directory is the root and the boundary.
    args: [
      '-y',
      `@j0hanz/filesystem-mcp@${manifest.version}`,
      '--allow-cwd',
      '--root-boundary',
      '.',
    ],
    env: {
      FS_PORT: '',
      FS_ALLOWED_DIRS: '',
      FS_ALLOW_CWD_WALK: 'false',
      FS_ALLOW_MISSING_ROOTS: 'false',
      FS_ALLOW_SENSITIVE: 'false',
    },
  });
});

test('filesystem plugin manifest links the server repo for the directory listing', () => {
  const manifest = json('../.claude-plugin/plugin.json');
  const repo = 'https://github.com/j0hanz/filesystem-mcp';
  assert.equal(manifest.homepage, `${repo}#readme`);
  assert.equal(manifest.repository, repo);
  assert.equal(manifest.documentationUrl, `${repo}#readme`);
  assert.equal(manifest.supportUrl, `${repo}/issues`);
  assert.equal(manifest.privacyPolicyUrl, `${repo}#privacy-policy`);
});

test('filesystem plugin ships a square directory icon with no script or external links', () => {
  const svg = readFileSync(new URL('../.claude-plugin/icon.svg', import.meta.url), 'utf8');
  assert.match(svg, /^<svg\b[^>]*\bviewBox="0 0 512 512"/);
  assert.doesNotMatch(svg, /<script|href=/i);
});

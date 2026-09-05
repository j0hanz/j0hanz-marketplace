import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const json = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

test('filesystem plugin installs the pinned server with project-scoped stdio defaults', () => {
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
    args: ['-y', '@j0hanz/filesystem-mcp@2.0.0', '${CLAUDE_PROJECT_DIR}'],
    env: {
      FS_PORT: '',
      FS_ALLOWED_DIRS: '',
      FS_ALLOW_CWD_WALK: 'false',
      FS_ALLOW_MISSING_ROOTS: 'false',
      FS_ALLOW_SENSITIVE: 'false',
      FS_ROOT_BOUNDARY: '${CLAUDE_PROJECT_DIR}',
    },
  });
});

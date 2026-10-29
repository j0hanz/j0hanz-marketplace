import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('./build-site-data.mjs', import.meta.url));

function generate(
  context,
  mcp,
  { skill = true, manifest = {}, entry = {}, antigravity = false } = {},
) {
  const cwd = mkdtempSync(join(tmpdir(), 'marketplace-data-'));
  context.after(() => rmSync(cwd, { recursive: true, force: true }));
  const write = (path, value) => {
    const target = join(cwd, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
  };
  write('.claude-plugin/marketplace.json', {
    name: 'example',
    plugins: [{ name: 'sample', source: './plugins/sample', category: 'development', ...entry }],
  });
  write('plugins/sample/.claude-plugin/plugin.json', { name: 'sample', ...manifest });
  if (skill) write('plugins/sample/skills/guide/SKILL.md', '---\nname: guide\n---\nGuide.\n');
  if (mcp !== undefined) write('plugins/sample/.mcp.json', mcp);
  if (antigravity) write('plugins/sample/.antigravity-plugin/plugin.json', { name: 'sample' });
  write(
    'README.md',
    '<!-- install:start -->\n<!-- install:end -->\n<!-- copilot:start -->\n<!-- copilot:end -->\n' +
      '<!-- antigravity:start -->\n<!-- antigravity:end -->\n' +
      '<!-- plugins:start -->\n<!-- plugins:end -->\n',
  );
  const result = spawnSync(process.execPath, [script], {
    cwd,
    env: {
      ...process.env,
      VERCEL_GIT_REPO_OWNER: 'example',
      VERCEL_GIT_REPO_SLUG: 'marketplace',
    },
    encoding: 'utf8',
    timeout: 10000,
  });
  return {
    ...result,
    data: () => JSON.parse(readFileSync(join(cwd, 'site/src/data/marketplace.json'), 'utf8')),
    readme: () => readFileSync(join(cwd, 'README.md'), 'utf8'),
  };
}

test('MCP metadata includes sorted names and transports, never launch secrets', (context) => {
  const result = generate(context, {
    mcpServers: {
      remote: {
        type: 'http',
        url: 'https://private.example',
        headers: { Authorization: 'secret' },
      },
      local: { command: 'private-command', args: ['private-path'], env: { TOKEN: 'secret' } },
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.data().plugins[0].mcpServers, [
    { name: 'local', transport: 'stdio' },
    { name: 'remote', transport: 'http' },
  ]);
  assert.doesNotMatch(JSON.stringify(result.data()), /secret|private/);
  assert.match(result.readme(), /MCP servers: `local` \(stdio\), `remote` \(http\)/);
});

for (const config of [undefined, { mcpServers: {} }]) {
  test(`plugins with ${config ? 'empty' : 'no'} MCP configuration have no server entries`, (context) => {
    const result = generate(context, config);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.data().plugins[0].mcpServers, []);
    assert.doesNotMatch(result.readme(), /MCP servers:/);
  });
}

for (const [label, config] of [
  ['broken JSON', '{'],
  ['missing map', {}],
  ['null map', { mcpServers: null }],
  ['array map', { mcpServers: [] }],
  ['null server', { mcpServers: { broken: null } }],
  ['missing command', { mcpServers: { broken: {} } }],
  [
    'unknown transport',
    { mcpServers: { broken: { type: 'websocket', url: 'https://example.com' } } },
  ],
]) {
  test(`rejects ${label} with the plugin configuration path`, (context) => {
    const result = generate(context, config);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Plugin "sample"/);
    assert.match(result.stderr, /plugins[/\\]sample[/\\]\.mcp\.json/);
  });
}

test('manifest MCP overrides are rejected rather than silently omitted', (context) => {
  const result = generate(context, undefined, { manifest: { mcpServers: './other.json' } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /manifest mcpServers is not supported/);
});

test('an MCP-only catalog offers installation and connection verification', (context) => {
  const result = generate(
    context,
    { mcpServers: { filesystem: { command: 'npx' } } },
    { skill: false },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.data().add.claude, '/plugin marketplace add example/marketplace');
  assert.match(result.data().tagline, /1 MCP server/);
  assert.equal(result.data().pageTitle, 'Plugins for coding agents · example');
});

test('every plugin gets a Copilot CLI install line unless tagged claude-code-only', (context) => {
  const result = generate(context);
  assert.equal(result.status, 0, result.stderr);
  const data = result.data();
  assert.equal(data.add.copilot, 'copilot plugin marketplace add example/marketplace');
  assert.equal(data.plugins[0].installs.copilot, 'copilot plugin install sample@example');
  assert.match(result.readme(), /copilot plugin install sample@example/);

  const only = generate(context, undefined, { entry: { tags: ['claude-code-only'] } });
  assert.equal(only.status, 0, only.stderr);
  assert.equal(only.data().plugins[0].installs.copilot, null);
  assert.match(only.readme(), /\/plugin install sample@example/);
  assert.doesNotMatch(only.readme(), /copilot plugin install/);
});

test('a plugin installs in Antigravity CLI from its GitHub folder once it carries a manifest', (context) => {
  const result = generate(context, undefined, { antigravity: true });
  assert.equal(result.status, 0, result.stderr);
  const command =
    'agy plugin install https://github.com/example/marketplace/tree/main/plugins/sample';
  assert.equal(result.data().plugins[0].installs.antigravity, command);
  assert.equal(result.data().add.antigravity, null);
  assert.match(result.readme(), /<!-- antigravity:start -->\n\n```text\nagy plugin install https:/);

  const unported = generate(context);
  assert.equal(unported.status, 0, unported.stderr);
  assert.equal(unported.data().plugins[0].installs.antigravity, null);
  assert.doesNotMatch(unported.readme(), /agy plugin install/);
});

test('a claude-code-only plugin carrying an Antigravity manifest is rejected', (context) => {
  const result = generate(context, undefined, {
    antigravity: true,
    entry: { tags: ['claude-code-only'] },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /tagged claude-code-only but carries \.antigravity-plugin/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { categoriesFor, commandFor } from '../site/src/catalog.ts';
import { capabilities } from '../site/src/site.ts';

const plugin = (category, { copilot = 'c', antigravity = 'a' } = {}) => ({
  category,
  installs: { claude: 'x', copilot, antigravity },
});

const plugins = [
  plugin('learning', { antigravity: null }),
  plugin('frontend'),
  plugin('productivity', { copilot: null, antigravity: null }),
];
const all = ['learning', 'frontend', 'productivity', 'quality'];

test('claude keeps every category a plugin has, in order', () => {
  assert.deepEqual(categoriesFor(plugins, all, 'claude'), ['learning', 'frontend', 'productivity']);
});

test('antigravity drops categories with no antigravity plugin', () => {
  assert.deepEqual(categoriesFor(plugins, all, 'antigravity'), ['frontend']);
});

test('copilot drops a category whose only plugin is claude-code-only', () => {
  assert.deepEqual(categoriesFor(plugins, all, 'copilot'), ['learning', 'frontend']);
});

test('drops a category no plugin has', () => {
  assert.equal(categoriesFor(plugins, all, 'claude').includes('quality'), false);
});

test('commandFor returns the install command', () => {
  assert.equal(commandFor(plugins[0], 'claude'), 'x');
  assert.equal(commandFor(plugins[0], 'copilot'), 'c');
});

test('commandFor returns null where the client cannot install', () => {
  assert.equal(commandFor(plugins[0], 'antigravity'), null);
  assert.equal(commandFor(plugins[2], 'copilot'), null);
  assert.equal(commandFor(plugins[2], 'antigravity'), null);
});

const rich = {
  skills: [{ name: 'audit', description: 'check css' }],
  agents: [],
  mcpServers: [{ name: 'fs', transport: 'stdio' }],
};

test('capabilities lists each kind with its label, count and search terms', () => {
  assert.deepEqual(capabilities(rich), [
    { kind: 'skills', label: 'skill', count: 1, searchTerms: ['audit', 'check css'] },
    { kind: 'agents', label: 'agent', count: 0, searchTerms: [] },
    { kind: 'mcpServers', label: 'MCP server', count: 1, searchTerms: ['fs', 'stdio', 'mcp'] },
  ]);
});

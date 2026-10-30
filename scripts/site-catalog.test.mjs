import assert from 'node:assert/strict';
import test from 'node:test';
import { ALL, commandFor, filterCatalog } from '../site/src/catalog.ts';

const plugin = (category, { copilot = 'c', antigravity = 'a' } = {}) => ({
  category,
  installs: { claude: 'x', copilot, antigravity },
  displayName: category,
  summary: '',
  hookEvents: [],
  skills: [],
  agents: [],
  mcpServers: [],
});

const plugins = [
  plugin('learning', { antigravity: null }),
  plugin('frontend'),
  plugin('productivity', { copilot: null, antigravity: null }),
];
const all = ['learning', 'frontend', 'productivity', 'quality'];

const filter = (client, { chosen = ALL, query = '' } = {}) =>
  filterCatalog(plugins, all, { client, chosen, query });

test('claude keeps every category a plugin has, in order', () => {
  assert.deepEqual(filter('claude').categories, ['learning', 'frontend', 'productivity']);
});

test('antigravity drops categories with no antigravity plugin', () => {
  assert.deepEqual(filter('antigravity').categories, ['frontend']);
});

test('copilot drops a category whose only plugin is claude-code-only', () => {
  assert.deepEqual(filter('copilot').categories, ['learning', 'frontend']);
});

test('drops a category no plugin has', () => {
  assert.equal(filter('claude').categories.includes('quality'), false);
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

test('visible drops plugins the client cannot install', () => {
  assert.deepEqual(filter('antigravity').visible, [plugins[1]]);
});

test('a category choice the client cannot fill falls back to ALL without being forgotten', () => {
  assert.equal(filter('antigravity', { chosen: 'learning' }).category, ALL);
  assert.equal(filter('claude', { chosen: 'learning' }).category, 'learning');
});

test('the needle is trimmed and lowercased, and matches capability text', () => {
  const withSkill = {
    ...plugin('learning'),
    skills: [{ name: 'audit', description: 'check css' }],
  };
  const found = filterCatalog([withSkill, plugin('frontend')], all, {
    client: 'claude',
    chosen: ALL,
    query: '  AUDIT ',
  });
  assert.deepEqual(found, {
    visible: [withSkill],
    needle: 'audit',
    categories: ['learning', 'frontend'],
    category: ALL,
  });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { categoriesFor } from '../site/src/catalog.ts';

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

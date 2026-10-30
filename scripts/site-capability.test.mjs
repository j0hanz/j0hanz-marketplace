import assert from 'node:assert/strict';
import test from 'node:test';
import { capabilities, summary, totals } from '../site/src/capability.ts';

const rich = {
  skills: [
    { name: 'audit', description: 'check css', command: '/audit', argumentHint: '[path]' },
    { name: 'style', description: 'loaded by the agent' },
  ],
  agents: [{ name: 'reviewer', description: 'reviews diffs' }],
  mcpServers: [{ name: 'fs', transport: 'stdio' }],
};
const bare = { skills: [], agents: [], mcpServers: [] };

test('capabilities lists each kind with its label, count, search terms and entries', () => {
  assert.deepEqual(capabilities(rich), [
    {
      kind: 'skills',
      label: 'skill',
      count: 2,
      searchTerms: ['audit', 'check css', 'style', 'loaded by the agent'],
      entries: [
        { name: '/audit', description: 'check css', hint: '[path]' },
        { name: 'style', description: 'loaded by the agent', note: 'model-loaded' },
      ],
    },
    {
      kind: 'agents',
      label: 'agent',
      count: 1,
      searchTerms: ['reviewer', 'reviews diffs'],
      entries: [{ name: 'reviewer', description: 'reviews diffs', tag: 'agent' }],
    },
    {
      kind: 'mcpServers',
      label: 'MCP server',
      count: 1,
      searchTerms: ['fs', 'stdio', 'mcp'],
      entries: [{ name: 'fs', description: 'MCP server (stdio)' }],
    },
  ]);
});

test('totals sums each kind across plugins, in capabilities order', () => {
  assert.deepEqual(totals([rich, bare, rich]), [
    { label: 'skill', total: 4 },
    { label: 'agent', total: 2 },
    { label: 'MCP server', total: 2 },
  ]);
  assert.deepEqual(totals([]), []);
});

test('summary names only the kinds a plugin ships, and is empty when it ships none', () => {
  assert.equal(summary(rich), '2 skills, 1 agent, 1 MCP server');
  assert.equal(summary({ ...bare, agents: rich.agents }), '1 agent');
  assert.equal(summary(bare), '');
});

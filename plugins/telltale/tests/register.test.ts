import { expect, mock, test } from 'claude-code/testing';
import type { On } from 'claude-code';

// The world beneath the plugin, in memory: files the `$.fs` calls answer from, and a record of
// what the plugin asked the engine to do.
type Tool = { id: string; name: string };
type World = {
  files: Map<string, string>;
  writes: { path: string; text: string }[];
  toasts: string[];
  logs: string[];
  opened: { id: string; focus: boolean }[];
  failWrites: boolean;
  steps: Tool[][];
  results: Record<string, { result: unknown; text?: string; isError?: true }>;
  running: string[];
  usage: unknown;
  usageCalls: string[];
  below: string | null;
};

const ROOT = '.claude/telltale';
const DIR = `${ROOT}/s1`;

// The engine hands the stubs absolute paths: keep the part from the log root on.
const rel = (path: string) => {
  const slashed = path.replaceAll('\\', '/');
  const at = slashed.indexOf('.claude/telltale');
  return at === -1 ? slashed : slashed.slice(at);
};

const worldOf = (on: On, files: Record<string, string> = {}): World => {
  const world: World = {
    files: new Map(Object.entries(files)),
    writes: [],
    toasts: [],
    logs: [],
    opened: [],
    failWrites: false,
    steps: [],
    results: {},
    running: [],
    usage: undefined,
    usageCalls: [],
    below: null,
  };
  mock.clock(on);
  on('session.start', ($, e) => ({ cwd: e.cwd }));
  on('session.end', ($, e) => ({ sessionId: e.sessionId }) as never);
  on('session.id', () => ({ value: 's1' }));
  on('command.register', ($, e) => ({ value: { command: e.name } }));
  on('fs.exists', ($, e) => ({
    value:
      world.files.has(rel(e.path)) ||
      [...world.files.keys()].some((f) => f.startsWith(`${rel(e.path)}/`)),
  }));
  on('fs.list', ($, e) => {
    const dir = rel(e.path);
    const names = [...world.files.keys()]
      .filter((f) => f.startsWith(`${dir}/`))
      .map((f) => f.slice(dir.length + 1).split('/')[0]!);
    return {
      value: [...new Set(names)].map((name) => ({ name, kind: 'file' as const, size: 0 })),
    } as never;
  });
  on('fs.write', ($, e) => {
    if (world.failWrites) return { deny: `EACCES: ${e.path}` };
    world.writes.push({ path: rel(e.path), text: e.text });
    world.files.set(rel(e.path), e.text);
    return { value: undefined };
  });
  on('ui.toast', ($, e) => {
    world.toasts.push(e.text);
    return { value: undefined };
  });
  on('ui.log', ($, e) => {
    world.logs.push(e.text);
    return { value: undefined };
  });
  on('ui.open', ($, e) => {
    world.opened.push({ id: e.id, focus: e.focus === true });
    return { value: { isPlaced: true } } as never;
  });
  on('ui.focus', ($, e) => {
    return {};
  });
  on('agent.list', () => ({
    value: world.running.map((id) => ({
      id,
      description: id,
      type: 'general-purpose',
      status: 'running',
    })),
  }));
  on('session.usage', ($, e) => {
    world.usageCalls.push(String((e as { breakdown?: string }).breakdown ?? 'none'));
    return world.usage instanceof Error
      ? { deny: world.usage.message }
      : ({ value: world.usage } as never);
  });
  on('turn.step', async function* ($, e) {
    const tools = world.steps.shift() ?? [];
    for (const [index, tool] of tools.entries()) {
      yield { kind: 'tool', index, id: tool.id, name: tool.name } as never;
    }
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: tools.map((tool) => ({ name: tool.name, input: {} })),
      stopReason: tools.length > 0 ? 'tool_use' : 'end_turn',
      usage: null,
    } as never;
  });
  on(
    'tool.call',
    ($, e) => (world.results[e.tool_use_id] ?? { result: 'ok', text: 'ok' }) as never,
  );
  on('turn.complete', ($, e) => ({ text: world.below ?? e.answer }));
  on('ui.render', () => ({ type: 'Text', children: [''] }) as never);
  return world;
};

const SESSION = { cwd: '/work', surface: 'terminal', isInteractive: true } as const;
const HEADLESS = { cwd: '/work', surface: null, isInteractive: false } as const;

/** One model response through the plugin: its tool chunks, then the result. */
const respond = async ($: never, world: World, tools: Tool[], agentId?: string) => {
  world.steps.push(tools);
  const stream = (
    $ as { turn: { step: (e: unknown) => AsyncGenerator & { result: Promise<unknown> } } }
  ).turn.step({
    turnId: 't',
    index: 0,
    model: 'm',
    messageCount: 1,
    agentId,
  });
  for await (const chunk of stream) void chunk;
  return stream.result;
};

const complete = ($: never, answer = 'done', reason = 'answer', agentId?: string) =>
  ($ as { turn: { complete: (e: unknown) => Promise<{ text: string }> } }).turn.complete({
    turnId: 't',
    answer,
    durationMs: 10,
    isAborted: reason === 'aborted',
    reason,
    agentId,
  });

const lines = (world: World, path: string) =>
  (world.files.get(path) ?? '')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);

const turnFiles = (world: World) =>
  [...world.files.keys()].filter((path) => /\/turn-\d+(-part\d+)?\.jsonl$/.test(path)).sort();

test('R3: a tool result reaches Claude unchanged', async ($, on) => {
  on('tool.call', () => ({ result: 'order_1182: refunded', text: 'order_1182: refunded' }));
  const out = await $.tool.call({ tool: 'mcp__orders__search', tool_use_id: 'u1', q: 'refund' });
  expect(out).toEqual({ result: 'order_1182: refunded', text: 'order_1182: refunded' });
});

test('R3: results pass through unchanged even when every log write fails', async ($, on) => {
  const world = worldOf(on);
  world.failWrites = true;
  world.results.u1 = { result: { content: [{ type: 'text', text: 'T' }] }, text: 'T' };
  on('tool.describe', ($, e) => ({ description: e.description }));
  on('skill.prompt', ($, e) => ({ text: e.text }));
  on('prompt.context', ($, e) => ({ blocks: e.blocks, instructionFiles: e.instructionFiles }));
  await $.session.start(SESSION);
  await respond($ as never, world, [{ id: 'u1', name: 'mcp__orders__search' }]);
  expect(await $.tool.call({ tool: 'mcp__orders__search', tool_use_id: 'u1' } as never)).toEqual({
    result: { content: [{ type: 'text', text: 'T' }] },
    text: 'T',
  });
  expect(
    await $.tool.describe({
      tool: 'mcp__orders__search',
      description: 'D',
      provider: { plugin: 'mcp:orders', tier: 'user' },
    } as never),
  ).toEqual({ description: 'D' });
  expect(await $.skill.prompt({ skill: 's', text: 'S' })).toEqual({ text: 'S' });
  const files = [{ path: '/work/CLAUDE.md', kind: 'project', content: 'C' }];
  expect(await $.prompt.context({ blocks: [], instructionFiles: files } as never)).toEqual({
    blocks: [],
    instructionFiles: files,
  });
  await respond($ as never, world, []);
  expect(await complete($ as never, 'done')).toMatchObject({ text: expect.any(String) });
});

test('R4: a completed MCP call is recorded with its server, size and estimate', async ($, on) => {
  const world = worldOf(on);
  world.results.u1 = { result: 'r', text: 'x'.repeat(8400) };
  await $.session.start(SESSION);
  await respond($ as never, world, [{ id: 'u1', name: 'mcp__orders__search' }]);
  await $.tool.call({ tool: 'mcp__orders__search', tool_use_id: 'u1', q: 'refund' } as never);
  await respond($ as never, world, []);
  await complete($ as never);
  const [record] = lines(world, `${DIR}/turn-1.jsonl`);
  expect(record).toMatchObject({
    type: 'call',
    tool: 'mcp__orders__search',
    server: 'orders',
    agentId: null,
    args: { q: 'refund' },
    chars: 8400,
    estTokens: 2100,
    isError: false,
    head: 'x'.repeat(300),
    tail: 'x'.repeat(300),
    next: 'answered',
    usedInAnswer: [],
  });
  expect(typeof record!.ms).toBe('number');
});

test('R4: a result with no text lists the block kinds it received', async ($, on) => {
  const world = worldOf(on);
  world.results.u1 = { result: { content: [{ type: 'image', data: 'AAAA' }] } };
  await $.session.start(SESSION);
  await respond($ as never, world, [{ id: 'u1', name: 'mcp__shots__take' }]);
  await $.tool.call({ tool: 'mcp__shots__take', tool_use_id: 'u1' } as never);
  await complete($ as never);
  expect(lines(world, `${DIR}/turn-1.jsonl`)[0]).toMatchObject({ chars: 0, blocks: ['image'] });
});

test('R5: one file per turn that made records, none for an empty turn', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  for (const id of ['a', 'b']) {
    await respond($ as never, world, [{ id, name: 'Read' }]);
    await $.tool.call({ tool: 'Read', tool_use_id: id, file_path: '/x' } as never);
    await complete($ as never);
  }
  await complete($ as never);
  await respond($ as never, world, [{ id: 'c', name: 'Read' }]);
  await $.tool.call({ tool: 'Read', tool_use_id: 'c', file_path: '/x' } as never);
  await complete($ as never);
  expect(turnFiles(world)).toEqual([
    `${DIR}/turn-1.jsonl`,
    `${DIR}/turn-2.jsonl`,
    `${DIR}/turn-3.jsonl`,
  ]);
});

test('R4: each record carries its next action and used-in-answer values', async ($, on) => {
  const world = worldOf(on);
  world.results.a = { result: 'r', text: 'found order_1182' };
  await $.session.start(SESSION);
  await respond($ as never, world, [{ id: 'a', name: 'mcp__o__s' }]);
  await $.tool.call({ tool: 'mcp__o__s', tool_use_id: 'a' } as never);
  await respond($ as never, world, [{ id: 'b', name: 'mcp__o__s' }]);
  await $.tool.call({ tool: 'mcp__o__s', tool_use_id: 'b' } as never);
  await respond($ as never, world, []);
  await complete($ as never, 'Refunded order_1182');
  const records = lines(world, `${DIR}/turn-1.jsonl`);
  expect(records[0]).toMatchObject({ next: 'retried', usedInAnswer: ['order_1182'] });
  expect(records[1]).toMatchObject({ next: 'answered', usedInAnswer: [] });
});

test('R7: a skill expansion is recorded with its size', async ($, on) => {
  const world = worldOf(on);
  on('skill.prompt', ($, e) => ({ text: e.text }));
  await $.session.start(SESSION);
  await $.skill.prompt({ skill: 's', text: 'k'.repeat(5600) });
  await complete($ as never);
  expect(lines(world, `${DIR}/turn-1.jsonl`)).toEqual([
    { type: 'skill', skill: 's', chars: 5600, estTokens: 1400 },
  ]);
});

test('R8: context records for the start and after /clear, never overwritten', async ($, on) => {
  const world = worldOf(on);
  on('prompt.context', ($, e) => ({ blocks: e.blocks, instructionFiles: e.instructionFiles }));
  on('tool.describe', ($, e) => ({ description: e.description }));
  const files = [{ path: '/work/CLAUDE.md', kind: 'project', content: 'hello' }];
  await $.session.start(SESSION);
  await $.tool.describe({
    tool: 'mcp__orders__search',
    description: 'Search orders',
    provider: { plugin: 'mcp:orders', tier: 'user' },
  } as never);
  await $.prompt.context({ blocks: [], instructionFiles: files } as never);
  await complete($ as never);
  await $.session.end({ reason: 'clear', sessionId: 's1' } as never);
  await $.prompt.context({ blocks: [], instructionFiles: files } as never);
  await complete($ as never);
  const first = JSON.parse(world.files.get(`${DIR}/context-1.json`)!);
  expect(first).toEqual({
    reason: 'start',
    files: [{ path: '/work/CLAUDE.md', kind: 'project', chars: 5 }],
    tools: [{ tool: 'mcp__orders__search', server: 'orders', chars: 13, deferred: false }],
  });
  expect(JSON.parse(world.files.get(`${DIR}/context-2.json`)!).reason).toBe('clear');
});

test('R8: a resumed session numbers its records after the ones already there', async ($, on) => {
  const world = worldOf(on, {
    [`${DIR}/context-1.json`]: '{}',
    [`${DIR}/context-2.json`]: '{}',
    [`${DIR}/turn-4.jsonl`]: '{}',
  });
  on('prompt.context', ($, e) => ({ blocks: e.blocks }));
  await $.session.start(SESSION);
  await $.prompt.context({ blocks: [] } as never);
  await respond($ as never, world, [{ id: 'a', name: 'Read' }]);
  await $.tool.call({ tool: 'Read', tool_use_id: 'a', file_path: '/x' } as never);
  await complete($ as never);
  expect(JSON.parse(world.files.get(`${DIR}/context-3.json`)!).reason).toBe('start');
  expect(world.files.has(`${DIR}/turn-5.jsonl`)).toBe(true);
});

test('R14: a secret argument is redacted in the log', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await respond($ as never, world, [{ id: 'a', name: 'mcp__api__get' }]);
  await $.tool.call({ tool: 'mcp__api__get', tool_use_id: 'a', token: 'abc123', q: 'x' } as never);
  await complete($ as never);
  expect(lines(world, `${DIR}/turn-1.jsonl`)[0]!.args).toEqual({ token: '[redacted]', q: 'x' });
});

test('R14: a secret the answer echoes is redacted in usedInAnswer', async ($, on) => {
  const world = worldOf(on);
  const key = 'AKIA' + 'Q7ZX2P9LMN4RTV8W';
  await $.session.start(SESSION);
  await callThrough($ as never, world, 'u1', 'Read', `AWS_ACCESS_KEY_ID=${key}\n`);
  await respond($ as never, world, []);
  await complete($ as never, `The key ${key} in .env is exposed; rotate it.`);
  const [record] = lines(world, `${DIR}/turn-1.jsonl`);
  expect(record!.usedInAnswer).toEqual(['[redacted]']);
  expect(JSON.stringify(record)).not.toContain(key);
});

test(
  'R15: with full payloads a 600-call turn takes three parts',
  { options: { fullPayloads: true } },
  async ($, on) => {
    const world = worldOf(on);
    await $.session.start(SESSION);
    for (let i = 0; i < 600; i++) world.results[`c${i}`] = { result: 'r', text: 't'.repeat(4000) };
    await respond(
      $ as never,
      world,
      Array.from({ length: 600 }, (_, i) => ({ id: `c${i}`, name: 'Read' })),
    );
    for (let i = 0; i < 600; i++) {
      await $.tool.call({ tool: 'Read', tool_use_id: `c${i}`, file_path: '/x' } as never);
    }
    await complete($ as never);
    const parts = turnFiles(world);
    expect(parts).toHaveLength(3);
    expect(parts.flatMap((path) => lines(world, path))).toHaveLength(600);
    for (const path of parts) expect(world.files.get(path)!.length).toBeLessThan(4 * 1024 * 1024);
  },
);

test('R16: a failing log folder gives one notice per session, and turns complete', async ($, on) => {
  const world = worldOf(on);
  world.failWrites = true;
  await $.session.start(SESSION);
  for (const id of ['a', 'b']) {
    await respond($ as never, world, [{ id, name: 'Read' }]);
    await $.tool.call({ tool: 'Read', tool_use_id: id, file_path: '/x' } as never);
    expect(await complete($ as never, 'ok')).toMatchObject({ text: expect.any(String) });
  }
  expect(world.toasts).toEqual([`telltale: cannot write logs to ${DIR}`]);
});

test('R5: the turn file is written even when a pane-state write is refused', async ($, on) => {
  const world = worldOf(on);
  let refuse = false;
  on('state.set', (_$, e, next) => (refuse ? { deny: 'state refused' } : next(e)));
  world.results.u1 = { result: 'r', text: 'found order_1182' };
  await $.session.start(SESSION);
  await respond($ as never, world, [{ id: 'u1', name: 'mcp__orders__search' }]);
  await $.tool.call({ tool: 'mcp__orders__search', tool_use_id: 'u1' } as never);
  await respond($ as never, world, []);
  refuse = true;
  const out = await complete($ as never, 'order_1182 refunded');
  refuse = false;
  expect(turnFiles(world)).toEqual([`${DIR}/turn-1.jsonl`]);
  expect(lines(world, `${DIR}/turn-1.jsonl`)[0]).toMatchObject({
    tool: 'mcp__orders__search',
    next: 'answered',
    usedInAnswer: ['order_1182'],
  });
  expect(out.text).toContain('telltale: 1 MCP call');
});

test('R6: headless, a failing log folder goes to the debug log only', async ($, on) => {
  const world = worldOf(on);
  world.failWrites = true;
  await $.session.start(HEADLESS);
  await respond($ as never, world, [{ id: 'a', name: 'Read' }]);
  await $.tool.call({ tool: 'Read', tool_use_id: 'a', file_path: '/x' } as never);
  await complete($ as never);
  expect(world.toasts).toEqual([]);
  expect(world.logs).toEqual([`telltale: cannot write logs to ${DIR}`]);
});

test('R19: the log folder gets an ignore file', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await respond($ as never, world, [{ id: 'a', name: 'Read' }]);
  await $.tool.call({ tool: 'Read', tool_use_id: 'a', file_path: '/x' } as never);
  await complete($ as never);
  expect(world.files.get(`${ROOT}/.gitignore`)).toBe('*\n');
});

test('R2: a background call made between turns lands in the next turn', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await respond($ as never, world, [{ id: 'z', name: 'mcp__o__s' }], 'a1');
  await $.tool.call({ tool: 'mcp__o__s', tool_use_id: 'z', agentId: 'a1' } as never);
  await respond($ as never, world, []);
  await complete($ as never);
  expect(lines(world, `${DIR}/turn-1.jsonl`)[0]).toMatchObject({
    tool: 'mcp__o__s',
    agentId: 'a1',
  });
});

const mcpTurn = async ($: never, world: World) => {
  world.results.m1 = { result: 'r', text: 'a'.repeat(4200) };
  world.results.m2 = { result: 'r', text: 'b'.repeat(4200), isError: true };
  for (let i = 0; i < 5; i++) {
    world.results[`r${i}`] =
      i === 0 ? { result: 'e', text: 'bad', isError: true } : { result: 'r', text: 'ok' };
  }
  const tools = [
    { id: 'm1', name: 'mcp__orders__search' },
    { id: 'm2', name: 'mcp__orders__refund' },
    ...Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, name: 'Read' })),
  ];
  await respond($, world, tools);
  const call = ($ as { tool: { call: (e: unknown) => Promise<unknown> } }).tool.call;
  for (const tool of tools) await call({ tool: tool.name, tool_use_id: tool.id, file_path: '/x' });
  await respond($, world, []);
};

test('R1: the receipt counts MCP calls only', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await mcpTurn($ as never, world);
  expect((await complete($ as never, 'done')).text).toBe(
    'telltale: 2 MCP calls · 1 error · ~2.1k tok',
  );
});

test('R1: one call of 3,999 characters rounds up to 1.0k', async ($, on) => {
  const world = worldOf(on);
  world.results.m = { result: 'r', text: 'c'.repeat(3999) };
  await $.session.start(SESSION);
  await respond($ as never, world, [{ id: 'm', name: 'mcp__o__s' }]);
  await $.tool.call({ tool: 'mcp__o__s', tool_use_id: 'm' } as never);
  expect((await complete($ as never, 'done')).text).toBe('telltale: 1 MCP call · ~1.0k tok');
});

test('R1: a skill expanded twice is named once', async ($, on) => {
  worldOf(on);
  on('skill.prompt', ($, e) => ({ text: e.text }));
  await $.session.start(SESSION);
  await $.skill.prompt({ skill: 's', text: 'one' });
  await $.skill.prompt({ skill: 's', text: 'two' });
  expect((await complete($ as never, 'done')).text).toBe('telltale: skills: s');
});

test('R1: a turn without MCP calls or skills has no receipt', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await respond($ as never, world, [{ id: 'a', name: 'Read' }]);
  await $.tool.call({ tool: 'Read', tool_use_id: 'a', file_path: '/x' } as never);
  expect((await complete($ as never, 'the answer')).text).toBe('the answer');
});

test('R6: headless runs get no receipt', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(HEADLESS);
  await mcpTurn($ as never, world);
  expect((await complete($ as never, 'the answer')).text).toBe('the answer');
});

test('R2: a subagent turn gets no receipt, and its calls count in the main turn', async ($, on) => {
  const world = worldOf(on);
  world.results.z = { result: 'r', text: 'z'.repeat(400) };
  await $.session.start(SESSION);
  await respond($ as never, world, [{ id: 'z', name: 'mcp__o__s' }], 'a1');
  await $.tool.call({ tool: 'mcp__o__s', tool_use_id: 'z', agentId: 'a1' } as never);
  expect((await complete($ as never, 'sub answer', 'answer', 'a1')).text).toBe('sub answer');
  await respond($ as never, world, []);
  expect((await complete($ as never, 'done')).text).toBe('telltale: 1 MCP call · ~100 tok');
});

// The pane, drawn through the plugin on a terminal 100 columns wide.
const PANE = {
  component: 'Pane',
  surface: 'terminal',
  requestId: 'telltale',
  viewport: { columns: 100, rows: 40, isFullscreen: false },
  props: {
    title: 'telltale',
    isFocused: true,
    bodyColumns: 96,
    placement: 'inline',
    scroll: { offset: 0, bodyRows: 36 },
    view: {},
  },
} as never;

type Element = { type?: string; props?: Record<string, unknown>; children?: unknown[] };
const stringsOf = (node: unknown): string[] => {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(stringsOf);
  const element = node as Element;
  const label = typeof element.props?.label === 'string' ? [element.props.label] : [];
  return [...label, ...(element.children ?? []).flatMap(stringsOf), '\n'];
};
const buttonsOf = (node: unknown): { key: string; autoFocus: boolean }[] => {
  if (node === null || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(buttonsOf);
  const element = node as Element;
  const own =
    element.type === 'Button'
      ? [{ key: String(element.props?.key ?? ''), autoFocus: element.props?.autoFocus === true }]
      : [];
  return [...own, ...(element.children ?? []).flatMap(buttonsOf)];
};

const draw = async ($: never) => {
  const tree = await ($ as { ui: { render: (e: unknown) => Promise<unknown> } }).ui.render(PANE);
  return { text: stringsOf(tree).join(''), buttons: buttonsOf(tree) };
};
const run = ($: never, args = '') =>
  ($ as { command: { run: (e: unknown) => Promise<{ text?: string }> } }).command.run({
    command: 'telltale',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 100 },
  });
const press = ($: never, key: string) =>
  ($ as { ui: { press: (e: unknown) => Promise<unknown> } }).ui.press({ plugin: 'telltale', key });

const callThrough = async ($: never, world: World, id: string, tool = 'mcp__o__s', text = 'ok') => {
  world.results[id] = { result: 'r', text };
  await respond($, world, [{ id, name: tool }]);
  await ($ as { tool: { call: (e: unknown) => Promise<unknown> } }).tool.call({
    tool,
    tool_use_id: id,
    q: id,
  });
};
const focusOf = (buttons: { key: string; autoFocus: boolean }[]) =>
  buttons.find((button) => button.autoFocus)?.key;

test('R9: /telltale opens a focused pane at 100 columns on the newest call', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callThrough($ as never, world, 'a');
  await callThrough($ as never, world, 'b');
  expect((await run($ as never)).text).toBe('opened');
  expect(world.opened).toEqual([{ id: 'telltale', focus: true }]);
  expect(focusOf((await draw($ as never)).buttons)).toBe('row:b');
});

test('R9: reopening from a detail view shows Calls with the newest call selected', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callThrough($ as never, world, 'a');
  await callThrough($ as never, world, 'b');
  await run($ as never);
  await draw($ as never);
  await press($ as never, 'row:a');
  expect((await draw($ as never)).buttons.some((button) => button.key === 'back')).toBe(true);
  await run($ as never);
  expect(focusOf((await draw($ as never)).buttons)).toBe('row:b');
  expect(world.opened).toHaveLength(2);
});

test('R10: an empty list says so, and rows run newest first', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await run($ as never);
  expect((await draw($ as never)).text).toContain('No tool calls yet');
  await callThrough($ as never, world, 'a', 'mcp__first__x');
  await callThrough($ as never, world, 'b', 'mcp__second__y');
  const { text } = await draw($ as never);
  expect(text.indexOf('mcp__second__y')).toBeLessThan(text.indexOf('mcp__first__x'));
});

test('R11: a row opens its detail, and b returns with the same call selected', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callThrough($ as never, world, 'a', 'mcp__o__s', '{"a":1}');
  await callThrough($ as never, world, 'b');
  await run($ as never);
  await draw($ as never);
  await press($ as never, 'row:a');
  const detail = await draw($ as never);
  expect(detail.text).toContain('{\n  "a": 1\n}');
  expect(detail.text).toContain('duration includes any permission prompt');
  await press($ as never, 'back');
  expect(focusOf((await draw($ as never)).buttons)).toBe('row:a');
});

test('R11: the first call to arrive is selected', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await run($ as never);
  await draw($ as never);
  await callThrough($ as never, world, 'first');
  expect(focusOf((await draw($ as never)).buttons)).toBe('row:first');
});

test('R11: a selected call stays selected when new calls arrive', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callThrough($ as never, world, 'c');
  await run($ as never);
  await callThrough($ as never, world, 'd');
  expect(focusOf((await draw($ as never)).buttons)).toBe('row:c');
});

test('R17: /clear empties the list, even from a detail view', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callThrough($ as never, world, 'a');
  await run($ as never);
  await draw($ as never);
  await press($ as never, 'row:a');
  await $.session.end({ reason: 'clear', sessionId: 's1' } as never);
  expect((await draw($ as never)).text).toContain('No tool calls yet');
});

test('R20: a 200,000-character result shows 20,000 characters and the cut count', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callThrough($ as never, world, 'big', 'mcp__o__s', 'w'.repeat(200_000));
  await run($ as never);
  await draw($ as never);
  await press($ as never, 'row:big');
  const { text } = await draw($ as never);
  expect(text).toContain('180000 chars cut');
  expect(text).not.toContain('w'.repeat(20_001));
});

test('R20: a 15,000-character JSON result is indented whole, with no cut line', async ($, on) => {
  const world = worldOf(on);
  const json = JSON.stringify(Array.from({ length: 1500 }, (_, i) => ({ i })));
  await $.session.start(SESSION);
  await callThrough($ as never, world, 'j', 'mcp__o__s', json);
  await run($ as never);
  await draw($ as never);
  await press($ as never, 'row:j');
  const { text } = await draw($ as never);
  expect(text).not.toContain('chars cut');
  expect(text).toContain('"i": 1499');
});

test('R23: 2 switches to the Inventory, and an unknown view is named', async ($, on) => {
  const world = worldOf(on);
  world.usage = { context: { window: 1, breakdown: { mcpTools: [], memoryFiles: [] } } };
  await $.session.start(SESSION);
  await run($ as never);
  await draw($ as never);
  await press($ as never, 'view:inventory');
  expect((await draw($ as never)).text).toContain('MCP tools');
  expect((await run($ as never, ' foo bar ')).text).toBe(
    'unknown view "foo bar"; views: calls, inventory',
  );
  expect((await draw($ as never)).text).toContain('No tool calls yet');
  await run($ as never, 'Inventory');
  expect((await draw($ as never)).text).toContain('MCP tools');
});

test('R25: the list keeps 200 calls and counts the rest', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  for (let i = 0; i < 201; i++) await callThrough($ as never, world, `c${i}`, 'Read');
  await run($ as never);
  const { text, buttons } = await draw($ as never);
  expect(buttons.filter((button) => button.key.startsWith('row:'))).toHaveLength(200);
  expect(text).toContain('1 older calls are in the logs');
});

test('R6: headless, /telltale answers that the pane needs an interactive session', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(HEADLESS);
  expect((await run($ as never, 'inventory')).text).toBe('the pane needs an interactive session');
  expect(world.opened).toEqual([]);
});

test('R12: a pending call is relabelled when its agent responds', async ($, on) => {
  const world = worldOf(on);
  world.running = ['a1'];
  await $.session.start(SESSION);
  await respond($ as never, world, [{ id: 'z', name: 'mcp__o__s' }], 'a1');
  await $.tool.call({ tool: 'mcp__o__s', tool_use_id: 'z', agentId: 'a1' } as never);
  await respond($ as never, world, []);
  await complete($ as never);
  expect(lines(world, `${DIR}/turn-1.jsonl`)[0]).toMatchObject({ next: 'pending' });
  await respond($ as never, world, [], 'a1');
  await run($ as never);
  await draw($ as never);
  await press($ as never, 'row:z');
  expect((await draw($ as never)).text).toContain('next: answered');
  expect(lines(world, `${DIR}/turn-1.jsonl`)[0]).toMatchObject({ next: 'pending' });
});

const usageOf = (
  tools: [string, string, number, boolean][],
  skills: unknown[] = [],
  memory: unknown[] = [],
) => ({
  context: {
    window: 200_000,
    breakdown: {
      mcpTools: tools.map(([serverName, name, tokens, isLoaded]) => ({
        serverName,
        name,
        tokens,
        isLoaded,
      })),
      skills: { skillFrontmatter: skills },
      memoryFiles: memory,
    },
  },
});

test('R18: MCP tools grouped by server, costliest first, with empty groups named', async ($, on) => {
  const world = worldOf(on);
  world.usage = usageOf([
    ['a', 'a_small', 10, true],
    ['a', 'a_big', 300, true],
    ['a', 'a_mid', 50, false],
    ['b', 'b_only', 20, true],
  ]);
  await $.session.start(SESSION);
  await run($ as never, 'inventory');
  const { text } = await draw($ as never);
  expect(text.indexOf('a_big')).toBeLessThan(text.indexOf('a_mid'));
  expect(text.indexOf('a_mid')).toBeLessThan(text.indexOf('a_small'));
  expect(text).toContain('a_mid  50 tok  est  deferred');
  expect(text).toContain('b_only  20 tok  est  loaded');
  expect(text).toContain('No skills listed');
  expect(text).toContain('No memory files loaded');
  world.usage = usageOf([]);
  await run($ as never, 'inventory');
  expect((await draw($ as never)).text).toContain('No MCP servers connected');
});

test('R18: skills sit under their plugin, or under the source Claude Code names', async ($, on) => {
  const world = worldOf(on);
  world.usage = usageOf(
    [],
    [
      { name: 'one', source: 'plugin', pluginName: 'p', tokens: 40 },
      { name: 'mine', source: 'userSettings', tokens: 30 },
    ],
    [{ path: '/work/CLAUDE.md', type: 'Project', tokens: 90 }],
  );
  await $.session.start(SESSION);
  await run($ as never, 'inventory');
  const { text } = await draw($ as never);
  expect(text).toMatch(/\np\n {2}one {2}40 tok {2}est/);
  expect(text).toMatch(/\nuser\n {2}mine {2}30 tok {2}est/);
  expect(text).toContain('/work/CLAUDE.md  90 tok  est');
});

test('R21: no count until m, then measured rows, and new rows stay est', async ($, on) => {
  const world = worldOf(on);
  world.usage = usageOf([['a', 'tool_a', 10, true]]);
  await $.session.start(SESSION);
  await run($ as never, 'inventory');
  await draw($ as never);
  expect(world.usageCalls).toEqual(['summary']);
  world.usage = usageOf([['a', 'tool_a', 12, true]]);
  await press($ as never, 'measure');
  expect(world.usageCalls).toEqual(['summary', 'full']);
  expect((await draw($ as never)).text).toContain('tool_a  12 tok  measured');
  world.usage = usageOf([
    ['a', 'tool_a', 10, true],
    ['b', 'tool_b', 7, true],
  ]);
  await press($ as never, 'view:inventory');
  const { text } = await draw($ as never);
  expect(text).toContain('tool_a  12 tok  measured');
  expect(text).toContain('tool_b  7 tok  est');
});

test('R21: a failed count keeps the rows and names the failure', async ($, on) => {
  const world = worldOf(on);
  world.usage = usageOf([['a', 'tool_a', 10, true]]);
  await $.session.start(SESSION);
  await run($ as never, 'inventory');
  await draw($ as never);
  world.usage = new Error('rate limited');
  await press($ as never, 'measure');
  const { text } = await draw($ as never);
  expect(text).toContain('tool_a  10 tok  est');
  expect(text).toMatch(/measure failed: .+/);
});

test('R22: no usage report leaves the Calls view working', async ($, on) => {
  const world = worldOf(on);
  world.usage = new Error('no session');
  await $.session.start(SESSION);
  await callThrough($ as never, world, 'a');
  await run($ as never, 'inventory');
  expect((await draw($ as never)).text).toContain('Context usage unavailable');
  await press($ as never, 'measure').catch(() => undefined);
  await press($ as never, 'view:calls');
  expect((await draw($ as never)).text).toContain('mcp__o__s');
});

// Regressions from the 2026-10-03 bug hunt (telltale.hunt.md).

test(
  'R1: a call another plugin makes through $.tool.call is not counted as Claude’s',
  {
    plugins: [
      {
        name: 'poker',
        register: (on) => {
          on('session.start', async ($, e, next) => {
            await $.command.register({ name: 'poke', description: 'calls an MCP tool' });
            return next(e);
          });
          on('command.run', { command: 'poke' }, async ($) => {
            await $.tool.call({ tool: 'mcp__o__s', q: 'from a plugin' } as never);
            return { text: 'poked' };
          });
        },
      },
    ],
  },
  async ($, on) => {
    const world = worldOf(on);
    await $.session.start(SESSION);
    await $.command.run({
      command: 'poke',
      args: '',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: false, columns: 100 },
    } as never);
    expect((await complete($ as never, 'the answer')).text).toBe('the answer');
    expect(turnFiles(world)).toEqual([]);
  },
);

const KEPT = [{ role: 'user', text: 'summary', toolUses: [] }];

test('R8: a subagent’s or a vetoed compaction does not mark the next context compact', async ($, on) => {
  const world = worldOf(on);
  let veto = false;
  on('session.compact', ($, e) => (veto ? { skip: 'blocked' } : { messages: e.messages }) as never);
  on('prompt.context', ($, e) => ({ blocks: e.blocks }));
  await $.session.start(SESSION);
  await $.session.compact({ trigger: 'auto', agentId: 'a1', messages: KEPT } as never);
  veto = true;
  await $.session.compact({ trigger: 'manual', messages: KEPT } as never);
  await $.prompt.context({ blocks: [] } as never);
  await complete($ as never);
  expect(JSON.parse(world.files.get(`${DIR}/context-1.json`)!).reason).toBe('start');
  veto = false;
  await $.session.compact({ trigger: 'manual', messages: KEPT } as never);
  await $.prompt.context({ blocks: [] } as never);
  await complete($ as never);
  expect(JSON.parse(world.files.get(`${DIR}/context-2.json`)!).reason).toBe('compact');
});

test('R1: the receipt follows a line another hook already put beneath the answer', async ($, on) => {
  const world = worldOf(on);
  world.below = 'other line';
  world.results.m = { result: 'r', text: 'q'.repeat(40) };
  await $.session.start(SESSION);
  await respond($ as never, world, [{ id: 'm', name: 'mcp__o__s' }]);
  await $.tool.call({ tool: 'mcp__o__s', tool_use_id: 'm' } as never);
  expect((await complete($ as never, 'the answer')).text).toBe(
    'other line\ntelltale: 1 MCP call · ~10 tok',
  );
});

test('R21: two quick m presses start one count, and skill rows stay est', async ($, on) => {
  const world = worldOf(on);
  world.usage = usageOf(
    [['a', 'tool_a', 10, true]],
    [{ name: 'one', source: 'plugin', pluginName: 'p', tokens: 40 }],
  );
  await $.session.start(SESSION);
  await run($ as never, 'inventory');
  await draw($ as never);
  await Promise.all([press($ as never, 'measure'), press($ as never, 'measure')]);
  expect(world.usageCalls.filter((call) => call === 'full')).toHaveLength(1);
  const { text } = await draw($ as never);
  expect(text).toContain('tool_a  10 tok  measured');
  expect(text).toContain('one  40 tok  est');
});

test('R12: a pending call becomes aborted once its agent stops without responding', async ($, on) => {
  const world = worldOf(on);
  world.running = ['a1'];
  await $.session.start(SESSION);
  await respond($ as never, world, [{ id: 'z', name: 'mcp__o__s' }], 'a1');
  await $.tool.call({ tool: 'mcp__o__s', tool_use_id: 'z', agentId: 'a1' } as never);
  await respond($ as never, world, []);
  await complete($ as never);
  world.running = [];
  await respond($ as never, world, []);
  await complete($ as never);
  await run($ as never);
  await draw($ as never);
  await press($ as never, 'row:z');
  expect((await draw($ as never)).text).toContain('next: aborted');
});

test('R11: when the selected call is evicted, the newest kept call is selected', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  for (let i = 0; i < 201; i++) await callThrough($ as never, world, `c${i}`, 'Read');
  await run($ as never);
  await callThrough($ as never, world, 'late', 'Read');
  const { buttons } = await draw($ as never);
  expect(buttons.find((button) => button.autoFocus)?.key).toBe('row:c200');
});

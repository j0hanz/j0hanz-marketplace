import { expect, mock, test } from 'claude-code/testing';
import type { On } from 'claude-code';
import type { MockClock } from 'claude-code/testing';

// The world beneath the plugin, in memory: files the `$.fs` calls answer from, and a record of
// what the plugin asked the engine to do.
type Tool = { id: string; name: string };
type World = {
  files: Map<string, string>;
  writes: { path: string; text: string }[];
  raw: string[]; // written paths as the engine handed them, before `rel`
  toasts: string[];
  logs: string[];
  opened: { id: string; focus: boolean; holdToasts: boolean }[];
  failWrites: boolean;
  failList: boolean;
  steps: Tool[][];
  results: Record<string, { result: unknown; text?: string; isError?: true }>;
  running: string[];
  usage: unknown;
  usageCalls: string[];
  below: string | null;
  clock: MockClock;
  slow: Record<string, number>; // tool_use_id -> ms the call runs on the mocked clock
  status: (string | undefined)[];
  copied: string[];
  copyResult: unknown;
  listHold: Promise<void>; // agent.list answers once this settles
  throws: Set<string>; // tool_use_ids whose call rejects
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
    raw: [],
    toasts: [],
    logs: [],
    opened: [],
    failWrites: false,
    failList: false,
    steps: [],
    results: {},
    running: [],
    usage: undefined,
    usageCalls: [],
    below: null,
    clock: undefined as never,
    slow: {},
    status: [],
    copied: [],
    copyResult: { isCopied: true },
    listHold: Promise.resolve(),
    throws: new Set(),
  };
  world.clock = mock.clock(on);
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
    world.raw.push(e.path.replaceAll('\\', '/'));
    world.writes.push({ path: rel(e.path), text: e.text });
    world.files.set(rel(e.path), e.text);
    return { value: undefined };
  });
  on('ui.toast', ($, e) => {
    world.toasts.push(e.text);
    return { value: undefined };
  });
  on('ui.status', ($, e) => {
    world.status.push(e.text);
    return { value: undefined };
  });
  on('ui.copy', ($, e) => {
    world.copied.push(e.text);
    return { value: world.copyResult } as never;
  });
  on('ui.log', ($, e) => {
    world.logs.push(e.text);
    return { value: undefined };
  });
  on('ui.open', ($, e) => {
    world.opened.push({ id: e.id, focus: e.focus === true, holdToasts: e.holdToasts === true });
    return { value: { isPlaced: true } } as never;
  });
  on('ui.focus', ($, e) => {
    return {};
  });
  on('agent.list', async () => {
    await world.listHold;
    return world.failList
      ? { deny: 'no list' }
      : {
          value: world.running.map((id) => ({
            id,
            description: id,
            type: 'general-purpose',
            status: 'running',
          })),
        };
  });
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
  on('tool.call', async ($, e) => {
    const ms = world.slow[e.tool_use_id];
    if (ms !== undefined) await world.clock.sleep(ms);
    if (world.throws.has(e.tool_use_id)) throw new Error('the call failed beneath');
    return (world.results[e.tool_use_id] ?? { result: 'ok', text: 'ok' }) as never;
  });
  on('turn.complete', ($, e) => ({ text: world.below ?? e.answer }));
  on('ui.render', () => ({ type: 'Text', children: [''] }) as never);
  return world;
};

/** The last value telltale wrote to each of its state keys. */
const stateOf = (on: On) => {
  const kept = new Map<string, unknown>();
  on('state.set', (_$, e, next) => {
    kept.set(e.key, e.value);
    return next(e);
  });
  return kept;
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
  [...world.files.keys()].filter((path) => /\/turn-\d+(?:-part\d+)?\.jsonl$/.test(path)).sort();

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

test('R3: a tool result returns before any pane-state write', async ($, on) => {
  const world = worldOf(on);
  // Every pane-state write waits on this gate: a hook that awaited one would never return.
  let held = false;
  let open = () => {};
  const gate = new Promise<void>((resolve) => (open = resolve));
  on('state.set', async (_$, e, next) => {
    if (held) await gate;
    return next(e);
  });
  await $.session.start(SESSION);
  await respond($ as never, world, [{ id: 'u1', name: 'mcp__o__s' }]);
  held = true;
  const out = await $.tool.call({ tool: 'mcp__o__s', tool_use_id: 'u1' } as never);
  expect(out).toEqual({ result: 'ok', text: 'ok' });
  open();
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
  expect(world.toasts).toEqual([`telltale: cannot write logs to /work/${DIR}`]);
});

test('R16: the write-failure notice is remembered in pane state', async ($, on) => {
  const world = worldOf(on);
  const kept = stateOf(on);
  world.failWrites = true;
  await $.session.start(SESSION);
  await respond($ as never, world, [{ id: 'a', name: 'Read' }]);
  await $.tool.call({ tool: 'Read', tool_use_id: 'a', file_path: '/x' } as never);
  await complete($ as never);
  expect(kept.get('warned')).toBe(true);
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

test('R5: a call made after the last turn is written when the session ends', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callOne($ as never, world, 'a', 'mcp__db__run_query', 'late');
  await $.session.end({ reason: 'other', sessionId: 's1' } as never);
  await world.clock.settle();
  expect(turnFiles(world)).toEqual([`${DIR}/turn-1.jsonl`]);
  expect(lines(world, `${DIR}/turn-1.jsonl`)[0]).toMatchObject({
    tool: 'mcp__db__run_query',
    next: 'aborted',
  });
});

test('R5: a between-turn call keeps the label of the response that followed it', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callOne($ as never, world, 'a', 'mcp__db__run_query', 'late');
  await respond($ as never, world, []); // a complete response names no tool
  await $.session.end({ reason: 'other', sessionId: 's1' } as never);
  await world.clock.settle();
  expect(lines(world, `${DIR}/turn-1.jsonl`)[0]).toMatchObject({ next: 'answered' });
});

test('R5: /clear still writes no turn file', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callOne($ as never, world, 'a', 'mcp__db__run_query', 'late');
  await $.session.end({ reason: 'clear', sessionId: 's1' } as never);
  await world.clock.settle();
  expect(turnFiles(world)).toEqual([]);
});

test('R6: headless, a failing log folder goes to the debug log only', async ($, on) => {
  const world = worldOf(on);
  world.failWrites = true;
  await $.session.start(HEADLESS);
  await respond($ as never, world, [{ id: 'a', name: 'Read' }]);
  await $.tool.call({ tool: 'Read', tool_use_id: 'a', file_path: '/x' } as never);
  await complete($ as never);
  expect(world.toasts).toEqual([]);
  expect(world.logs).toEqual([`telltale: cannot write logs to /work/${DIR}`]);
});

test('R19: the log folder gets an ignore file', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await respond($ as never, world, [{ id: 'a', name: 'Read' }]);
  await $.tool.call({ tool: 'Read', tool_use_id: 'a', file_path: '/x' } as never);
  await complete($ as never);
  expect(world.files.get(`${ROOT}/.gitignore`)).toBe('*\n');
});

test('R19: logs stay under the starting directory after the session moves', async ($, on) => {
  const world = worldOf(on);
  let moved = false;
  on('session.cwd', (_$, e, next) => (moved ? { value: '/work/sub' } : next(e)));
  await $.session.start(SESSION);
  moved = true;
  await respond($ as never, world, [{ id: 'a', name: 'Read' }]);
  await $.tool.call({ tool: 'Read', tool_use_id: 'a', file_path: '/x' } as never);
  await complete($ as never);
  expect(world.raw.length).toBeGreaterThan(0);
  // On Windows the engine hands `/work` back with a drive letter.
  for (const path of world.raw) {
    expect(path.replace(/^[A-Z]:/i, '').startsWith('/work/.claude/telltale/')).toBe(true);
  }
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
  // A Code element carries its text as `source`, not as children.
  const source = typeof element.props?.source === 'string' ? [element.props.source] : [];
  return [...label, ...source, ...(element.children ?? []).flatMap(stringsOf), '\n'];
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
  const strings = stringsOf(tree);
  return { text: strings.join(''), strings, buttons: buttonsOf(tree) };
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
  expect(world.opened).toEqual([{ id: 'telltale', focus: true, holdToasts: true }]);
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
  await callThrough($ as never, world, 'a', 'mcp__first__xxx');
  await callThrough($ as never, world, 'b', 'mcp__second__yyy');
  const { text } = await draw($ as never);
  expect(text.indexOf('yyy')).toBeLessThan(text.indexOf('xxx'));
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

test(
  'R25: 200 calls with large args and results stay listed, their text out of shared state',
  { timeoutMs: 120_000 },
  async ($, on) => {
    const world = worldOf(on);
    const state = stateOf(on);
    await $.session.start(SESSION);
    for (let i = 0; i < 201; i++) {
      world.results[`c${i}`] = { result: 'r', text: 'r'.repeat(20_000) };
      await respond($ as never, world, [{ id: `c${i}`, name: 'Read' }]);
      await $.tool.call({ tool: 'Read', tool_use_id: `c${i}`, q: 'a'.repeat(20_000) } as never);
    }
    await run($ as never);
    const { text, buttons } = await draw($ as never);
    expect(buttons.filter((button) => button.key.startsWith('row:'))).toHaveLength(200);
    expect(text).toContain('1 older calls are in the logs');
    expect(JSON.stringify(state.get('calls'))).not.toContain('r'.repeat(100));
    expect(JSON.stringify(state.get('calls'))).not.toContain('a'.repeat(100));
    await press($ as never, 'row:c200');
    const detail = (await draw($ as never)).text;
    expect(detail).toContain('r'.repeat(1000));
    expect(detail).toContain('a'.repeat(1000));
  },
);

test('R25: parallel calls each keep their own text in the detail view', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  world.results.p1 = { result: 'r', text: 'TEXT-ONE' };
  world.results.p2 = { result: 'r', text: 'TEXT-TWO' };
  await respond($ as never, world, [
    { id: 'p1', name: 'Read' },
    { id: 'p2', name: 'Read' },
  ]);
  await Promise.all([
    $.tool.call({ tool: 'Read', tool_use_id: 'p1' } as never),
    $.tool.call({ tool: 'Read', tool_use_id: 'p2' } as never),
  ]);
  await run($ as never);
  await draw($ as never);
  await press($ as never, 'row:p2');
  expect((await draw($ as never)).text).toContain('TEXT-TWO');
  await press($ as never, 'back');
  await draw($ as never);
  await press($ as never, 'row:p1');
  expect((await draw($ as never)).text).toContain('TEXT-ONE');
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
  expect((await draw($ as never)).text).toContain('· answered');
  expect(lines(world, `${DIR}/turn-1.jsonl`)[0]).toMatchObject({ next: 'pending' });
});

test('R12: pending ids are kept in pane state until relabelled', async ($, on) => {
  const world = worldOf(on);
  world.running = ['a1'];
  const kept = stateOf(on);
  await $.session.start(SESSION);
  await respond($ as never, world, [{ id: 'z', name: 'mcp__o__s' }], 'a1');
  await $.tool.call({ tool: 'mcp__o__s', tool_use_id: 'z', agentId: 'a1' } as never);
  await respond($ as never, world, []);
  await complete($ as never);
  expect(kept.get('pending')).toEqual({ z: 'a1' });
  await respond($ as never, world, [], 'a1');
  expect(kept.get('pending')).toEqual({});
});

const usageOf = (
  tools: [string, string, number, boolean][],
  skills: unknown[] = [],
  memory: unknown[] = [],
) => ({
  context: {
    window: 200_000,
    breakdown: {
      rawMaxTokens: 200_000,
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
  expect((await draw($ as never)).buttons.some((button) => button.key === 'row:a')).toBe(true);
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
  expect((await draw($ as never)).text).toContain('· aborted');
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

// Regressions from the 2026-10-07 bug hunt (telltale.hunt.md).

test('R12: a failed agent list leaves a subagent call pending, not aborted', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await respond($ as never, world, [{ id: 'z', name: 'mcp__o__s' }], 'a1');
  await $.tool.call({ tool: 'mcp__o__s', tool_use_id: 'z', agentId: 'a1' } as never);
  await respond($ as never, world, []);
  world.failList = true;
  await complete($ as never);
  world.failList = false;
  expect(lines(world, `${DIR}/turn-1.jsonl`)[0]).toMatchObject({ next: 'pending' });
  await respond($ as never, world, [], 'a1');
  await run($ as never);
  await draw($ as never);
  await press($ as never, 'row:z');
  expect((await draw($ as never)).text).toContain('· answered');
});

test(
  'R2: a call Claude streamed is counted even when a plugin’s hook raised it',
  {
    plugins: [
      {
        name: 'spawner',
        register: (on) => {
          on('session.start', async ($, e, next) => {
            await $.command.register({ name: 'relay', description: 'relays a streamed call' });
            return next(e);
          });
          on('command.run', { command: 'relay' }, async ($) => {
            await $.tool.call({ tool: 'mcp__o__s', tool_use_id: 'z', agentId: 'a1' } as never);
            return { text: 'relayed' };
          });
        },
      },
    ],
  },
  async ($, on) => {
    const world = worldOf(on);
    world.results.z = { result: 'r', text: 'z'.repeat(400) };
    await $.session.start(SESSION);
    await respond($ as never, world, [{ id: 'z', name: 'mcp__o__s' }], 'a1');
    await $.command.run({
      command: 'relay',
      args: '',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: false, columns: 100 },
    } as never);
    await respond($ as never, world, []);
    expect((await complete($ as never, 'done')).text).toBe('telltale: 1 MCP call · ~100 tok');
  },
);

test('R13: a long used-in-answer value never puts over 10,000 characters in one Text', async ($, on) => {
  const world = worldOf(on);
  const long = 'v1' + 'x'.repeat(12_000);
  await $.session.start(SESSION);
  await callThrough($ as never, world, 'u', 'mcp__o__s', `found ${long} here`);
  await respond($ as never, world, []);
  await complete($ as never, `The value is ${long}.`);
  await run($ as never);
  await draw($ as never);
  await press($ as never, 'row:u');
  const { text, strings } = await draw($ as never);
  // R48: the line is cut to the pane width; the full values are in the logs.
  expect(text).toContain(`used in answer: v1${'x'.repeat(10)}`);
  for (const s of strings) expect(s.length).toBeLessThanOrEqual(10_000);
  for (const line of text.split('\n')) {
    if (line.startsWith('used in answer')) expect(line.length).toBeLessThanOrEqual(96);
  }
});

// v0.3: session totals, calls in flight and turn numbers (R34, R47).

test('R34: a failed log write still uses up its turn number', async ($, on) => {
  const world = worldOf(on);
  const kept = stateOf(on);
  await $.session.start(SESSION);
  world.failWrites = true;
  await callThrough($ as never, world, 'a');
  await respond($ as never, world, []);
  await complete($ as never);
  world.failWrites = false;
  await callThrough($ as never, world, 'b');
  await respond($ as never, world, []);
  await complete($ as never);
  expect(turnFiles(world)).toEqual([`${DIR}/turn-2.jsonl`]);
  expect((kept.get('calls') as { turn: number }[]).map((call) => call.turn)).toEqual([1, 2]);
  expect(kept.get('turnNo')).toBe(2);
});

test('R34: a call made between turns joins the next turn', async ($, on) => {
  const world = worldOf(on);
  const kept = stateOf(on);
  await $.session.start(SESSION);
  await callThrough($ as never, world, 'a');
  await respond($ as never, world, []);
  await complete($ as never);
  await callThrough($ as never, world, 'b');
  await world.clock.settle();
  expect((kept.get('calls') as { turn: number }[]).map((call) => call.turn)).toEqual([1, 2]);
});

test('R47: session totals and the turn number are kept in pane state', async ($, on) => {
  const world = worldOf(on);
  const kept = stateOf(on);
  on('skill.prompt', ($, e) => ({ text: e.text }));
  await $.session.start(SESSION);
  await callThrough($ as never, world, 'u1', 'mcp__o__s', 'x'.repeat(40));
  world.results.u2 = { result: 'r', text: 'x'.repeat(400), isError: true };
  await respond($ as never, world, [{ id: 'u2', name: 'mcp__o__t' }]);
  await $.tool.call({ tool: 'mcp__o__t', tool_use_id: 'u2' } as never);
  await callThrough($ as never, world, 'r1', 'Read', 'y'.repeat(4000));
  await $.skill.prompt({ skill: 's', text: 'S' });
  await $.skill.prompt({ skill: 's', text: 'S' });
  await respond($ as never, world, []);
  await complete($ as never);
  expect(kept.get('totals')).toMatchObject({
    calls: 2,
    errors: 1,
    tokens: 110,
    skills: ['s'],
    tools: {
      mcp__o__s: { calls: 1, errors: 0, tokens: 10 },
      mcp__o__t: { calls: 1, errors: 1, tokens: 100 },
    },
  });
  expect(kept.get('turnNo')).toBe(1);
});

test('R47: a second session.start keeps the totals and clears calls in flight', async ($, on) => {
  const world = worldOf(on);
  const kept = stateOf(on);
  await $.session.start(SESSION);
  await callThrough($ as never, world, 'u1');
  await respond($ as never, world, []);
  await complete($ as never);
  await $.session.start(SESSION);
  expect((kept.get('totals') as { calls: number }).calls).toBe(1);
  expect(kept.get('running')).toEqual({});
});

test('R26: /clear resets the session totals', async ($, on) => {
  const world = worldOf(on);
  const kept = stateOf(on);
  await $.session.start(SESSION);
  await callThrough($ as never, world, 'u1');
  await $.session.end({ reason: 'clear', sessionId: 's1' } as never);
  expect(kept.get('totals')).toMatchObject({
    calls: 0,
    errors: 0,
    tokens: 0,
    skills: [],
    tools: {},
  });
});

test('R29: a counted call is in flight until its result returns', async ($, on) => {
  const world = worldOf(on);
  const kept = stateOf(on);
  world.slow.slow = 5000;
  await $.session.start(SESSION);
  await respond($ as never, world, [{ id: 'slow', name: 'mcp__db__run_query' }]);
  const call = $.tool.call({ tool: 'mcp__db__run_query', tool_use_id: 'slow' } as never);
  await world.clock.settle();
  expect(Object.keys((kept.get('running') ?? {}) as object)).toEqual(['slow']);
  await world.clock.advance(5000);
  await call;
  await respond($ as never, world, []);
  await complete($ as never);
  expect(kept.get('running')).toEqual({});
});

// v0.3: the status entry and toasts (R26, R27, R28).

/** One counted (or built-in) call through the plugin, errored when asked. */
const callOne = async (
  $: never,
  world: World,
  id: string,
  tool: string,
  text: string,
  isError = false,
) => {
  await respond($, world, [{ id, name: tool }]);
  world.results[id] = isError ? { result: 'r', text, isError: true } : { result: 'r', text };
  await ($ as { tool: { call: (e: unknown) => Promise<unknown> } }).tool.call({
    tool,
    tool_use_id: id,
  });
  await world.clock.settle();
};
const endTurn = async ($: never, world: World) => {
  await respond($, world, []);
  await complete($);
  await world.clock.settle();
};

test('R26: the status entry shows the session totals and the context share', async ($, on) => {
  const world = worldOf(on);
  world.usage = { context: { window: 200_000, percent: 61 } };
  await $.session.start(SESSION);
  for (let i = 0; i < 7; i++) {
    await callOne($ as never, world, `u${i}`, 'mcp__o__s', 'x'.repeat(7200), i === 0);
  }
  expect(world.status.at(-1)).toBe('telltale · 7 MCP · 1✗ · ~12.6k tok');
  await endTurn($ as never, world);
  expect(world.status.at(-1)).toBe('telltale · 7 MCP · 1✗ · ~12.6k tok · ctx 61%');
});

test('R26: no counted call and no skill means no status entry', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callOne($ as never, world, 'r', 'Read', 'x');
  await endTurn($ as never, world);
  expect(world.status.filter((text) => text !== undefined)).toEqual([]);
});

test('R26: /clear removes the status entry', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callOne($ as never, world, 'u', 'mcp__o__s', 'x'.repeat(3600));
  expect(world.status.at(-1)).toBe('telltale · 1 MCP · ~900 tok');
  await $.session.end({ reason: 'clear', sessionId: 's1' } as never);
  await world.clock.settle();
  expect(world.status.at(-1)).toBe(undefined);
});

test('R27: a failing usage report drops only the ctx segment', async ($, on) => {
  const world = worldOf(on);
  world.usage = new Error('no usage');
  await $.session.start(SESSION);
  await callOne($ as never, world, 'a', 'mcp__o__s', 'x'.repeat(1500));
  await callOne($ as never, world, 'b', 'mcp__o__s', 'x'.repeat(1500));
  await endTurn($ as never, world);
  expect(world.status.at(-1)).toBe('telltale · 2 MCP · ~750 tok');
});

test('R28: one toast per turn, and an errored call gets the error text', async ($, on) => {
  const world = worldOf(on);
  const kept = stateOf(on);
  await $.session.start(SESSION);
  await callOne($ as never, world, 'a', 'mcp__db__run_query', 'boom', true);
  await callOne($ as never, world, 'b', 'mcp__github__search', 'x'.repeat(60_000));
  await endTurn($ as never, world);
  expect(world.toasts).toEqual(['db.run_query failed · /telltale']);
  expect(kept.get('toastedTurn')).toBe(1);
  await callOne($ as never, world, 'c', 'mcp__github__search', 'x'.repeat(60_000));
  await endTurn($ as never, world);
  expect(world.toasts).toEqual([
    'db.run_query failed · /telltale',
    'github.search returned ~15.0k tok',
  ]);
});

test('R28: a result under 40,000 characters raises no toast', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callOne($ as never, world, 'a', 'mcp__o__s', 'x'.repeat(39_999));
  await endTurn($ as never, world);
  expect(world.toasts).toEqual([]);
});

test('R28: a built-in call that errors raises no toast', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callOne($ as never, world, 'a', 'Read', 'no such file', true);
  await endTurn($ as never, world);
  expect(world.toasts).toEqual([]);
});

test('R28: the log-write notice does not use up the turn toast', async ($, on) => {
  const world = worldOf(on);
  world.failWrites = true;
  await $.session.start(SESSION);
  await callOne($ as never, world, 'a', 'mcp__db__run_query', 'boom', true);
  await endTurn($ as never, world);
  expect(world.toasts).toEqual([
    'db.run_query failed · /telltale',
    `telltale: cannot write logs to /work/${DIR}`,
  ]);
});

test('R6: headless, telltale sets no status entry and raises no R28 toast', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(HEADLESS);
  await callOne($ as never, world, 'a', 'mcp__db__run_query', 'boom', true);
  await endTurn($ as never, world);
  expect(world.status).toEqual([]);
  expect(world.toasts).toEqual([]);
});

// v0.3: the live band above the prompt (R29, R30, R31).

const band = async ($: never, props: Record<string, unknown> = {}) => {
  const tree = await ($ as { ui: { render: (e: unknown) => Promise<unknown> } }).ui.render({
    component: 'AbovePrompt',
    surface: 'terminal',
    requestId: 'above',
    viewport: { columns: 100, rows: 40, isFullscreen: true },
    props: {
      hasSurvey: false,
      isWorking: true,
      maxRows: 10,
      bodyColumns: 80,
      scroll: { offset: 0, bodyRows: 10 },
      view: {},
      ...props,
    },
  });
  return stringsOf(tree).join('').trim();
};
/** Starts a counted call that runs `ms` on the mocked clock; await the result to finish it. */
const startSlow = async ($: never, world: World, id: string, tool: string, ms: number) => {
  world.slow[id] = ms;
  await respond($, world, [{ id, name: tool }]);
  const done = ($ as { tool: { call: (e: unknown) => Promise<unknown> } }).tool.call({
    tool,
    tool_use_id: id,
  });
  await world.clock.settle();
  // Wrapped: an async function returning the promise itself would wait for the call to end.
  return { done };
};

test('R29: the band names the running call, its time and the turn so far', async ($, on) => {
  const world = worldOf(on);
  const kept = stateOf(on);
  await $.session.start(SESSION);
  await callOne($ as never, world, 'a', 'mcp__o__s', 'x'.repeat(4400), true);
  await callOne($ as never, world, 'b', 'mcp__o__s', 'x'.repeat(4400));
  const { done: slow } = await startSlow($ as never, world, 'q', 'mcp__db__run_query', 10_000);
  await world.clock.advance(3000);
  expect(await band($ as never)).toBe('◐ db.run_query 3s · turn: 2 MCP · ~2.2k tok · 1✗');
  expect(kept.get('tick')).toBeGreaterThanOrEqual(3);
  expect(await band($ as never, { bodyColumns: 30 })).toBe('◐ db.run_query 3s');
  await world.clock.advance(7000);
  await slow;
});

test('R29: two running calls name the longest and count the rest', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  const { done: first } = await startSlow($ as never, world, 'a', 'mcp__a__x', 20_000);
  await world.clock.advance(7000);
  const { done: second } = await startSlow($ as never, world, 'b', 'mcp__b__y', 20_000);
  await world.clock.advance(2000);
  expect(await band($ as never)).toBe('◐ a.x 9s +1 running');
  await world.clock.advance(20_000);
  await Promise.all([first, second]);
});

test('R29: past a minute the elapsed time reads minutes and seconds', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  const { done: slow } = await startSlow($ as never, world, 'a', 'mcp__x__y', 100_000);
  await world.clock.advance(75_000);
  expect(await band($ as never)).toBe('◐ x.y 1m15s');
  await world.clock.advance(25_000);
  await slow;
});

test('R30: the band is empty once the last running call completes', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  const { done: slow } = await startSlow($ as never, world, 'a', 'mcp__x__y', 2000);
  expect(await band($ as never)).toBe('◐ x.y 0s');
  await world.clock.advance(2000);
  await slow;
  await world.clock.settle();
  expect(await band($ as never)).toBe('');
});

test('R30: a running built-in call draws nothing in the band', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  const { done: slow } = await startSlow($ as never, world, 'a', 'Bash', 5000);
  await world.clock.advance(3000);
  expect(await band($ as never)).toBe('');
  await world.clock.advance(2000);
  await slow;
});

test('R31: a survey above the prompt holds the band', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  const { done: slow } = await startSlow($ as never, world, 'a', 'mcp__x__y', 5000);
  await world.clock.advance(3000);
  expect(await band($ as never, { hasSurvey: true })).toBe('');
  await world.clock.advance(2000);
  await slow;
});

// v0.3: the Calls view as a table (R10, R23, R32-R35, R46, R48).

const paneAt = (columns: number) =>
  ({
    ...(PANE as object),
    props: { ...(PANE as { props: object }).props, bodyColumns: columns },
  }) as never;
const drawAt = async ($: never, columns: number) =>
  ($ as { ui: { render: (e: unknown) => Promise<unknown> } }).ui.render(paneAt(columns));
const findKey = (node: unknown, key: string): Element | undefined => {
  if (node === null || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findKey(child, key);
      if (found) return found;
    }
    return undefined;
  }
  const element = node as Element;
  if (element.props?.key === key) return element;
  return findKey(element.children ?? [], key);
};
const elementsOf = (node: unknown): Element[] => {
  if (node === null || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(elementsOf);
  const element = node as Element;
  return [element, ...(element.children ?? []).flatMap(elementsOf)];
};
const rowText = (tree: unknown, id: string) =>
  stringsOf(findKey(tree, `line:${id}`))
    .join('')
    .replaceAll('\n', '');
const linesOf = (tree: unknown) =>
  stringsOf(tree)
    .join('')
    .split('\n')
    .filter((line) => line !== '');

/** Calls made from one model response, each running `ms` on the mocked clock. */
const callBatch = async (
  $: never,
  world: World,
  batch: { id: string; tool: string; text: string; ms?: number; agentId?: string }[],
) => {
  await respond(
    $,
    world,
    batch.map(({ id, tool }) => ({ id, name: tool })),
    batch[0]?.agentId,
  );
  for (const one of batch) {
    world.results[one.id] = { result: 'r', text: one.text };
    world.slow[one.id] = one.ms ?? 0;
    const done = ($ as { tool: { call: (e: unknown) => Promise<unknown> } }).tool.call({
      tool: one.tool,
      tool_use_id: one.id,
      ...(one.agentId ? { agentId: one.agentId } : {}),
    });
    await world.clock.advance(one.ms ?? 0);
    await done;
  }
  await world.clock.settle();
};

test('R32: the Calls view draws an aligned table at 80 columns', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callBatch($ as never, world, [
    { id: 'a', tool: 'mcp__github__search_issues', text: 'x'.repeat(7600), ms: 812 },
    { id: 'b', tool: 'Read', text: 'y'.repeat(1240), ms: 12 },
  ]);
  await endTurn($ as never, world);
  await run($ as never);
  const tree = await drawAt($ as never, 80);
  expect(rowText(tree, 'a')).toBe('search_issues  github  812ms  ~1.9k  answered');
  expect(rowText(tree, 'b')).toBe('Read           -       12ms   ~310   answered');
  expect(linesOf(tree)).toContain('TOOL           SERVER  TIME   TOK    NEXT');
});

test('R32: below 50 columns SERVER and NEXT are left out', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callBatch($ as never, world, [
    { id: 'a', tool: `mcp__github__${'t'.repeat(60)}`, text: 'ok' },
  ]);
  await run($ as never);
  expect(rowText(await drawAt($ as never, 40), 'a')).toBe(`${'t'.repeat(28)}…  0ms   ~1`);
});

test('R32: a subagent call reads ↳ before its tool', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callBatch($ as never, world, [{ id: 'a', tool: 'mcp__o__s', text: 'ok', agentId: 'a1' }]);
  await run($ as never);
  expect(rowText(await drawAt($ as never, 80), 'a').startsWith('↳ s')).toBe(true);
});

test('R33: ✗ is drawn in the error colour and retried in the warning colour', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await respond($ as never, world, [{ id: 'e', name: 'mcp__o__s' }]);
  world.results.e = { result: 'r', text: 'boom', isError: true };
  await $.tool.call({ tool: 'mcp__o__s', tool_use_id: 'e' } as never);
  await respond($ as never, world, [{ id: 'f', name: 'mcp__o__s' }]);
  await $.tool.call({ tool: 'mcp__o__s', tool_use_id: 'f' } as never);
  await endTurn($ as never, world);
  await run($ as never);
  const tree = await drawAt($ as never, 80);
  const coloured = elementsOf(tree).filter((el) => el.type === 'Text' && el.props?.color);
  const textOf = (el: Element) => stringsOf(el).join('').replaceAll('\n', '').trim();
  expect(coloured.find((el) => textOf(el) === '✗')?.props?.color).toBe('error');
  expect(coloured.find((el) => textOf(el) === 'retried')?.props?.color).toBe('warning');
});

test('R34: rows are grouped by turn, newest turn first, under a separator', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callBatch($ as never, world, [
    { id: 'a', tool: 'mcp__o__s', text: 'ok' },
    { id: 'b', tool: 'mcp__o__s', text: 'ok' },
  ]);
  await endTurn($ as never, world);
  await callBatch($ as never, world, [{ id: 'c', tool: 'mcp__o__s', text: 'ok' }]);
  await run($ as never);
  const lines = linesOf(await drawAt($ as never, 80));
  const second = lines.indexOf('turn 2 · 1 call · ~1 tok');
  const first = lines.indexOf('turn 1 · 2 calls · ~2 tok');
  expect(second).toBeGreaterThan(-1);
  expect(first).toBeGreaterThan(second);
});

test('R35: the Calls view ends with its key row', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callBatch($ as never, world, [{ id: 'a', tool: 'mcp__o__s', text: 'ok' }]);
  await run($ as never);
  expect(linesOf(await drawAt($ as never, 80)).at(-1)).toBe('↑↓ select · enter open · esc close');
});

test('R48: no Calls view row is wider than 40 columns at 40', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callBatch($ as never, world, [
    {
      id: 'a',
      tool: `mcp__${'s'.repeat(30)}__${'t'.repeat(60)}`,
      text: 'x'.repeat(5000),
      ms: 61_000,
    },
  ]);
  await run($ as never);
  const tree = await drawAt($ as never, 40);
  expect(rowText(tree, 'a').length).toBeLessThanOrEqual(40);
  for (const line of linesOf(tree)) expect(line.length).toBeLessThanOrEqual(40);
});

test('R10: an empty Calls view names the log folder', async ($, on) => {
  worldOf(on);
  await $.session.start(SESSION);
  await run($ as never);
  const lines = linesOf(await drawAt($ as never, 80));
  expect(lines).toContain('No tool calls yet');
  expect(lines).toContain(`logs: ${DIR}`);
});

test('R23: the tab of the view not shown is dim', async ($, on) => {
  worldOf(on);
  await $.session.start(SESSION);
  await run($ as never);
  const tree = await drawAt($ as never, 80);
  expect(findKey(tree, 'view:inventory')?.props?.dimColor).toBe(true);
  expect(findKey(tree, 'view:calls')?.props?.dimColor).not.toBe(true);
});

test('R46: a view that fails to draw keeps the pane open with the view row', async ($, on) => {
  const world = worldOf(on);
  // A row the view cannot draw: what reaches the store is not what telltale wrote.
  on('state.set', (_$, e, next) =>
    next(e.key === 'calls' ? ({ ...e, value: [{ id: 'x', tool: null }] } as never) : e),
  );
  await $.session.start(SESSION);
  await callThrough($ as never, world, 'a');
  await run($ as never);
  const tree = await drawAt($ as never, 80);
  expect(linesOf(tree)).toContain('this view could not be drawn');
  expect(findKey(tree, 'view:calls')).toBeDefined();
  expect(linesOf(tree).at(-1)).toBe('↑↓ select · enter open · esc close');
});

// v0.3: the detail view (R35-R40, R47).

const openDetail = async ($: never, id: string, columns = 80) => {
  await run($);
  await drawAt($, columns);
  await press($, `row:${id}`);
  return drawAt($, columns);
};

test('R36: the detail header reads the call row figures in order', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callBatch($ as never, world, [
    { id: 'a', tool: 'mcp__github__search_issues', text: 'x'.repeat(7600), ms: 812 },
  ]);
  await endTurn($ as never, world);
  const lines = linesOf(await openDetail($ as never, 'a'));
  expect(lines).toContain('search_issues · github · 812ms · 7600 chars · ~1.9k tok · answered');
});

test('R36: an errored subagent call puts the agent right after the server', async ($, on) => {
  const world = worldOf(on);
  world.running = ['a1b2'];
  await $.session.start(SESSION);
  await respond($ as never, world, [{ id: 'q', name: 'mcp__db__run_query' }], 'a1b2');
  world.results.q = { result: 'r', text: 'x'.repeat(120), isError: true };
  world.slow.q = 2100;
  const done = $.tool.call({
    tool: 'mcp__db__run_query',
    tool_use_id: 'q',
    agentId: 'a1b2',
  } as never);
  await world.clock.advance(2100);
  await done;
  await respond($ as never, world, [{ id: 'q2', name: 'mcp__db__run_query' }], 'a1b2');
  await endTurn($ as never, world);
  const tree = await openDetail($ as never, 'q');
  expect(linesOf(tree)).toContain(
    'run_query · db · agent a1b2 · 2.1s · 120 chars · ~30 tok · retried',
  );
  const error = elementsOf(tree).find(
    (el) => el.type === 'Text' && stringsOf(el).join('').trim() === '· error',
  );
  expect(error?.props?.color).toBe('error');
});

test('R37: JSON text is drawn as json code, and other text plain', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callBatch($ as never, world, [{ id: 'a', tool: 'mcp__o__s', text: '{"a":1}' }]);
  const tree = await openDetail($ as never, 'a');
  const code = elementsOf(tree).filter((el) => el.type === 'Code');
  expect(code.map((el) => el.props?.language)).toEqual(['json', 'json']);
  expect(code.map((el) => el.props?.source)).toContain('{\n  "a": 1\n}');
});

test('R37: a field cut at 20,000 characters is drawn plain', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  const big = JSON.stringify({ list: 'x'.repeat(200_000) });
  await callBatch($ as never, world, [{ id: 'a', tool: 'mcp__o__s', text: big }]);
  const tree = await openDetail($ as never, 'a');
  const sources = elementsOf(tree)
    .filter((el) => el.type === 'Code')
    .map((el) => String(el.props?.source));
  expect(sources.some((source) => source.length > 1000)).toBe(false);
  expect(stringsOf(tree).join('')).toContain(`${big.length - 20_000} chars cut`);
});

test('R38: n shows the older call, p the newer, and b returns to the last shown', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  for (const id of ['a', 'b', 'c']) {
    await callBatch($ as never, world, [{ id, tool: `mcp__o__${id}${id}${id}${id}`, text: 'ok' }]);
  }
  await openDetail($ as never, 'b');
  await press($ as never, 'older');
  expect(linesOf(await drawAt($ as never, 80)).some((line) => line.startsWith('aaaa · o'))).toBe(
    true,
  );
  await press($ as never, 'back');
  expect(focusOf(buttonsOf(await drawAt($ as never, 80)))).toBe('row:a');
  await press($ as never, 'row:c');
  await drawAt($ as never, 80);
  await press($ as never, 'newer');
  expect(linesOf(await drawAt($ as never, 80)).some((line) => line.startsWith('cccc · o'))).toBe(
    true,
  );
});

test('R39: y copies the kept result text and says how much', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callBatch($ as never, world, [
    { id: 'a', tool: 'mcp__o__s', text: 'r'.repeat(3000) },
    { id: 'b', tool: 'mcp__o__s', text: 'q'.repeat(200_000) },
  ]);
  await openDetail($ as never, 'a');
  await press($ as never, 'copyText');
  expect(world.copied).toEqual(['r'.repeat(3000)]);
  expect(linesOf(await drawAt($ as never, 80))).toContain('copied 3000 chars');
  await press($ as never, 'newer');
  expect(linesOf(await drawAt($ as never, 80))).not.toContain('copied 3000 chars');
  await press($ as never, 'copyText');
  expect(world.copied[1]).toBe('q'.repeat(20_000));
  expect(linesOf(await drawAt($ as never, 80))).toContain('copied 20000 of 200000 chars');
  await press($ as never, 'copyArgs');
  expect(world.copied[2]).toBe('{}');
});

test('R40: a copy Claude Code refuses names its reason', async ($, on) => {
  const world = worldOf(on);
  world.copyResult = { isCopied: false, reason: 'no-clipboard' };
  await $.session.start(SESSION);
  await callBatch($ as never, world, [{ id: 'a', tool: 'mcp__o__s', text: 'ok' }]);
  await openDetail($ as never, 'a');
  await press($ as never, 'copyArgs');
  expect(linesOf(await drawAt($ as never, 80))).toContain('copy failed: no-clipboard');
});

test('R40, R47: a call whose text was not kept makes no copy request', async ($, on) => {
  const world = worldOf(on);
  // A row from before a reload: listed in state, its text gone from this module's memory.
  const ghost = {
    id: 'ghost',
    tool: 'mcp__o__s',
    server: 'o',
    agentId: null,
    response: null,
    ms: 5,
    argsChars: 2,
    textChars: 2,
    isError: false,
    next: 'answered',
    turn: 1,
  };
  on('state.set', (_$, e, next) =>
    next(
      e.key === 'calls'
        ? ({
            ...e,
            value: [ghost, ...(e.value as { id: string }[]).filter((c) => c.id !== 'ghost')],
          } as never)
        : e,
    ),
  );
  await $.session.start(SESSION);
  await callBatch($ as never, world, [{ id: 'a', tool: 'mcp__o__s', text: 'ok' }]);
  const tree = await openDetail($ as never, 'ghost');
  expect(linesOf(tree)).toContain('s · o · 5ms · 2 chars · ~1 tok · answered');
  expect(linesOf(tree)).toContain('text not kept after a reload; see the logs');
  await press($ as never, 'copyText');
  expect(world.copied).toEqual([]);
  expect(linesOf(await drawAt($ as never, 80))).toContain(
    'copy failed: text not kept after a reload',
  );
});

test('R35, R48: the detail ends with its key row, cut to the width', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callBatch($ as never, world, [
    { id: 'a', tool: `mcp__github__${'t'.repeat(40)}`, text: 'ok', ms: 812 },
  ]);
  expect(linesOf(await openDetail($ as never, 'a', 80)).at(-1)).toBe(
    'n/p older/newer · c copy args · y copy result · b back',
  );
  const narrow = linesOf(await drawAt($ as never, 40));
  expect(narrow.at(-1)!.startsWith('n/p older/newer')).toBe(true);
  expect(narrow.at(-1)!.endsWith('…')).toBe(true);
  for (const line of narrow) expect(line.length).toBeLessThanOrEqual(40);
});

// v0.3: the Inventory view (R22, R35, R41-R43, R47).

const githubDb = () =>
  usageOf([
    ['github', 'mcp__github__search', 8000, true],
    ['github', 'mcp__github__create_issue', 3000, true],
    ['db', 'mcp__db__query', 4900, false],
  ]);

test('R41: group totals, server bars and shares of the context window', async ($, on) => {
  const world = worldOf(on);
  world.usage = githubDb();
  await $.session.start(SESSION);
  for (const id of ['s1', 's2', 's3']) {
    await callOne($ as never, world, id, 'mcp__github__search', 'x'.repeat(3000), id === 's1');
  }
  await run($ as never, 'inventory');
  const lines = linesOf(await drawAt($ as never, 100));
  expect(lines).toContain('MCP tools  15.9k tok · 8.0% of 200.0k');
  expect(lines).toContain(
    `github  ${'━'.repeat(20)}  11.0k tok · 5.5% · 3 calls · 1✗ · ~2.3k read`,
  );
  expect(lines).toContain(
    `db      ${'━'.repeat(9)}${'─'.repeat(11)}  4.9k tok · 2.5% · never called`,
  );
});

test('R41: a server at zero tokens draws an empty bar', async ($, on) => {
  const world = worldOf(on);
  world.usage = usageOf([['z', 'mcp__z__t', 0, false]]);
  await $.session.start(SESSION);
  await run($ as never, 'inventory');
  const lines = linesOf(await drawAt($ as never, 100));
  expect(lines.some((line) => line.startsWith(`z  ${'─'.repeat(20)}  0 tok`))).toBe(true);
});

test('R42: a tool row with no counted call reads never called', async ($, on) => {
  const world = worldOf(on);
  world.usage = githubDb();
  await $.session.start(SESSION);
  await callOne($ as never, world, 's1', 'mcp__github__search', 'ok');
  await run($ as never, 'inventory');
  const lines = linesOf(await drawAt($ as never, 100));
  expect(lines.find((line) => line.includes('mcp__github__create_issue'))).toContain(
    'never called',
  );
  expect(lines.find((line) => line.includes('mcp__github__search'))).not.toContain('never called');
});

test('R42: a call evicted from the list still counts for its tool and server', async ($, on) => {
  const world = worldOf(on);
  world.usage = githubDb();
  await $.session.start(SESSION);
  await callThrough($ as never, world, 'first', 'mcp__github__search');
  for (let i = 0; i < 200; i++) await callThrough($ as never, world, `r${i}`, 'Read');
  await run($ as never, 'inventory');
  const lines = linesOf(await drawAt($ as never, 100));
  expect(lines.find((line) => line.includes('mcp__github__search'))).not.toContain('never called');
  expect(lines.find((line) => line.startsWith('github'))).toContain('1 call · ~1 read');
});

test('R43: the open Inventory reloads at turn end and shows a new server', async ($, on) => {
  const world = worldOf(on);
  world.usage = githubDb();
  await $.session.start(SESSION);
  await run($ as never, 'inventory');
  await drawAt($ as never, 100);
  world.usage = usageOf([
    ['github', 'mcp__github__search', 8000, true],
    ['c', 'mcp__c__t', 10, true],
  ]);
  await endTurn($ as never, world);
  expect(linesOf(await drawAt($ as never, 100)).some((line) => line.startsWith('c  '))).toBe(true);
});

test('R43, R22: a failed turn-end reload keeps the figures shown', async ($, on) => {
  const world = worldOf(on);
  world.usage = githubDb();
  await $.session.start(SESSION);
  await run($ as never, 'inventory');
  await drawAt($ as never, 100);
  world.usage = new Error('gone');
  await endTurn($ as never, world);
  const lines = linesOf(await drawAt($ as never, 100));
  expect(lines).toContain('MCP tools  15.9k tok · 8.0% of 200.0k');
  expect(lines).not.toContain('Context usage unavailable');
});

test('R47: measured figures are kept in pane state', async ($, on) => {
  const world = worldOf(on);
  const kept = stateOf(on);
  world.usage = githubDb();
  await $.session.start(SESSION);
  await run($ as never, 'inventory');
  await drawAt($ as never, 100);
  await press($ as never, 'measure');
  const measured = (kept.get('inventory') as { measured: Record<string, number> }).measured;
  expect(Object.values(measured).sort((a, b) => a - b)).toEqual([3000, 4900, 8000]);
});

test('R35: the Inventory ends with its key row', async ($, on) => {
  const world = worldOf(on);
  world.usage = githubDb();
  await $.session.start(SESSION);
  await run($ as never, 'inventory');
  expect(linesOf(await drawAt($ as never, 100)).at(-1)).toBe('m measure · esc close');
});

// v0.3: the transcript line, the docked pane and drawing faults (R44, R45, R46).

const ENGINE_ROW = { type: 'Text', children: [''] };
const toolRow = async ($: never, id: string, tool: string, isRunning = false) =>
  ($ as { ui: { render: (e: unknown) => Promise<unknown> } }).ui.render({
    component: 'ToolUse',
    surface: 'terminal',
    requestId: id,
    viewport: { columns: 100, rows: 40, isFullscreen: true },
    props: { tool_use_id: id, tool, input: {}, isRunning, isErrored: false, isInterrupted: false },
  });

test('R44: a completed MCP call gets its cost line beneath the engine row', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callBatch($ as never, world, [
    { id: 'u1', tool: 'mcp__github__search_issues', text: 'x'.repeat(7600), ms: 812 },
  ]);
  const tree = (await toolRow($ as never, 'u1', 'mcp__github__search_issues')) as Element;
  expect(tree.type).toBe('Box');
  expect(tree.props?.flexDirection).toBe('column');
  expect(tree.children?.[0]).toEqual(ENGINE_ROW);
  const line = tree.children?.[1] as Element;
  expect(line.props?.dimColor).toBe(true);
  expect(stringsOf(line).join('').trim()).toBe('812ms · ~1.9k tok');
});

test('R44: an errored call says so on its line', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callOne($ as never, world, 'u1', 'mcp__db__q', 'x'.repeat(40), true);
  const tree = await toolRow($ as never, 'u1', 'mcp__db__q');
  expect(stringsOf(tree).join('')).toContain('0ms · ~10 tok · error');
});

test('R44: running, built-in and unknown calls keep the engine row alone', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callOne($ as never, world, 'r', 'Read', 'ok');
  await callOne($ as never, world, 'm', 'mcp__o__s', 'ok');
  expect(await toolRow($ as never, 'r', 'Read')).toEqual(ENGINE_ROW);
  expect(await toolRow($ as never, 'm', 'mcp__o__s', true)).toEqual(ENGINE_ROW);
  expect(await toolRow($ as never, 'nope', 'mcp__o__s')).toEqual(ENGINE_ROW);
});

test('R45: the fullscreen layout opens the pane without holding toasts', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  const open = (isFullscreen: boolean) =>
    $.command.run({
      command: 'telltale',
      args: '',
      origin: { kind: 'composer' },
      presentation: { isFullscreen, columns: 160 },
    } as never);
  await open(true);
  await open(false);
  expect(world.opened.map((one) => one.holdToasts)).toEqual([false, true]);
});

test('R46: a transcript line that fails to draw leaves the engine row', async ($, on) => {
  const world = worldOf(on);
  on('state.set', (_$, e, next) =>
    next(
      e.key === 'calls'
        ? ({
            ...e,
            value: (e.value as { textChars: unknown }[]).map((one) => ({
              ...one,
              textChars: 10n,
            })),
          } as never)
        : e,
    ),
  );
  await $.session.start(SESSION);
  await callOne($ as never, world, 'u1', 'mcp__o__s', 'ok');
  expect(await toolRow($ as never, 'u1', 'mcp__o__s')).toEqual(ENGINE_ROW);
});

// Fixes from the 2026-10-08 v0.3 review.

test('R34: a call that lands while the turn ends joins the next turn', async ($, on) => {
  const world = worldOf(on);
  const kept = stateOf(on);
  world.running = ['a1'];
  await $.session.start(SESSION);
  await callOne($ as never, world, 'a', 'mcp__o__s', 'ok');
  let release = () => {};
  world.listHold = new Promise<void>((resolve) => (release = resolve));
  await respond($ as never, world, []);
  const ending = complete($ as never);
  await world.clock.settle();
  // The turn end now waits on the agent list; a background subagent's call lands meanwhile.
  await callOne($ as never, world, 'b', 'mcp__o__t', 'ok');
  release();
  await ending;
  await endTurn($ as never, world);
  const turns = Object.fromEntries(
    (kept.get('calls') as { id: string; turn: number }[]).map((call) => [call.id, call.turn]),
  );
  expect(turns).toEqual({ a: 1, b: 2 });
  expect(turnFiles(world)).toEqual([`${DIR}/turn-1.jsonl`, `${DIR}/turn-2.jsonl`]);
  expect(lines(world, `${DIR}/turn-2.jsonl`).map((record) => record.tool)).toEqual(['mcp__o__t']);
});

test('R29: a call that rejects leaves flight, so the band empties', async ($, on) => {
  const world = worldOf(on);
  const kept = stateOf(on);
  world.throws.add('x');
  await $.session.start(SESSION);
  await respond($ as never, world, [{ id: 'x', name: 'mcp__o__s' }]);
  await $.tool.call({ tool: 'mcp__o__s', tool_use_id: 'x' } as never).catch(() => undefined);
  await world.clock.settle();
  expect(kept.get('running')).toEqual({});
  expect(await band($ as never)).toBe('');
});

test('R26: /clear waits for queued work, so no call from before it counts after', async ($, on) => {
  const world = worldOf(on);
  const kept = stateOf(on);
  await $.session.start(SESSION);
  await respond($ as never, world, [{ id: 'z', name: 'mcp__o__s' }], 'a1');
  await $.tool.call({ tool: 'mcp__o__s', tool_use_id: 'z', agentId: 'a1' } as never);
  await $.session.end({ reason: 'clear', sessionId: 's1' } as never);
  await world.clock.settle();
  expect((kept.get('totals') as { calls: number }).calls).toBe(0);
  expect(kept.get('calls')).toEqual([]);
});

test('R26, R27: /clear drops the old context share from the status entry', async ($, on) => {
  const world = worldOf(on);
  world.usage = { context: { window: 200_000, percent: 61 } };
  await $.session.start(SESSION);
  await callOne($ as never, world, 'a', 'mcp__o__s', 'ok');
  await endTurn($ as never, world);
  expect(world.status.at(-1)).toBe('telltale · 1 MCP · ~1 tok · ctx 61%');
  await $.session.end({ reason: 'clear', sessionId: 's1' } as never);
  await callOne($ as never, world, 'b', 'mcp__o__s', 'ok');
  expect(world.status.at(-1)).toBe('telltale · 1 MCP · ~1 tok');
});

const parentOf = (node: unknown, key: string): Element | undefined =>
  elementsOf(node).find((el) =>
    (el.children ?? []).some((child) => (child as Element)?.props?.key === key),
  );

test('R48: the detail buttons stack below the width they need', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callBatch($ as never, world, [{ id: 'a', tool: 'mcp__o__s', text: 'ok' }]);
  const wide = await openDetail($ as never, 'a', 57);
  expect(parentOf(wide, 'back')?.props?.flexDirection).toBe('row');
  expect(parentOf(await drawAt($ as never, 56), 'back')?.props?.flexDirection).toBe('column');
});

test('R48: a long used-in-answer line is cut to the width', async ($, on) => {
  const world = worldOf(on);
  const value = `v1${'x'.repeat(200)}`;
  await $.session.start(SESSION);
  await callBatch($ as never, world, [{ id: 'u', tool: 'mcp__o__s', text: `got ${value}` }]);
  await respond($ as never, world, []);
  await complete($ as never, `It is ${value}.`);
  await world.clock.settle();
  const lines = linesOf(await openDetail($ as never, 'u', 80));
  const used = lines.find((line) => line.startsWith('used in answer'));
  expect(used?.length).toBe(80);
  expect(used?.endsWith('…')).toBe(true);
});

test('R35, R21: an unavailable Inventory still binds m, which changes nothing', async ($, on) => {
  const world = worldOf(on);
  world.usage = new Error('no usage');
  await $.session.start(SESSION);
  await run($ as never, 'inventory');
  const tree = await drawAt($ as never, 80);
  expect(linesOf(tree)).toContain('Context usage unavailable');
  expect(linesOf(tree).at(-1)).toBe('m measure · esc close');
  expect(findKey(tree, 'measure')).toBeDefined();
  await press($ as never, 'measure');
  expect(world.usageCalls).not.toContain('full');
  expect(linesOf(await drawAt($ as never, 80))).toContain('Context usage unavailable');
});

test(
  'R10: a log folder outside the start directory is shown as an absolute path',
  { options: { logDir: '../out' } },
  async ($, on) => {
    worldOf(on);
    await $.session.start(SESSION);
    await run($ as never);
    expect(linesOf(await drawAt($ as never, 80))).toContain('logs: /out/s1');
  },
);

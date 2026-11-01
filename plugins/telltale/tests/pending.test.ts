import { expect, test } from 'claude-code/testing';
import { createPending } from '../hooks/pending';

const row = (id: string, tool = 'x') => ({ id, tool, next: 'pending' }) as const;

const step = (
  pending: ReturnType<typeof createPending>,
  tools: [string, string][],
  opts: {
    agentId?: string;
    complete?: boolean;
    model?: string;
    effort?: string | number;
    usage?: {
      model?: string;
      input_tokens: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
      output_tokens: number;
    } | null;
    serverTools?: number;
  } = {},
) => {
  const s = pending.startStep(opts.agentId, { model: opts.model, effort: opts.effort });
  for (const [id, name] of tools) s.tool(id, name);
  return s.finish({
    stopReason: opts.complete === false ? null : 'end_turn',
    usage: opts.usage
      ? {
          model: opts.usage.model,
          input_tokens: opts.usage.input_tokens,
          cache_read_input_tokens: opts.usage.cache_read_input_tokens ?? 0,
          cache_creation_input_tokens: opts.usage.cache_creation_input_tokens ?? 0,
          output_tokens: opts.usage.output_tokens,
        }
      : null,
    serverToolUses: opts.serverTools ? Array.from({ length: opts.serverTools }, () => ({})) : [],
  });
};

test('R12: retried, other-tool, answered', async () => {
  const pending = createPending();
  step(pending, [['c1', 'x']]);
  step(pending, [['c2', 'x']]);
  step(pending, [['c3', 'y']]);
  step(pending, []);
  const calls = [
    { id: 'c1', tool: 'x', agentId: null },
    { id: 'c2', tool: 'x', agentId: null },
    { id: 'c3', tool: 'y', agentId: null },
  ];
  expect(pending.labelTurn(calls, () => false)).toEqual({
    c1: 'retried',
    c2: 'other-tool',
    c3: 'answered',
  });
});

test('R12: calls from one response share their next response', async () => {
  const pending = createPending();
  step(pending, [
    ['a', 'x'],
    ['b', 'y'],
  ]);
  step(pending, [['q', 'AskUserQuestion']]);
  const calls = [
    { id: 'a', tool: 'x', agentId: null },
    { id: 'b', tool: 'y', agentId: null },
  ];
  expect(pending.labelTurn(calls, () => false)).toEqual({ a: 'asked-user', b: 'asked-user' });
});

test('R12: an interrupted turn labels its last call aborted', async () => {
  const pending = createPending();
  step(pending, [['x1', 'x']]);
  expect(pending.labelTurn([{ id: 'x1', tool: 'x', agentId: null }], () => false)).toEqual({
    x1: 'aborted',
  });
});

test('R12: a cut-off response does not count as the next response', async () => {
  const pending = createPending();
  step(pending, [['x1', 'x']]);
  expect(step(pending, [], { complete: false })).toBe(false);
  expect(pending.labelTurn([{ id: 'x1', tool: 'x', agentId: null }], () => false)).toEqual({
    x1: 'aborted',
  });
});

test('R12: a running subagent with no next response leaves its call pending and held', async () => {
  const pending = createPending();
  step(pending, []);
  step(pending, [['z1', 'z']], { agentId: 'a1' });
  expect(
    pending.labelTurn([{ id: 'z1', tool: 'z', agentId: 'a1' }], (agent) => agent === 'a1'),
  ).toEqual({ z1: 'pending' });
  expect(pending.snapshot()).toEqual({ z1: 'a1' });
});

test('R4, R51: callMeta sums input and cache tokens, prefers the answering model, and computes ctxDelta', async () => {
  const pending = createPending();
  step(pending, [['c1', 'x']], {
    model: 'req-model',
    effort: 'high',
    usage: {
      model: 'ans-model',
      input_tokens: 700,
      cache_read_input_tokens: 200,
      cache_creation_input_tokens: 100,
      output_tokens: 50,
    },
  });
  step(pending, [], {
    usage: { input_tokens: 1400, output_tokens: 20 },
  });
  expect(pending.hasCall('c1')).toBe(true);
  expect(pending.hasCall('unstreamed')).toBe(false);
  expect(pending.callMeta('c1')).toEqual({
    model: 'ans-model',
    effort: 'high',
    ctxDelta: 350,
  });
  expect(pending.callMeta('unstreamed')).toEqual({ model: null, effort: null });
});

test('R51: the next response with usage counts, not a failed one', async () => {
  const pending = createPending();
  step(pending, [['c1', 'x']], { usage: { input_tokens: 1000, output_tokens: 50 } });
  step(pending, [], { complete: false, usage: null });
  step(pending, [], { usage: { input_tokens: 1600, output_tokens: 9 } });
  expect(pending.callMeta('c1').ctxDelta).toBe(550);
});

test('R51: no ctxDelta for parallel calls, server tools, no next usage or negative growth', async () => {
  const parallel = createPending();
  step(
    parallel,
    [
      ['a', 'x'],
      ['b', 'Read'],
    ],
    { usage: { input_tokens: 1000, output_tokens: 50 } },
  );
  step(parallel, [], { usage: { input_tokens: 1400, output_tokens: 20 } });
  expect(parallel.callMeta('a').ctxDelta).toBeUndefined();

  const withServer = createPending();
  step(withServer, [['a', 'x']], {
    usage: { input_tokens: 1000, output_tokens: 50 },
    serverTools: 1,
  });
  step(withServer, [], { usage: { input_tokens: 1400, output_tokens: 20 } });
  expect(withServer.callMeta('a').ctxDelta).toBeUndefined();

  const single = createPending();
  step(single, [['a', 'x']], { usage: { input_tokens: 1000, output_tokens: 50 } });
  expect(single.callMeta('a').ctxDelta).toBeUndefined();

  const compacted = createPending();
  step(compacted, [['a', 'x']], { usage: { input_tokens: 1000, output_tokens: 50 } });
  step(compacted, [], { usage: { input_tokens: 600, output_tokens: 20 } });
  expect(compacted.callMeta('a').ctxDelta).toBeUndefined();
});

test('delta R12: a call held pending is labelled from its agent’s next response', async () => {
  const pending = createPending();
  step(pending, [['c1', 'x']], { agentId: 'a1' });
  pending.labelTurn([{ id: 'c1', tool: 'x', agentId: 'a1' }], () => true);
  expect(pending.waitsOn('a1')).toBe(true);
  step(pending, [], { agentId: 'a1' });
  const labels = pending.labelWaiting([row('c1')], 'a1');
  expect(labels).toEqual({ c1: 'answered' });
  pending.settle(labels);
  expect(pending.snapshot()).toEqual({});
});

test('delta R12: only calls that ended pending are held, under their agent', async () => {
  const pending = createPending();
  step(pending, [['c1', 'x']]);
  step(pending, [['c2', 'x']], { agentId: 'a1' });
  step(pending, [], { agentId: 'a1' });
  pending.labelTurn(
    [
      { id: 'c1', tool: 'x', agentId: null },
      { id: 'c2', tool: 'x', agentId: 'a1' },
    ],
    () => true,
  );
  expect(pending.snapshot()).toEqual({ c1: 'main' });
});

test('delta R12: a row from the completing response or a later one is not labelled', async () => {
  const pending = createPending();
  step(pending, [['c0', 'x']], { agentId: 'a1' });
  step(pending, [['c1', 'x']], { agentId: 'a1' });
  pending.labelTurn([{ id: 'c1', tool: 'x', agentId: 'a1' }], () => true);
  expect(pending.labelWaiting([row('c1')], 'a1')).toEqual({});
  expect(pending.labelWaiting([row('c1')], 'a2')).toEqual({});
});

test('delta R12: an id kept over a reload is stale and labelled from the first response', async () => {
  const pending = createPending();
  pending.restore({ c1: 'a1' });
  step(pending, [['y1', 'y']], { agentId: 'a1' });
  expect(pending.labelWaiting([row('c1')], 'a1')).toEqual({ c1: 'other-tool' });
});

test('delta R12: restore never overwrites an id already held', async () => {
  const pending = createPending();
  step(pending, [['c1', 'x']], { agentId: 'a1' });
  pending.labelTurn([{ id: 'c1', tool: 'x', agentId: 'a1' }], () => true);
  pending.restore({ c1: 'a2' });
  expect(pending.snapshot()).toEqual({ c1: 'a1' });
  // Not stale either: its own response index still counts.
  expect(pending.labelWaiting([row('c1')], 'a1')).toEqual({});
});

test('delta R12: a label still pending is kept by settle', async () => {
  const pending = createPending();
  pending.restore({ c1: 'a1', c2: 'a1' });
  pending.settle({ c1: 'pending', c2: 'retried' });
  expect(pending.snapshot()).toEqual({ c1: 'a1' });
});

test('R12 rule 2: stopped agents are named only on a list that answered', async () => {
  const pending = createPending();
  pending.restore({ c1: 'a1', c2: 'a2' });
  expect(pending.stopped(new Set(['a2']), true)).toEqual(['c1']);
  expect(pending.stopped(new Set(), false)).toEqual([]);
  pending.forget(['c1']);
  expect(pending.agents()).toEqual(new Set(['a2']));
});

test('delta R12: clear drops every held id, stale ones too', async () => {
  const pending = createPending();
  pending.restore({ c1: 'a1' });
  step(pending, [['c2', 'x']], { agentId: 'a1' });
  pending.labelTurn([{ id: 'c2', tool: 'x', agentId: 'a1' }], () => true);
  pending.clear();
  expect(pending.snapshot()).toEqual({});
  expect(pending.waitsOn('a1')).toBe(false);
});

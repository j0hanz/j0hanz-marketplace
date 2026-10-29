import { expect, test } from 'claude-code/testing';
import { createPending } from '../hooks/pending';

const resp = (toolNames: string[], complete = true) => ({ toolNames, complete });
const row = (id: string, response: number | null) =>
  ({ id, tool: 'x', next: 'pending', response }) as const;

test('delta R12: a call held pending is labelled from its agent’s next response', async () => {
  const pending = createPending();
  pending.track([{ id: 'c1', agentId: 'a1' }], new Map([['c1', { next: 'pending' }]]));
  expect(pending.waitsOn('a1')).toBe(true);
  const responses = { a1: [resp(['x']), resp([])] };
  const labels = pending.labelWaiting([row('c1', 0)], 'a1', 1, responses);
  expect(labels).toEqual({ c1: 'answered' });
  pending.settle(labels);
  expect(pending.snapshot()).toEqual({});
});

test('delta R12: only calls that ended pending are held, under their agent', async () => {
  const pending = createPending();
  pending.track(
    [
      { id: 'c1', agentId: null },
      { id: 'c2', agentId: 'a1' },
    ],
    new Map([
      ['c1', { next: 'pending' }],
      ['c2', { next: 'answered' }],
    ]),
  );
  expect(pending.snapshot()).toEqual({ c1: 'main' });
});

test('delta R12: a row from the completing response or a later one is not labelled', async () => {
  const pending = createPending();
  pending.track([{ id: 'c1', agentId: 'a1' }], new Map([['c1', { next: 'pending' }]]));
  const responses = { a1: [resp(['x']), resp([])] };
  expect(pending.labelWaiting([row('c1', 1)], 'a1', 1, responses)).toEqual({});
  expect(pending.labelWaiting([row('c1', 0)], 'a2', 1, responses)).toEqual({});
});

test('delta R12: an id kept over a reload is stale and labelled from the first response', async () => {
  const pending = createPending();
  pending.restore({ c1: 'a1' });
  // The kept response index belongs to the old module; a stale row counts from -1.
  const responses = { a1: [resp(['y'])] };
  expect(pending.labelWaiting([row('c1', 7)], 'a1', 0, responses)).toEqual({ c1: 'other-tool' });
});

test('delta R12: restore never overwrites an id already held', async () => {
  const pending = createPending();
  pending.track([{ id: 'c1', agentId: 'a1' }], new Map([['c1', { next: 'pending' }]]));
  pending.restore({ c1: 'a2' });
  expect(pending.snapshot()).toEqual({ c1: 'a1' });
  // Not stale either: its own response index still counts.
  expect(pending.labelWaiting([row('c1', 3)], 'a1', 1, { a1: [resp(['x'])] })).toEqual({});
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
  pending.track([{ id: 'c2', agentId: 'a1' }], new Map([['c2', { next: 'pending' }]]));
  pending.clear();
  expect(pending.snapshot()).toEqual({});
  expect(pending.waitsOn('a1')).toBe(false);
});

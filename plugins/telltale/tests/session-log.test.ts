import { expect, test } from 'claude-code/testing';
import { createSessionLog } from '../hooks/session-log';
import type { Captured, CallOutcome, KeptLog, LogPort } from '../hooks/session-log';

const FOLDER = '/work/.claude/telltale/s1';
const NOTHING_KEPT: KeptLog = {
  folder: undefined,
  startDir: undefined,
  turnNo: undefined,
  warned: undefined,
};

/** The second adapter at the seam: files in a map, and the notices the module raised. */
const portOf = (files: Record<string, string> = {}) => {
  const disk = new Map(Object.entries(files));
  const notices: string[] = [];
  const state = { failWrites: false, failList: false, failId: false, failVersion: false };
  const port: LogPort = {
    sessionId: async () => {
      if (state.failId) throw new Error('no id');
      return 's1';
    },
    exists: async (path) => disk.has(path),
    write: async (path, text) => {
      if (state.failWrites) throw new Error('EACCES');
      disk.set(path, text);
    },
    list: async (dir) => {
      if (state.failList) throw new Error('no list');
      return [...disk.keys()]
        .filter((path) => path.startsWith(`${dir}/`))
        .map((path) => ({ name: path.slice(dir.length + 1) }));
    },
    version: async () => {
      if (state.failVersion) throw new Error('no version');
      return '2.1.299';
    },
    onWriteFailed: async (notice) => {
      notices.push(notice);
    },
  };
  return { port, disk, notices, state };
};

const started = async (
  port: LogPort,
  options: { logDir?: unknown; fullPayloads?: unknown } = {},
  kept: Partial<KeptLog> = {},
) => {
  const log = createSessionLog(options);
  await log.restore(port, { cwd: '/work', kept: { ...NOTHING_KEPT, ...kept } });
  return log;
};

const call = (over: Partial<Captured> = {}): Captured => ({
  id: 'a',
  tool: 'mcp__db__run',
  server: 'db',
  agentId: null,
  ms: 5,
  args: {},
  text: 'ok',
  isError: false,
  blocks: ['text'],
  turn: 1,
  ...over,
});

const outcomes = (...ids: string[]) =>
  new Map<string, CallOutcome>(
    (ids.length > 0 ? ids : ['a']).map((id) => [
      id,
      { next: 'answered', used: [], model: 'm', effort: null },
    ]),
  );

type Log = ReturnType<typeof createSessionLog>;
const closeTurn = async (log: Log, port: LogPort, ids: string[] = []) => {
  const { turn, n } = log.take();
  await log.write(port, turn, n, outcomes(...ids));
  return n;
};

const record = (disk: Map<string, string>, name: string) =>
  JSON.parse(disk.get(`${FOLDER}/${name}`)!.trim().split('\n')[0]!) as Record<string, unknown>;

test('restore: a first start anchors the folder under the start directory', async () => {
  const { port } = portOf();
  const log = createSessionLog({});
  const out = await log.restore(port, { cwd: '/work/', kept: NOTHING_KEPT });
  expect(out).toEqual({ folder: FOLDER, startDir: '/work' });
  expect(log.location()).toEqual(out);
});

test('restore: an absolute log folder ignores the start directory', async () => {
  const { port } = portOf();
  const log = createSessionLog({ logDir: '/logs' });
  const out = await log.restore(port, { cwd: '/work', kept: NOTHING_KEPT });
  expect(out).toEqual({ folder: '/logs/s1', startDir: '/work' });
});

test('restore: a log folder that is not a usable string falls back to the default', async () => {
  const { port } = portOf();
  const log = createSessionLog({ logDir: '' });
  const { folder } = await log.restore(port, { cwd: '/work', kept: NOTHING_KEPT });
  expect(folder).toBe(FOLDER);
});

test('restore: a session id that cannot be read names the folder session', async () => {
  const { port, state } = portOf();
  state.failId = true;
  const log = createSessionLog({});
  const { folder } = await log.restore(port, { cwd: '/work', kept: NOTHING_KEPT });
  expect(folder).toBe('/work/.claude/telltale/session');
});

test('restore: a kept folder and start directory survive a moved session', async () => {
  const { port } = portOf();
  const log = createSessionLog({});
  const out = await log.restore(port, {
    cwd: '/elsewhere',
    kept: { ...NOTHING_KEPT, folder: FOLDER, startDir: '/work' },
  });
  expect(out).toEqual({ folder: FOLDER, startDir: '/work' });
});

test('restore: a folder kept with no start directory takes this session directory', async () => {
  const { port } = portOf();
  const log = createSessionLog({});
  const out = await log.restore(port, {
    cwd: '/elsewhere/',
    kept: { ...NOTHING_KEPT, folder: FOLDER },
  });
  expect(out).toEqual({ folder: FOLDER, startDir: '/elsewhere' });
});

test('restore: writes after a reload go to the kept folder, and its root gets the ignore file', async () => {
  const { port, disk } = portOf();
  const log = await started(port, {}, { folder: '/kept/root/s9', startDir: '/work' });
  log.addCall(call());
  await closeTurn(log, port, ['a']);
  expect(disk.has('/kept/root/s9/turn-1.jsonl')).toBe(true);
  expect(disk.get('/kept/root/.gitignore')).toBe('*\n');
});

test('restore: numbers continue past the files already there', async () => {
  const { port, disk } = portOf({
    [`${FOLDER}/context-1.json`]: '{}',
    [`${FOLDER}/context-2.json`]: '{}',
    [`${FOLDER}/turn-4.jsonl`]: '{}',
    [`${FOLDER}/turn-6-part2.jsonl`]: '{}',
  });
  const log = await started(port, {}, { folder: FOLDER, startDir: '/work' });
  expect(log.currentTurn()).toBe(7);
  log.noteContext([]);
  log.addCall(call());
  await closeTurn(log, port, ['a']);
  expect(disk.has(`${FOLDER}/turn-7.jsonl`)).toBe(true);
  expect(disk.has(`${FOLDER}/context-3.json`)).toBe(true);
});

test('restore: a kept turn counter beats the files, since a failed write uses up its number', async () => {
  const { port } = portOf({ [`${FOLDER}/turn-2.jsonl`]: '{}' });
  const log = await started(port, {}, { folder: FOLDER, startDir: '/work', turnNo: 5 });
  expect(log.currentTurn()).toBe(6);
});

test('restore: the highest of files and counter wins when the files are ahead', async () => {
  const { port } = portOf({ [`${FOLDER}/turn-9.jsonl`]: '{}' });
  const log = await started(port, {}, { folder: FOLDER, startDir: '/work', turnNo: 5 });
  expect(log.currentTurn()).toBe(10);
});

test('restore: a folder that cannot be listed leaves the kept counter in charge', async () => {
  const { port, state } = portOf({ [`${FOLDER}/turn-9.jsonl`]: '{}' });
  state.failList = true;
  const log = await started(port, {}, { folder: FOLDER, startDir: '/work', turnNo: 3 });
  expect(log.currentTurn()).toBe(4);
});

test('take: only a turn with records uses up a number', async () => {
  const { port } = portOf();
  const log = await started(port);
  expect(log.take()).toMatchObject({ n: 0, hasRecords: false });
  log.addSkill('review', 10);
  expect(log.take()).toMatchObject({ n: 1, hasRecords: true });
  log.addApiTool({ id: 'w', name: 'web_search', agentId: null, input: {}, ms: 1 });
  expect(log.take()).toMatchObject({ n: 2, hasRecords: true });
  expect(log.currentTurn()).toBe(3);
});

test('take: a context alone uses up no number, and rides with the turn it was taken in', async () => {
  const { port } = portOf();
  const log = await started(port);
  log.noteContext([]);
  const { turn, n, hasRecords } = log.take();
  expect(n).toBe(0);
  expect(hasRecords).toBe(false);
  expect(turn.context).toEqual({ reason: 'start', files: [] });
});

test('take: a call that lands after the swap goes to the next turn', async () => {
  const { port } = portOf();
  const log = await started(port);
  log.addCall(call({ id: 'first' }));
  const { turn } = log.take();
  log.addCall(call({ id: 'late' }));
  expect(turn.calls.map((one) => one.id)).toEqual(['first']);
  expect(log.take().turn.calls.map((one) => one.id)).toEqual(['late']);
});

test('addApiTool: a use listed again keeps one record and fills in its missing ms', async () => {
  const { port } = portOf();
  const log = await started(port);
  const use = { id: 'w', name: 'web_search', agentId: null, input: {} };
  log.addApiTool({ ...use, ms: null });
  log.addApiTool({ ...use, ms: 40 });
  log.addApiTool({ ...use, ms: 99 });
  expect(log.take().turn.apiTools).toEqual([{ ...use, ms: 40 }]);
});

test('write: a call record carries its outcome, redacted, with a head and tail', async () => {
  const { port, disk } = portOf();
  const log = await started(port);
  const text = `${'h'.repeat(300)}${'m'.repeat(100)}${'t'.repeat(300)}`;
  log.addCall(
    call({ text, args: { token: 'abc123', q: 'x' }, permission: 'ask', rule: 'Bash(*)' }),
  );
  const { turn, n } = log.take();
  await log.write(
    port,
    turn,
    n,
    new Map([
      [
        'a',
        {
          next: 'retried',
          used: ['Bearer abcdefghijklmnopqrstuvwx'],
          model: 'm',
          effort: 'high',
          ctxDelta: 7,
        },
      ],
    ]),
  );
  const got = record(disk, 'turn-1.jsonl');
  expect(got).toMatchObject({
    type: 'call',
    tool: 'mcp__db__run',
    server: 'db',
    model: 'm',
    effort: 'high',
    ms: 5,
    permission: 'ask',
    permissionRule: 'Bash(*)',
    args: { token: '[redacted]', q: 'x' },
    chars: 700,
    estTokens: 175,
    ctxDelta: 7,
    next: 'retried',
    head: 'h'.repeat(300),
    tail: 't'.repeat(300),
  });
  expect(JSON.stringify(got)).not.toContain('abcdefghijklmnopqrstuvwx');
  expect(got).not.toHaveProperty('text');
});

test('write: no verdict logs a null permission, no rule, and no ctxDelta', async () => {
  const { port, disk } = portOf();
  const log = await started(port);
  log.addCall(call());
  await closeTurn(log, port, ['a']);
  const got = record(disk, 'turn-1.jsonl');
  expect(got.permission).toBeNull();
  expect(got).not.toHaveProperty('permissionRule');
  expect(got).not.toHaveProperty('ctxDelta');
});

test('write: full payloads add the redacted text', async () => {
  const { port, disk } = portOf();
  const log = await started(port, { fullPayloads: true });
  log.addCall(call({ text: 'plain words' }));
  await closeTurn(log, port, ['a']);
  expect(record(disk, 'turn-1.jsonl').text).toBe('plain words');
});

test('write: skill and server tool records follow the call records', async () => {
  const { port, disk } = portOf();
  const log = await started(port);
  log.addCall(call());
  log.addSkill('review', 400);
  log.addApiTool({ id: 'w', name: 'web_search', agentId: 'a1', input: { token: 'abc' }, ms: 9 });
  await closeTurn(log, port, ['a']);
  const rows = disk
    .get(`${FOLDER}/turn-1.jsonl`)!
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  expect(rows.map((row) => row.type)).toEqual(['call', 'skill', 'apiTool']);
  expect(rows[1]).toEqual({ type: 'skill', skill: 'review', chars: 400, estTokens: 100 });
  expect(rows[2]).toEqual({
    type: 'apiTool',
    id: 'w',
    name: 'web_search',
    agentId: 'a1',
    args: { token: '[redacted]' },
    ms: 9,
  });
});

test('write: a large turn splits into numbered parts, each under the limit', async () => {
  const { port, disk } = portOf();
  const log = await started(port, { fullPayloads: true });
  const ids = Array.from({ length: 600 }, (_, i) => `c${i}`);
  for (const id of ids) log.addCall(call({ id, text: 't'.repeat(4000) }));
  await closeTurn(log, port, ids);
  const parts = [...disk.keys()].filter((path) => path.includes('/turn-1-part'));
  expect(parts).toHaveLength(3);
  expect(disk.has(`${FOLDER}/turn-1.jsonl`)).toBe(false);
  const rows = parts.flatMap((path) => disk.get(path)!.trim().split('\n'));
  expect(rows).toHaveLength(600);
});

test('write: an empty turn writes no turn file and leaves the root untouched', async () => {
  const { port, disk } = portOf();
  const log = await started(port);
  await closeTurn(log, port);
  expect([...disk.keys()]).toEqual([]);
});

test('write: the root gets one ignore file, and an existing one is kept', async () => {
  const fresh = portOf();
  const log = await started(fresh.port);
  log.addCall(call());
  await closeTurn(log, fresh.port, ['a']);
  fresh.disk.delete('/work/.claude/telltale/.gitignore');
  log.addCall(call());
  await closeTurn(log, fresh.port, ['a']);
  expect(fresh.disk.has('/work/.claude/telltale/.gitignore')).toBe(false);

  const owned = portOf({ '/work/.claude/telltale/.gitignore': 'mine\n' });
  const other = await started(owned.port);
  other.addCall(call());
  await closeTurn(other, owned.port, ['a']);
  expect(owned.disk.get('/work/.claude/telltale/.gitignore')).toBe('mine\n');
});

test('write: a context record names its reason, the version and the described tools', async () => {
  const { port, disk } = portOf();
  const log = await started(port);
  log.describeTool('mcp__db__run', { server: 'db', chars: 12, deferred: true });
  log.noteContext([{ path: 'CLAUDE.md', kind: 'project', chars: 3 }]);
  await closeTurn(log, port);
  expect(JSON.parse(disk.get(`${FOLDER}/context-1.json`)!)).toEqual({
    reason: 'start',
    files: [{ path: 'CLAUDE.md', kind: 'project', chars: 3 }],
    version: '2.1.299',
    tools: [{ tool: 'mcp__db__run', server: 'db', chars: 12, deferred: true }],
  });
});

test('write: a version that cannot be read leaves the context record without one', async () => {
  const { port, disk, state } = portOf();
  state.failVersion = true;
  const log = await started(port);
  log.noteContext([]);
  await closeTurn(log, port);
  expect(JSON.parse(disk.get(`${FOLDER}/context-1.json`)!)).not.toHaveProperty('version');
});

test('markReason: the next context carries the reason once, then start again', async () => {
  const { port, disk } = portOf();
  const log = await started(port);
  log.markReason('clear');
  log.noteContext([]);
  await closeTurn(log, port);
  log.markReason('compact');
  log.noteContext([]);
  await closeTurn(log, port);
  log.noteContext([]);
  await closeTurn(log, port);
  const reason = (name: string) => JSON.parse(disk.get(`${FOLDER}/${name}`)!).reason;
  expect(reason('context-1.json')).toBe('clear');
  expect(reason('context-2.json')).toBe('compact');
  expect(reason('context-3.json')).toBe('start');
});

test('R16: repeated write failures give one notice, naming the folder', async () => {
  const { port, notices, state } = portOf();
  state.failWrites = true;
  const log = await started(port);
  for (let i = 0; i < 3; i++) {
    log.addCall(call());
    await closeTurn(log, port, ['a']);
  }
  expect(notices).toEqual([`telltale: cannot write logs to ${FOLDER}`]);
});

test('R16: a notice already kept across a reload is not given again', async () => {
  const { port, notices, state } = portOf();
  state.failWrites = true;
  const log = await started(port, {}, { warned: true });
  log.addCall(call());
  await closeTurn(log, port, ['a']);
  expect(notices).toEqual([]);
});

test('R16: a failed write still uses up its turn number', async () => {
  const { port, state, disk } = portOf();
  state.failWrites = true;
  const log = await started(port);
  log.addCall(call());
  expect(await closeTurn(log, port, ['a'])).toBe(1);
  state.failWrites = false;
  log.addCall(call());
  expect(await closeTurn(log, port, ['a'])).toBe(2);
  expect(disk.has(`${FOLDER}/turn-2.jsonl`)).toBe(true);
});

test('R16: a port whose failure callback throws does not fail the write', async () => {
  const { port, state } = portOf();
  state.failWrites = true;
  const refusing: LogPort = {
    ...port,
    onWriteFailed: async () => {
      throw new Error('toast refused');
    },
  };
  const log = await started(refusing);
  log.addCall(call());
  const { turn, n } = log.take();
  await expect(log.write(refusing, turn, n, outcomes('a'))).resolves.toBeUndefined();
});

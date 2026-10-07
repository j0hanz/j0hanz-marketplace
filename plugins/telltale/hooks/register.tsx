// telltale: an observe-only mod. Every hook hands back exactly what `next(e)` returned (R3);
// its own work runs inside `safe`, so a fault here never changes or blocks a call.

import { atom, read, update } from 'claude-code';
import type { EngineInterface, Register, SessionUsage } from 'claude-code';

import type { Call, CallDetail, Inventory, InventoryRow, NextAction, View } from '../types';
import {
  chunks,
  cutArgs,
  estTokens,
  formatTokens,
  labelCalls,
  mcpServer,
  pretty,
  receipt,
  redact,
  show,
  toParts,
  usedInAnswer,
  type Response,
} from './lib';

const PANE = 'telltale';
const KEEP = 200; // R25
const SHOWN = 20_000; // R20

const calls = atom({ plugin: 'telltale', key: 'calls' } as const, []);
const dropped = atom({ plugin: 'telltale', key: 'dropped' } as const, 0);
const view = atom({ plugin: 'telltale', key: 'view' } as const, 'calls');
const selected = atom({ plugin: 'telltale', key: 'selected' } as const, null);
const inventory = atom({ plugin: 'telltale', key: 'inventory' } as const, {
  rows: [],
  status: 'idle',
});
const logFolder = atom({ plugin: 'telltale', key: 'folder' } as const, '');
// Kept in state so a reload (a code edit, or a settings change) neither repeats the notice (R16)
// nor strands a `pending` row (delta R12).
const warnedOnce = atom({ plugin: 'telltale', key: 'warned' } as const, false);
const pendingIds = atom({ plugin: 'telltale', key: 'pending' } as const, {});

type Captured = {
  id: string;
  tool: string;
  server: string | null;
  agentId: string | null;
  response: number | null;
  ms: number;
  args: Record<string, unknown>;
  text: string;
  isError: boolean;
  blocks: string[];
};
type Done = { next: NextAction; used: string[] };
type Turn = {
  calls: Captured[];
  skills: { skill: string; chars: number }[];
  context: { reason: string; files: { path: string; kind: string; chars: number }[] } | null;
};

const safe = async <T,>(work: () => Promise<T> | T): Promise<T | undefined> => {
  try {
    return await work();
  } catch {
    return undefined;
  }
};

const blockKinds = (result: unknown): string[] => {
  const content = (result as { content?: unknown } | null)?.content;
  return Array.isArray(content)
    ? content.map((block) => String((block as { type?: unknown }).type))
    : [];
};

// Session state. A reload runs the module afresh, so these start over with it.
let logDir = '.claude/telltale';
let root = '';
let fullPayloads = false;
let interactive = true;
let folder = '';
let turnNo = 0;
let contextNo = 0;
let rootReady = false;
let warned = false;
let pendingReason: 'clear' | 'compact' | null = null;
let buffer: Turn = { calls: [], skills: [], context: null };
// ponytail: responses and callResponse grow ~100 B per model request for the process life;
// prune per agent if sessions ever run 100k+ requests.
const responses: Record<string, Response[]> = {};
const callResponse = new Map<string, { agent: string; index: number }>();
// Calls labelled `pending` at their turn end, by id, with their agent (delta R12).
const pending = new Map<string, string>();
// Pending ids carried over a reload: their response index belongs to the old module.
const stale = new Set<string>();
const forget = (id: string) => {
  pending.delete(id);
  stale.delete(id);
};
const savePending = ($: EngineInterface) =>
  safe(() => update($, pendingIds, () => Object.fromEntries(pending)));
const described = new Map<string, { server: string | null; chars: number; deferred: boolean }>();
// R25: args, result text and used values of the calls the pane lists, by id. Kept here, not in
// `$.state`, which every plugin can read and which refuses a value over 4 MiB.
const details = new Map<string, CallDetail>();
// R3: pane bookkeeping runs after the result is handed back, one step at a time, in call order.
// The pane and turn end wait for it, so they never see a row missing.
let settled: Promise<unknown> = Promise.resolve();
const later = (work: () => Promise<unknown>) => {
  settled = settled.then(() => safe(work));
  return settled;
};

const isAbsolute = (path: string) => /^(?:[A-Za-z]:)?[\\/]/.test(path);

async function write($: EngineInterface, name: string, text: string) {
  try {
    if (!rootReady) {
      if (!(await $.fs.exists(`${root}/.gitignore`))) await $.fs.write(`${root}/.gitignore`, '*\n'); // R19
      rootReady = true;
    }
    await $.fs.write(`${folder}/${name}`, text);
  } catch {
    // R16: one notice per session, also across a reload.
    if (warned || (await safe(() => read($, warnedOnce)))) return;
    warned = true;
    await safe(() => update($, warnedOnce, () => true));
    const notice = `telltale: cannot write logs to ${folder}`;
    if (interactive) await safe(() => $.ui.toast(notice));
    else await safe(() => $.ui.log(notice, { to: 'debug' })); // delta R6
  }
}

/** R4, R5, R7, R8, R15: one turn's records, and its context record when it has one. */
async function writeLogs($: EngineInterface, turn: Turn, done: Map<string, Done>) {
  const records = [
    ...turn.calls.map((call) => {
      const text = redact(call.text) as string;
      return JSON.stringify({
        type: 'call',
        tool: call.tool,
        server: call.server,
        agentId: call.agentId,
        ms: call.ms,
        args: cutArgs(redact(call.args)),
        chars: call.text.length,
        estTokens: estTokens(call.text.length),
        isError: call.isError,
        blocks: call.blocks,
        head: text.slice(0, 300),
        tail: text.slice(-300),
        next: done.get(call.id)!.next,
        usedInAnswer: redact(done.get(call.id)!.used), // R14: the pane keeps the raw values (R25)
        ...(fullPayloads ? { text } : {}),
      });
    }),
    ...turn.skills.map((skill) =>
      JSON.stringify({ type: 'skill', ...skill, estTokens: estTokens(skill.chars) }),
    ),
  ];
  if (records.length > 0) {
    const n = ++turnNo;
    const parts = toParts(records);
    for (const [k, part] of parts.entries()) {
      const name = parts.length === 1 ? `turn-${n}.jsonl` : `turn-${n}-part${k + 1}.jsonl`;
      await write($, name, `${part.join('\n')}\n`);
    }
  }
  if (turn.context) {
    contextNo += 1;
    const tools = [...described].map(([tool, info]) => ({ tool, ...info }));
    await write($, `context-${contextNo}.json`, JSON.stringify({ ...turn.context, tools }));
  }
}

/** R10, R11, R25: a call's pane row and detail, keeping the newest 200. */
async function listCall($: EngineInterface, call: Captured) {
  const json = JSON.stringify(call.args);
  const { args: _args, text: _text, blocks: _blocks, ...meta } = call;
  const shown: Call = { ...meta, argsChars: json.length, textChars: call.text.length, next: null };
  details.set(call.id, { args: json.slice(0, SHOWN), text: call.text.slice(0, SHOWN), used: [] });
  let gone: Call[] = [];
  const kept = await update($, calls, (list) => {
    const all = [...list, shown];
    gone = all.slice(0, Math.max(0, all.length - KEEP));
    return all.slice(gone.length);
  });
  // Only the ids this update evicted: a parallel call may have set its detail meanwhile.
  for (const one of gone) details.delete(one.id);
  const evicted = gone.length;
  if (evicted > 0) await update($, dropped, (n) => n + evicted);
  // delta R11: with nothing selected, or the selection evicted, the newest kept call takes it.
  const newest = kept.at(-1)?.id ?? null;
  let moved = false;
  await update($, selected, (current) => {
    moved = current === null || !kept.some((one) => one.id === current);
    return moved ? newest : current;
  });
  if (moved) void focusRow($, newest);
}

/** Puts the focus ring on a row; a pane without the keys answers `{ deny }`, which is fine. */
async function focusRow($: EngineInterface, id: string | null) {
  if (id !== null) await $.ui.focus({ requestId: PANE, key: `row:${id}` }).catch(() => {});
}

/** delta R12: a `pending` call's label, once its agent's next complete response arrives. */
async function relabel($: EngineInterface, agent: string, index: number) {
  if (![...pending.values()].includes(agent)) return;
  let labels: Record<string, NextAction> = {};
  // Decided inside the updater: a `$.state.get` in this dispatch may read an older moment.
  await update($, calls, (all) => {
    const waiting = all.filter(
      (call) =>
        pending.get(call.id) === agent &&
        call.next === 'pending' &&
        (stale.has(call.id) || (call.response !== null && call.response < index)),
    );
    labels = labelCalls(
      responses,
      // A stale call is labelled from the first complete response since the reload.
      waiting.map((call) => ({
        id: call.id,
        tool: call.tool,
        agent,
        response: stale.has(call.id) ? -1 : call.response,
      })),
      () => true,
    );
    return all.map((call) => (labels[call.id] ? { ...call, next: labels[call.id]! } : call));
  });
  for (const [id, label] of Object.entries(labels)) {
    if (label !== 'pending') forget(id);
  }
  await savePending($);
}

/** Opens a view; the Inventory loads Claude Code's own estimate, which sends no request. */
async function openView($: EngineInterface, next: View) {
  await update($, view, () => next);
  if (next === 'inventory') await loadInventory($, 'summary');
}

// R21: the figures the last `m` press measured, by row, until the next press.
const measured = new Map<string, number>();
// Set and cleared without an await in between, so two presses cannot both start a count.
let measuring = false;
const rowId = (row: InventoryRow) => `${row.group}\u0000${row.name}`;

const rowsOf = (usage: SessionUsage | undefined): InventoryRow[] | null => {
  const breakdown = usage?.context?.breakdown;
  if (!breakdown) return null;
  return [
    ...(breakdown.mcpTools ?? []).map((tool) => ({
      group: `mcp:${tool.serverName}`,
      name: tool.name,
      tokens: tool.tokens,
      measured: false,
      state: tool.isLoaded ? ('loaded' as const) : ('deferred' as const),
    })),
    ...(breakdown.skills?.skillFrontmatter ?? []).map((skill) => ({
      // delta R18: the engine's source word, `userSettings` read as `user`.
      group: `skill:${skill.source === 'plugin' ? (skill.pluginName ?? 'other') : skill.source ? skill.source.replace(/Settings$/, '') : 'other'}`,
      name: skill.name,
      tokens: skill.tokens,
      measured: false,
    })),
    ...(breakdown.memoryFiles ?? []).map((file) => ({
      group: 'memory',
      name: file.path,
      tokens: file.tokens,
      measured: false,
    })),
  ];
};

/** R18, R21, R22: the Inventory rows, from Claude Code's estimate or its exact count. */
async function loadInventory($: EngineInterface, breakdown: 'summary' | 'full') {
  if (breakdown === 'full') {
    if (measuring) return;
    measuring = true;
  }
  try {
    const current = (await $.state.get({ plugin: 'telltale', key: 'inventory' })).value ?? {
      rows: [],
      status: 'idle',
    };
    if (breakdown === 'full') {
      if (current.status === 'unavailable') return;
      await update($, inventory, (inv): Inventory => ({ ...inv, status: 'measuring' }));
    }
    let rows: InventoryRow[] | null = null;
    let failure = 'unknown';
    try {
      rows = rowsOf(await $.session.usage({ breakdown }));
    } catch (error) {
      failure = error instanceof Error && error.message ? error.message : 'unknown';
    }
    if (rows === null) {
      await update($, inventory, (inv): Inventory =>
        breakdown === 'full'
          ? { ...inv, status: `measure failed: ${failure}` }
          : { rows: [], status: 'unavailable' },
      );
      return;
    }
    if (breakdown === 'full') {
      const present = new Set(current.rows.map(rowId));
      measured.clear();
      // A full count covers tools and memory files; skill listings stay Claude Code's estimate.
      for (const row of rows) {
        if (present.has(rowId(row)) && !row.group.startsWith('skill:')) {
          measured.set(rowId(row), row.tokens);
        }
      }
    }
    const labelled = rows.map((row) => {
      const exact = measured.get(rowId(row));
      return exact === undefined ? row : { ...row, tokens: exact, measured: true };
    });
    // A summary load landing mid-count keeps the count's `measuring` status.
    await update($, inventory, () => ({
      rows: labelled,
      status: breakdown === 'summary' && measuring ? 'measuring' : 'idle',
    }));
  } finally {
    if (breakdown === 'full') measuring = false;
  }
}

export const register: Register = (on, options) => {
  logDir =
    typeof options.logDir === 'string' && options.logDir ? options.logDir : '.claude/telltale';
  fullPayloads = options.fullPayloads === true;

  on('session.start', async ($, e, next) => {
    interactive = e.isInteractive;
    await safe(() =>
      $.command.register({
        name: 'telltale',
        description: 'Open the telltale pane: calls or inventory',
        argumentHint: '[calls|inventory]',
      }),
    );
    // R19: anchored to where the session started, and kept in state so a reload or a later
    // `cd` never moves it. One folder per session id, kept across /clear and resume.
    folder = (await safe(() => read($, logFolder))) || '';
    if (!folder) {
      root = isAbsolute(logDir) ? logDir : `${e.cwd.replace(/[\\/]+$/, '')}/${logDir}`;
      folder = `${root}/${(await safe(() => $.session.id())) ?? 'session'}`;
      await safe(() => update($, logFolder, () => folder));
    } else {
      root = folder.slice(0, folder.lastIndexOf('/'));
    }
    const kept = (await safe(() => read($, pendingIds))) ?? {};
    for (const [id, agent] of Object.entries(kept)) {
      if (!pending.has(id)) {
        pending.set(id, agent);
        stale.add(id);
      }
    }
    for (const entry of (await safe(() => $.fs.list(folder))) ?? []) {
      const turn = /^turn-(\d+)/.exec(entry.name);
      const context = /^context-(\d+)\.json$/.exec(entry.name);
      if (turn) turnNo = Math.max(turnNo, Number(turn[1]));
      if (context) contextNo = Math.max(contextNo, Number(context[1]));
    }
    return next(e);
  });

  on('turn.step', async function* ($, e, next) {
    const agent = e.agentId ?? 'main';
    const list = (responses[agent] ??= []);
    const index = list.push({ toolNames: [], complete: false }) - 1;
    const stream = next(e);
    let step = await stream.next();
    try {
      while (!step.done) {
        const chunk = step.value;
        if (chunk.kind === 'tool') {
          list[index]!.toolNames.push(chunk.name);
          callResponse.set(chunk.id, { agent, index });
        }
        yield chunk;
        step = await stream.next();
      }
    } finally {
      // A consumer that stops early ends the stream beneath too.
      if (!step.done) await stream.return?.(undefined as never);
    }
    const r = step.value;
    // A null stopReason is a request that failed or was cut off: not a response (delta R12).
    list[index]!.complete = r?.stopReason != null;
    if (list[index]!.complete) await safe(() => relabel($, agent, index));
    return r;
  });

  on('tool.call', async ($, e, next) => {
    const started = (await safe(() => $.clock.now())) ?? 0;
    const r = await next(e);
    // R1: only calls Claude made. Another plugin's `$.tool.call` is not Claude's: it gets its
    // own id, which no `turn.step` streamed. A subagent a plugin spawned carries that plugin's
    // origin too, but its model streams each call first, so those stay counted (R2).
    if (next.origin.plugin !== 'engine' && !callResponse.has(e.tool_use_id)) return r;
    try {
      const ms = ((await safe(() => $.clock.now())) ?? started) - started;
      const { tool, tool_use_id: id, agentId, ...args } = e;
      const text = typeof r.text === 'string' ? r.text : (r.deny ?? '');
      const call: Captured = {
        id,
        tool,
        server: mcpServer(tool),
        agentId: agentId ?? null,
        response: callResponse.get(id)?.index ?? null,
        ms,
        args,
        text,
        isError: r.isError === true || r.deny !== undefined,
        blocks: blockKinds(r.result),
      };
      // Before the return: the turn end reads `buffer` for its log.
      buffer.calls.push(call);
      void later(() => listCall($, call));
    } catch {
      // R3: a fault here never blocks the result.
    }
    return r;
  });

  on('skill.prompt', async ($, e, next) => {
    const r = await next(e);
    await safe(() => buffer.skills.push({ skill: e.skill, chars: r.text.length }));
    return r;
  });

  on('tool.describe', async ($, e, next) => {
    const r = await next(e);
    await safe(() => {
      const plugin = e.provider.plugin;
      described.set(e.tool, {
        server: plugin.startsWith('mcp:') ? plugin.slice(4) : null,
        chars: r.description.length,
        deferred: (r.isDeferred ?? e.isDeferred) === true,
      });
    });
    return r;
  });

  on('prompt.context', async ($, e, next) => {
    const r = await next(e);
    await safe(() => {
      buffer.context = {
        reason: pendingReason ?? 'start',
        files: (r.instructionFiles ?? []).map((file) => ({
          path: file.path,
          kind: file.kind,
          chars: file.content.length,
        })),
      };
      pendingReason = null;
    });
    return r;
  });

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      pendingReason = 'clear';
      pending.clear(); // the cleared rows can never be relabelled
      stale.clear();
      details.clear();
      await savePending($);
      await safe(async () => {
        await update($, calls, () => []);
        await update($, dropped, () => 0);
        await update($, view, () => 'calls');
        await update($, selected, () => null);
      });
    }
    return next(e);
  });

  on('session.compact', async ($, e, next) => {
    const r = await next(e);
    // Only a main-conversation compaction that went ahead rebuilds the main context (R8).
    if (e.agentId === undefined && e.trigger !== 'precompute' && !('skip' in r && r.skip)) {
      pendingReason = 'compact';
    }
    return r;
  });

  on('turn.complete', async ($, e, next) => {
    const r = await next(e);
    if (e.agentId !== undefined) return r;
    const turn = buffer;
    buffer = { calls: [], skills: [], context: null };
    // R1: MCP calls only, subagent calls included (R2); skills once each.
    const mcp = turn.calls.filter((call) => call.server !== null);
    const line = receipt({
      mcpCalls: mcp.length,
      errors: mcp.filter((call) => call.isError).length,
      tokens: mcp.reduce((sum, call) => sum + estTokens(call.text.length), 0),
      skills: turn.skills.map((entry) => entry.skill),
    });
    const ready = await safe(async () => {
      const listed = await safe(() => $.agent.list());
      const running = new Set(
        (listed ?? []).filter((agent) => agent.status === 'running').map((agent) => agent.id),
      );
      const labels = labelCalls(
        responses,
        turn.calls.map((call) => ({
          id: call.id,
          tool: call.tool,
          agent: call.agentId ?? 'main',
          response: call.response,
        })),
        // A list that failed says nothing about who stopped: every subagent then counts as
        // running, so its calls go `pending` and a later turn end settles them (R12 rule 2).
        (agent) => agent !== 'main' && (listed === undefined || running.has(agent)),
      );
      const answer = e.reason === 'answer' ? e.answer : null;
      const done = new Map(
        turn.calls.map((call) => [
          call.id,
          { next: labels[call.id] ?? 'aborted', used: usedInAnswer(call.text, answer) },
        ]),
      );
      return { listed, running, done };
    });
    if (ready) {
      const { listed, running, done } = ready;
      // R5, R6: the logs are the durable output. They are written first, in their own `safe`,
      // so a refused pane-state write (below) can never cost a turn its file.
      await safe(() => writeLogs($, turn, done));
      await settled;
      await safe(async () => {
        for (const [id, found] of done) {
          if (details.has(id)) details.get(id)!.used = found.used;
        }
        await update($, calls, (list) =>
          list.map((call) => {
            const found = done.get(call.id);
            return found ? { ...call, next: found.next } : call;
          }),
        );
        for (const call of turn.calls) {
          if (done.get(call.id)!.next === 'pending') pending.set(call.id, call.agentId ?? 'main');
        }
        await savePending($);
        // A subagent response that completed while the labels were written still relabels.
        for (const agent of new Set(pending.values())) {
          await relabel($, agent, responses[agent]?.length ?? 0);
        }
        // R12 rule 2: a pending call whose agent has stopped with no next response is aborted.
        // Only on a list that answered: a failed call says nothing about who stopped.
        const stopped = listed ? [...pending].filter(([, agent]) => !running.has(agent)) : [];
        if (stopped.length > 0) {
          const ids = new Set(stopped.map(([id]) => id));
          await update($, calls, (list) =>
            list.map((call) =>
              ids.has(call.id) && call.next === 'pending' ? { ...call, next: 'aborted' } : call,
            ),
          );
          for (const id of ids) forget(id);
          await savePending($);
        }
      });
    }
    // delta R6: a headless run shows nothing of its own. A line another hook set stays first.
    if (!interactive || line === null) return r;
    return { ...r, text: r.text === e.answer ? line : `${r.text}\n${line}` };
  });

  // R9, R23, delta R6: `/telltale [calls|inventory]`.
  on('command.run', { command: 'telltale' }, async ($, e) => {
    await settled;
    if (!interactive) return { text: 'the pane needs an interactive session' };
    const raw = (e.args ?? '').trim();
    const wanted = raw.toLowerCase();
    const known = wanted === '' || wanted === 'calls' || wanted === 'inventory';
    const next: View = wanted === 'inventory' ? 'inventory' : 'calls';
    const list = (await $.state.get({ plugin: 'telltale', key: 'calls' })).value ?? [];
    const newest = list.at(-1)?.id ?? null;
    await update($, selected, () => newest);
    await openView($, next);
    await $.ui.open({
      id: PANE,
      title: 'telltale',
      focus: true,
      closeOnEscape: true,
      holdToasts: true,
    });
    if (next === 'calls') await focusRow($, newest);
    return { text: known ? 'opened' : `unknown view "${raw}"; views: calls, inventory` };
  });

  // delta R11: the selection follows the focus ring across the rows.
  on('ui.focus', async ($, e, next) => {
    const element = e.element;
    if (e.plugin === 'telltale' && e.requestId === PANE && element?.startsWith('row:')) {
      await safe(() => update($, selected, () => element.slice(4)));
    }
    return next(e);
  });

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    await settled;
    const { Box, Text, Button } = $.ui.resolve(e);
    const list = await read($, calls);
    const gone = await read($, dropped);
    const current = await read($, view);
    const chosen = await read($, selected);
    const inv = await read($, inventory);
    const call = list.find((one) => one.id === chosen);

    const tabs = (
      <Box flexDirection="row" columnGap={2}>
        <Button key="view:calls" hotkey="1" plain onPress={() => openView($, 'calls')}>
          Calls
        </Button>
        <Button key="view:inventory" hotkey="2" plain onPress={() => openView($, 'inventory')}>
          Inventory
        </Button>
      </Box>
    );

    if (current === 'detail' && call) {
      const tokens = formatTokens(estTokens(call.textChars));
      const detail = details.get(call.id);
      const field = (key: string, label: string, raw: string, full: number) => [
        <Text key={key} dimColor>
          {label}
        </Text>,
        ...chunks(show(pretty(raw), raw, full)).map((part, i) => (
          <Text key={`${key}:${i}`}>{part}</Text>
        )),
      ];
      return (
        <Box flexDirection="column">
          {tabs}
          <Button
            key="back"
            hotkey="b"
            plain
            onPress={async () => {
              await openView($, 'calls');
              await focusRow($, call.id);
            }}
          >
            Back
          </Button>
          <Text bold>{`${call.tool}${call.server ? `  (${call.server})` : ''}`}</Text>
          {detail ? (
            [
              ...field('args', 'arguments', detail.args, call.argsChars),
              ...field('text', 'what Claude read', detail.text, call.textChars),
            ]
          ) : (
            <Text dimColor>text not kept after a reload; see the logs</Text>
          )}
          <Text>{`size: ${call.textChars} chars · ~${tokens} tok${call.isError ? ' · error' : ''}`}</Text>
          <Text>{`next: ${call.next ?? 'pending'} · ${call.ms}ms (duration includes any permission prompt)`}</Text>
          {chunks(
            `used in answer: ${detail && detail.used.length > 0 ? detail.used.join(', ') : 'none'}`,
          ).map((part, i) => (
            <Text key={`used:${i}`}>{part}</Text>
          ))}
        </Box>
      );
    }

    if (current === 'inventory') {
      if (inv.status === 'unavailable') {
        return (
          <Box flexDirection="column">
            {tabs}
            <Text>Context usage unavailable</Text>
          </Box>
        );
      }
      const group = (prefix: string, title: string, empty: string) => {
        const rows = inv.rows.filter((row) => row.group.startsWith(prefix));
        const names = [...new Set(rows.map((row) => row.group))];
        return (
          <Box flexDirection="column">
            <Text bold>{title}</Text>
            {rows.length === 0 ? (
              <Text dimColor>{empty}</Text>
            ) : (
              names.map((name) => (
                <Box key={name} flexDirection="column">
                  {prefix !== 'memory' && <Text>{name.slice(prefix.length)}</Text>}
                  {rows
                    .filter((row) => row.group === name)
                    .sort((a, b) => b.tokens - a.tokens)
                    .map((row) => (
                      <Text key={row.name}>
                        {`  ${row.name}  ${row.tokens} tok  ${row.measured ? 'measured' : 'est'}${row.state ? `  ${row.state}` : ''}`}
                      </Text>
                    ))}
                </Box>
              ))
            )}
          </Box>
        );
      };
      return (
        <Box flexDirection="column">
          {tabs}
          {group('mcp:', 'MCP tools', 'No MCP servers connected')}
          {group('skill:', 'Skills', 'No skills listed')}
          {group('memory', 'Memory files', 'No memory files loaded')}
          <Button key="measure" hotkey="m" plain onPress={() => loadInventory($, 'full')}>
            Measure
          </Button>
          {inv.status === 'measuring' && <Text dimColor>measuring…</Text>}
          {inv.status.startsWith('measure failed') && <Text>{inv.status}</Text>}
        </Box>
      );
    }

    return (
      <Box flexDirection="column">
        {tabs}
        {list.length === 0 ? (
          <Text dimColor>No tool calls yet</Text>
        ) : (
          [...list].reverse().map((one) => (
            <Button
              key={`row:${one.id}`}
              plain
              {...(one.id === chosen ? { autoFocus: true as const } : {})}
              onPress={async () => {
                await update($, selected, () => one.id);
                await update($, view, () => 'detail');
              }}
            >
              {`${one.tool} ${one.server ?? '-'} ${one.ms}ms ~${formatTokens(estTokens(one.textChars))} tok${one.isError ? ' ✗' : ''}`}
            </Button>
          ))
        )}
        {gone > 0 && <Text dimColor>{`${gone} older calls are in the logs`}</Text>}
      </Box>
    );
  });
};

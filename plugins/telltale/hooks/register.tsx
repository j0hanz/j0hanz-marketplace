// telltale: an observe-only mod. Every hook hands back exactly what `next(e)` returned (R3);
// its own work runs inside `safe`, so a fault here never changes or blocks a call.

import { atom, read, update } from 'claude-code';
import type {
  EngineInterface,
  Register,
  RenderElement,
  RenderInput,
  RenderSurface,
  SessionUsage,
} from 'claude-code';

import type { Call, CallDetail, Inventory, InventoryRow, NextAction, Totals, View } from '../types';
import {
  bandRow,
  callTable,
  chunks,
  clip,
  cutArgs,
  detailHeader,
  estTokens,
  formatDur,
  formatTokens,
  isAbsolute,
  isJson,
  labelCalls,
  logsPath,
  mcpServer,
  pct,
  plural,
  pretty,
  receipt,
  redact,
  serverHeading,
  serverTool,
  show,
  skillGroup,
  statusLine,
  toParts,
  toolName,
  usageText,
  usedInAnswer,
  type Response,
} from './lib';

const PANE = 'telltale';
const KEEP = 200; // R25
const SHOWN = 20_000; // R20
// R35: each view's key row.
const KEYS_CALLS = '↑↓ select · enter open · esc close';
const KEYS_DETAIL = 'n/p older/newer · c copy args · y copy result · b back';
const KEYS_INVENTORY = 'm measure · esc close';

const calls = atom({ plugin: 'telltale', key: 'calls' } as const, []);
const dropped = atom({ plugin: 'telltale', key: 'dropped' } as const, 0);
const view = atom({ plugin: 'telltale', key: 'view' } as const, 'calls');
const selected = atom({ plugin: 'telltale', key: 'selected' } as const, null);
const EMPTY_INVENTORY: Inventory = { rows: [], status: 'idle', window: null, measured: {} };
// R21, R47: `measured` holds the last `m` press's figures, by row id, until the next press.
const inventory = atom({ plugin: 'telltale', key: 'inventory' } as const, EMPTY_INVENTORY);
const logFolder = atom({ plugin: 'telltale', key: 'folder' } as const, '');
// R10: the directory the session started in, which the empty list's `logs:` path is relative to.
const startedIn = atom({ plugin: 'telltale', key: 'start' } as const, '');
// Kept in state so a reload (a code edit, or a settings change) neither repeats the notice (R16)
// nor strands a `pending` row (delta R12).
const warnedOnce = atom({ plugin: 'telltale', key: 'warned' } as const, false);
const pendingIds = atom({ plugin: 'telltale', key: 'pending' } as const, {});
// R36, R47: subagent names by id. Only added to: the engine drops a finished agent from its list.
const agentNames = atom({ plugin: 'telltale', key: 'agents' } as const, {});
// R47: what a hot reload keeps beyond the rows: totals, the turn counter, the turn's toast.
const NO_TOTALS: Totals = { calls: 0, errors: 0, tokens: 0, skills: [], ctx: null, tools: {} };
const totals = atom({ plugin: 'telltale', key: 'totals' } as const, NO_TOTALS);
const running = atom({ plugin: 'telltale', key: 'running' } as const, {});
const tick = atom({ plugin: 'telltale', key: 'tick' } as const, 0);
const turnCount = atom({ plugin: 'telltale', key: 'turnNo' } as const, 0);
const toastedTurn = atom({ plugin: 'telltale', key: 'toastedTurn' } as const, -1);
// R28: a large result's toast waits for its turn to end, so an error that lands
// later in the turn still takes the turn's one toast.
const deferredToast = atom({ plugin: 'telltale', key: 'deferred' } as const, null);
const message = atom({ plugin: 'telltale', key: 'message' } as const, null);

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
  turn: number; // R34
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

// Session state. A reload runs the module afresh; session.start restores the folder, the
// start directory and the turn counter from `$.state`.
let logDir = '.claude/telltale';
let root = '';
let fullPayloads = false;
let interactive = true;
let folder = '';
let startDir = '';
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
async function writeLogs($: EngineInterface, turn: Turn, done: Map<string, Done>, n: number) {
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
  await update($, message, () => null); // R39: a message lasts until the view changes
  await update($, view, () => next);
  if (next === 'inventory') await loadInventory($);
}

// Checked and set with no await in between, so two presses cannot both start a count.
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
      group: `skill:${skillGroup(skill.source, skill.pluginName)}`, // delta R18
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

/** Claude Code's context breakdown, as Inventory rows, or why it could not be read. */
async function fetchRows($: EngineInterface, breakdown: 'summary' | 'full') {
  let usage: SessionUsage | undefined;
  let failure = 'unknown';
  try {
    usage = await $.session.usage({ breakdown });
  } catch (error) {
    failure = error instanceof Error && error.message ? error.message : 'unknown';
  }
  const window = usage?.context?.breakdown?.rawMaxTokens ?? usage?.context?.window ?? null;
  return { rows: rowsOf(usage), window, failure };
}

/** Stores fresh rows. `counted` is a count's figures; a summary keeps the last count's (R21). */
async function storeRows(
  $: EngineInterface,
  rows: InventoryRow[],
  window: number | null,
  counted: Record<string, number> | null,
) {
  // Decided inside the updater, so a summary load and a count that cross keep the count's figures.
  await update($, inventory, (inv): Inventory => {
    const measured = counted ?? inv.measured ?? {};
    return {
      rows: rows.map((row) => {
        const exact = measured[rowId(row)];
        return exact === undefined ? row : { ...row, tokens: exact, measured: true };
      }),
      // A summary load landing mid-count keeps the count's `measuring` status.
      status: counted === null && measuring ? 'measuring' : 'idle',
      window,
      measured,
    };
  });
}

/**
 * R18, R22, R43: the Inventory from Claude Code's free local estimate. A failure shows `Context
 * usage unavailable` when the view loads (`'unavailable'`, R22 as modified) and keeps the figures
 * shown when a turn end reloads them (`'keep'`, R43).
 */
async function loadInventory($: EngineInterface, onFail: 'unavailable' | 'keep' = 'unavailable') {
  const { rows, window } = await fetchRows($, 'summary');
  if (rows === null) {
    if (onFail === 'unavailable') {
      await update($, inventory, (): Inventory => ({ ...EMPTY_INVENTORY, status: 'unavailable' }));
    }
    return;
  }
  await storeRows($, rows, window, null);
}

/** R21: `m` counts MCP tool and memory file rows exactly; skill rows stay estimates. */
async function measureInventory($: EngineInterface) {
  if (measuring) return;
  // delta R21: a press while usage is unavailable changes nothing, so it never raises the flag a
  // turn-end reload would read as `measuring`.
  const current =
    (await safe(() => $.state.get({ plugin: 'telltale', key: 'inventory' })))?.value ??
    EMPTY_INVENTORY;
  if (current.status === 'unavailable' || measuring) return;
  measuring = true;
  try {
    await update($, inventory, (inv): Inventory => ({ ...inv, status: 'measuring' }));
    const { rows, window, failure } = await fetchRows($, 'full');
    if (rows === null) {
      await update($, inventory, (inv): Inventory => ({
        ...inv,
        status: `measure failed: ${failure}`,
      }));
      return;
    }
    const present = new Set(current.rows.map(rowId));
    const counted: Record<string, number> = {};
    for (const row of rows) {
      if (present.has(rowId(row)) && !row.group.startsWith('skill:')) {
        counted[rowId(row)] = row.tokens;
      }
    }
    await storeRows($, rows, window, counted);
  } finally {
    measuring = false;
  }
}

/** R29: marks a counted call in flight. */
async function startRunning($: EngineInterface, id: string, tool: string, startedAt: number) {
  await update($, running, (list) => ({ ...list, [id]: { tool, startedAt } }));
}

/** R29, R30: the call left flight. */
async function stopRunning($: EngineInterface, id: string) {
  await update($, running, (list) => {
    const { [id]: _done, ...rest } = list;
    return rest;
  });
}

/** R26, R46: the status entry from the session totals; none while there is nothing to show. */
async function showStatus($: EngineInterface) {
  if (!interactive) return;
  try {
    const t = await read($, totals);
    $.ui.status(
      statusLine({
        calls: t.calls,
        errors: t.errors,
        tokens: t.tokens,
        skills: t.skills.length,
        ctx: t.ctx,
      }),
    );
  } catch {
    await safe(() => $.ui.status(undefined));
  }
}

/** R28: one toast per main-thread turn, for a counted call that failed or read 40,000+ chars. */
async function maybeToast($: EngineInterface, call: Captured) {
  if (!interactive || call.server === null) return;
  const large = call.text.length >= 40_000;
  if (!call.isError && !large) return;
  const name = serverTool(call.tool);
  if (!call.isError) {
    // R28: the error text wins, so the large-result toast is held for the turn's end.
    await update($, deferredToast, (held) =>
      held?.turn === call.turn
        ? held
        : {
            turn: call.turn,
            text: `${name} returned ~${formatTokens(estTokens(call.text.length))} tok`,
          },
    );
    return;
  }
  let fresh = false;
  await update($, toastedTurn, (turn) => {
    fresh = turn !== call.turn;
    return call.turn;
  });
  if (!fresh) return;
  $.ui.toast(`${name} failed · /telltale`);
}

/** R26, R42, R47: a counted call joins the session totals, which outlive the 200 kept rows. */
async function addTotals($: EngineInterface, call: Captured) {
  if (call.server === null) return;
  const tokens = estTokens(call.text.length);
  const errors = call.isError ? 1 : 0;
  await update($, totals, (t) => {
    const tool = t.tools[call.tool] ?? { calls: 0, errors: 0, tokens: 0 };
    return {
      ...t,
      calls: t.calls + 1,
      errors: t.errors + errors,
      tokens: t.tokens + tokens,
      tools: {
        ...t.tools,
        [call.tool]: {
          calls: tool.calls + 1,
          errors: tool.errors + errors,
          tokens: tool.tokens + tokens,
        },
      },
    };
  });
}

/** The pane's shared parts: the view row, the key row and the drawable width (R23, R35, R48). */
type Frame = {
  e: RenderInput<'Pane'>;
  width: number;
  tabs: RenderElement;
  keyRow: (keys: string) => RenderElement;
};

// R48: the detail's action Buttons, and the columns they need on one row (`<hotkey>: <label>`,
// two between them); narrower than that they stack.
const DETAIL_BUTTONS = [
  { key: 'back', hotkey: 'b', label: 'Back' },
  { key: 'older', hotkey: 'n', label: 'Older' },
  { key: 'newer', hotkey: 'p', label: 'Newer' },
  { key: 'copyArgs', hotkey: 'c', label: 'Copy args' },
  { key: 'copyText', hotkey: 'y', label: 'Copy result' },
] as const;
const DETAIL_BUTTONS_WIDTH =
  DETAIL_BUTTONS.reduce((sum, b) => sum + `${b.hotkey}: ${b.label}`.length, 0) +
  2 * (DETAIL_BUTTONS.length - 1);

/** R36-R40: one call's detail. */
async function drawDetail($: EngineInterface, frame: Frame, list: Call[], call: Call) {
  const { e, width, tabs, keyRow } = frame;
  const { Box, Text, Button, Code } = $.ui.resolve(e);
  const detail = details.get(call.id);
  const note = await read($, message);
  const names = await read($, agentNames);
  // R37: JSON is drawn as json code; a cut or non-JSON field as plain text (R11, R20).
  const field = (key: string, label: string, raw: string, full: number) => {
    const shown = show(pretty(raw), raw, full);
    return [
      <Text key={key} dimColor>
        {label}
      </Text>,
      ...(isJson(shown)
        ? [<Code key={`${key}:code`} language="json" source={shown} />]
        : chunks(shown).map((part, i) => <Text key={`${key}:${i}`}>{part}</Text>)),
    ];
  };
  // R38: n is the next older call, p the next newer; the ends change nothing.
  const step = (by: number) => async () => {
    await update($, message, () => null);
    const to = list[list.findIndex((one) => one.id === call.id) + by];
    if (to) await update($, selected, () => to.id);
  };
  // R39, R40: the text the pane keeps, never indented; a refusal names its reason.
  const copy = (which: 'args' | 'text') => async (press: { surface: RenderSurface }) => {
    if (!detail) {
      await update($, message, () => 'copy failed: text not kept after a reload');
      return;
    }
    const text = which === 'args' ? detail.args : detail.text;
    const total = which === 'args' ? call.argsChars : call.textChars;
    const result = await $.ui.copy({ text, surface: press.surface });
    await update($, message, () =>
      result.isCopied
        ? text.length < total
          ? `copied ${text.length} of ${total} chars`
          : `copied ${text.length} chars`
        : `copy failed: ${result.reason}`,
    );
  };
  const presses: Record<
    (typeof DETAIL_BUTTONS)[number]['key'],
    (press: { surface: RenderSurface }) => Promise<void>
  > = {
    back: async () => {
      await openView($, 'calls'); // clears the message too
      await focusRow($, call.id);
    },
    older: step(-1),
    newer: step(1),
    copyArgs: copy('args'),
    copyText: copy('text'),
  };
  const header = detailHeader({
    tool: toolName(call.tool),
    server: call.server,
    agentId: call.agentId,
    agentName: call.agentId ? names[call.agentId] : undefined,
    ms: call.ms,
    chars: call.textChars,
    tokens: estTokens(call.textChars),
    next: call.next,
  });
  const used = detail && detail.used.length > 0 ? detail.used.join(', ') : 'none';
  return (
    <Box flexDirection="column">
      {tabs}
      <Box flexDirection={width < DETAIL_BUTTONS_WIDTH ? 'column' : 'row'} columnGap={2}>
        {DETAIL_BUTTONS.map((b) => (
          <Button key={b.key} hotkey={b.hotkey} plain onPress={presses[b.key]}>
            {b.label}
          </Button>
        ))}
      </Box>
      <Box flexDirection="row">
        <Text bold>{clip(header, width - (call.isError ? 8 : 0))}</Text>
        {call.isError && <Text color="error"> · error</Text>}
      </Box>
      {detail ? (
        [
          ...field('args', 'arguments', detail.args, call.argsChars),
          ...field('text', 'what Claude read', detail.text, call.textChars),
        ]
      ) : (
        <Text dimColor>{clip('text not kept after a reload; see the logs', width)}</Text>
      )}
      <Text dimColor>{clip('duration includes any permission prompt', width)}</Text>
      <Text>{clip(`used in answer: ${used}`, width)}</Text>
      {note !== null && <Text>{clip(note, width)}</Text>}
      {keyRow(KEYS_DETAIL)}
    </Box>
  );
}

/** R18, R21, R22, R41-R43: what each MCP server, skill and memory file costs in context. */
async function drawInventory($: EngineInterface, frame: Frame) {
  const { e, width, tabs, keyRow } = frame;
  const { Box, Text, Button } = $.ui.resolve(e);
  const inv = await read($, inventory);
  // delta R21: `m` stays bound while usage is unavailable, and a press there changes nothing.
  const measure = (
    <Button key="measure" hotkey="m" plain onPress={() => measureInventory($)}>
      Measure
    </Button>
  );
  if (inv.status === 'unavailable') {
    return (
      <Box flexDirection="column">
        {tabs}
        <Text>Context usage unavailable</Text>
        {measure}
        {keyRow(KEYS_INVENTORY)}
      </Box>
    );
  }
  const used = await read($, totals);
  const window = inv.window;
  // R42: a server's share of the session totals is the sum of its tool rows' matches.
  const usageOf = (rows: InventoryRow[]) => {
    const sum = { calls: 0, errors: 0, tokens: 0 };
    for (const row of rows) {
      const tool = used.tools[row.name];
      if (!tool) continue;
      sum.calls += tool.calls;
      sum.errors += tool.errors;
      sum.tokens += tool.tokens;
    }
    return sum.calls > 0 ? sum : undefined;
  };
  type Sub = { name: string; rows: InventoryRow[]; tokens: number };
  // R41: each group's total and share of the window; `heading` draws a sub-group's title row.
  const group = (
    prefix: string,
    title: string,
    empty: string,
    heading: (one: Sub, pad: number, max: number) => string | null,
    note: (row: InventoryRow) => string,
  ) => {
    const rows = inv.rows.filter((row) => row.group.startsWith(prefix));
    const total = rows.reduce((sum, row) => sum + row.tokens, 0);
    const share = window ? ` · ${pct(total, window)}% of ${formatTokens(window)}` : '';
    const groups = [...new Set(rows.map((row) => row.group))].map((name) => {
      const members = rows.filter((row) => row.group === name).sort((a, b) => b.tokens - a.tokens);
      const tokens = members.reduce((sum, row) => sum + row.tokens, 0);
      return { name: name.slice(prefix.length), rows: members, tokens };
    });
    const pad = Math.max(0, ...groups.map((one) => one.name.length));
    const max = Math.max(0, ...groups.map((one) => one.tokens));
    return (
      <Box flexDirection="column">
        <Text bold>
          {clip(rows.length > 0 ? `${title}  ${formatTokens(total)} tok${share}` : title, width)}
        </Text>
        {rows.length === 0 ? (
          <Text dimColor>{empty}</Text>
        ) : (
          groups.map((one) => {
            const line = heading(one, pad, max);
            return (
              <Box key={one.name} flexDirection="column">
                {line !== null && <Text>{clip(line, width)}</Text>}
                {one.rows.map((row) => (
                  <Text key={row.name}>
                    {clip(
                      `  ${row.name}  ${formatTokens(row.tokens)} tok  ${row.measured ? 'measured' : 'est'}${row.state ? `  ${row.state}` : ''}${note(row)}`,
                      width,
                    )}
                  </Text>
                ))}
              </Box>
            );
          })
        )}
      </Box>
    );
  };
  const server = (one: Sub, pad: number, max: number) =>
    serverHeading({ ...one, pad, max, window, usage: usageText(usageOf(one.rows)) });
  const unused = (row: InventoryRow) => (used.tools[row.name] ? '' : '  never called');
  return (
    <Box flexDirection="column">
      {tabs}
      {group('mcp:', 'MCP tools', 'No MCP servers connected', server, unused)}
      {group(
        'skill:',
        'Skills',
        'No skills listed',
        (one) => one.name,
        () => '',
      )}
      {group(
        'memory',
        'Memory files',
        'No memory files loaded',
        () => null,
        () => '',
      )}
      {measure}
      {inv.status === 'measuring' && <Text dimColor>measuring…</Text>}
      {inv.status.startsWith('measure failed') && <Text>{clip(inv.status, width)}</Text>}
      {keyRow(KEYS_INVENTORY)}
    </Box>
  );
}

/** R10, R32-R34: the calls as a table, newest first, grouped by turn. */
async function drawCalls($: EngineInterface, frame: Frame, list: Call[], chosen: string | null) {
  const { e, width, tabs, keyRow } = frame;
  const { Box, Text, Button } = $.ui.resolve(e);
  if (list.length === 0) {
    const at = (await read($, logFolder)) || folder;
    const start = (await read($, startedIn)) || startDir;
    return (
      <Box flexDirection="column">
        {tabs}
        <Text dimColor>No tool calls yet</Text>
        <Text dimColor>{clip(`logs: ${logsPath(at, start)}`, width)}</Text>
        {keyRow(KEYS_CALLS)}
      </Box>
    );
  }
  const gone = await read($, dropped);
  const newest = [...list].reverse();
  const table = callTable(
    newest.map((one) => ({
      tool: `${one.agentId ? '↳ ' : ''}${toolName(one.tool)}`,
      server: one.server,
      ms: one.ms,
      tokens: estTokens(one.textChars),
      isError: one.isError,
      next: one.next,
    })),
    width,
  );
  // R34: each turn's call count and tokens, in one pass.
  const byTurn = new Map<number, { calls: number; tokens: number }>();
  for (const one of list) {
    const sum = byTurn.get(one.turn) ?? { calls: 0, tokens: 0 };
    byTurn.set(one.turn, { calls: sum.calls + 1, tokens: sum.tokens + estTokens(one.textChars) });
  }
  const rows = newest.flatMap((one, i) => {
    const cell = table.rows[i]!;
    const warn = one.next === 'retried' || one.next === 'aborted' || one.next === 'pending';
    const sum = byTurn.get(one.turn)!;
    const separator =
      i === 0 || newest[i - 1]!.turn !== one.turn
        ? [
            <Text key={`turn:${one.turn}:${i}`} dimColor>
              {clip(
                `turn ${one.turn} · ${plural(sum.calls, 'call')} · ~${formatTokens(sum.tokens)} tok`,
                width,
              )}
            </Text>,
          ]
        : [];
    return [
      ...separator,
      <Box key={`line:${one.id}`} flexDirection="row">
        <Button
          key={`row:${one.id}`}
          plain
          {...(one.id === chosen ? { autoFocus: true as const } : {})}
          onPress={async () => {
            await update($, selected, () => one.id);
            await update($, view, () => 'detail');
          }}
        >
          {cell.main}
        </Button>
        <Text color="error">{cell.mark}</Text>
        {!table.narrow && <Text {...(warn ? { color: 'warning' } : {})}>{cell.next}</Text>}
      </Box>,
    ];
  });
  return (
    <Box flexDirection="column">
      {tabs}
      <Text bold>{clip(table.header, width)}</Text>
      {rows}
      {gone > 0 && <Text dimColor>{clip(`${gone} older calls are in the logs`, width)}</Text>}
      {keyRow(KEYS_CALLS)}
    </Box>
  );
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
    startDir = (await safe(() => read($, startedIn))) || '';
    if (!folder) {
      startDir = e.cwd.replace(/[\\/]+$/, '');
      root = isAbsolute(logDir) ? logDir : `${startDir}/${logDir}`;
      folder = `${root}/${(await safe(() => $.session.id())) ?? 'session'}`;
      await safe(() => update($, logFolder, () => folder));
      await safe(() => update($, startedIn, () => startDir));
    } else {
      root = folder.slice(0, folder.lastIndexOf('/'));
      // A folder kept by v0.2, which kept no start directory: this session's directory stands in.
      if (!startDir) {
        startDir = e.cwd.replace(/[\\/]+$/, '');
        await safe(() => update($, startedIn, () => startDir));
      }
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
    // R34: a failed write uses up its number, which only the kept counter remembers.
    turnNo = Math.max(turnNo, (await safe(() => read($, turnCount))) ?? 0);
    // A call in flight across a reload never completes in this module (README, Known limits).
    await safe(() => update($, running, () => ({})));
    await showStatus($); // R47: the entry comes back after a reload
    // R29: the band's clock. It bumps `tick` once a second while a counted call runs, which
    // redraws the band (it reads `tick`); the timer ends with the module on a reload.
    if (interactive) {
      await safe(() =>
        $.clock.every(1000, () => {
          void safe(async () => {
            if (Object.keys(await read($, running)).length > 0) await update($, tick, (n) => n + 1);
          });
        }),
      );
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
    // R29: a counted call is in flight from here. Queued, never awaited: the call must not wait
    // on a state write (R3).
    const counted =
      mcpServer(e.tool) !== null &&
      (next.origin.plugin === 'engine' || callResponse.has(e.tool_use_id));
    if (counted) {
      void later(() => startRunning($, e.tool_use_id, e.tool, started));
      // R29, R30: an abandoned dispatch leaves flight too; a second stop changes nothing.
      const stop = () => void later(() => stopRunning($, e.tool_use_id));
      // An abort that came before the listener never fires again, so it is read here.
      if (next.signal.aborted) stop();
      else next.signal.addEventListener('abort', stop, { once: true });
    }
    let r: Awaited<ReturnType<typeof next>>;
    try {
      r = await next(e);
    } finally {
      if (counted) void later(() => stopRunning($, e.tool_use_id));
    }
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
        // R34: the number this call's turn file will get (a call between turns joins the next).
        turn: turnNo + 1,
      };
      // Before the return: the turn end reads `buffer` for its log.
      buffer.calls.push(call);
      void later(async () => {
        await listCall($, call);
        await addTotals($, call);
        await showStatus($);
        await maybeToast($, call);
      });
    } catch {
      // R3: a fault here never blocks the result.
    }
    return r;
  });

  on('skill.prompt', async ($, e, next) => {
    const r = await next(e);
    await safe(() => buffer.skills.push({ skill: e.skill, chars: r.text.length }));
    void later(async () => {
      await update($, totals, (t) =>
        t.skills.includes(e.skill) ? t : { ...t, skills: [...t.skills, e.skill] },
      );
      await showStatus($);
    });
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
      // R26: work queued before the clear lands first, so nothing from before it counts after.
      await later(async () => {
        details.clear();
        await savePending($);
        await update($, calls, () => []);
        await update($, dropped, () => 0);
        await update($, view, () => 'calls');
        await update($, selected, () => null);
        await update($, totals, () => NO_TOTALS); // the old context's share goes too (R27)
        await update($, deferredToast, () => null); // a held toast belongs to the cleared turns (R28)
        await showStatus($);
      });
    } else {
      // A call made after the last turn's end belongs to a turn that never completes;
      // write its records here or they are lost with the process (README, Logs).
      await settled;
      const turn = buffer;
      buffer = { calls: [], skills: [], context: null };
      const hasRecords = turn.calls.length + turn.skills.length > 0;
      const n = hasRecords ? ++turnNo : turnNo; // R34: taken with the swap, like turn.complete
      if (hasRecords) await safe(() => update($, turnCount, () => n)); // R47: kept across a reload
      if (!hasRecords) return next(e);
      const labels = labelCalls(
        responses,
        turn.calls.map((call) => ({
          id: call.id,
          tool: call.tool,
          agent: call.agentId ?? 'main',
          response: call.response,
        })),
        () => false, // the session is over: no agent is still running
      );
      const done = new Map(
        turn.calls.map((call) => [call.id, { next: labels[call.id] ?? 'aborted', used: [] }]),
      );
      await safe(() => writeLogs($, turn, done, n));
    }
    return next(e);
  });

  on('session.compact', async ($, e, next) => {
    const r = await next(e);
    // Only a main-conversation compaction that went ahead rebuilds the main context (R8).
    if (e.agentId === undefined && e.trigger !== 'precompute' && (!('skip' in r) || !r.skip)) {
      pendingReason = 'compact';
    }
    return r;
  });

  on('turn.complete', async ($, e, next) => {
    const r = await next(e);
    if (e.agentId !== undefined) return r;
    const turn = buffer;
    buffer = { calls: [], skills: [], context: null };
    // R34: the number is taken with the swap, before any await, so a call that lands while this
    // turn ends is captured with the next number, matching the file it goes to.
    const hasRecords = turn.calls.length + turn.skills.length > 0;
    const n = hasRecords ? ++turnNo : turnNo;
    if (hasRecords) await safe(() => update($, turnCount, () => n)); // R47: kept across a reload
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
      const liveAgents = new Set(
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
        (agent) => agent !== 'main' && (listed === undefined || liveAgents.has(agent)),
      );
      const answer = e.reason === 'answer' ? e.answer : null;
      const done = new Map(
        turn.calls.map((call) => [
          call.id,
          { next: labels[call.id] ?? 'aborted', used: usedInAnswer(call.text, answer) },
        ]),
      );
      return { listed, liveAgents, done };
    });
    if (ready) {
      const { listed, liveAgents, done } = ready;
      // R5, R6: the logs are the durable output. They are written first, in their own `safe`,
      // so a refused pane-state write (below) can never cost a turn its file.
      await safe(() => writeLogs($, turn, done, n));
      // R36: name each listed agent; merged, so an agent the engine has since dropped keeps its name.
      if (listed && listed.length > 0) {
        await safe(() =>
          update($, agentNames, (known) => ({
            ...known,
            ...Object.fromEntries(
              listed.map((agent) => [
                agent.id,
                agent.description ? `${agent.description} (${agent.type})` : agent.type,
              ]),
            ),
          })),
        );
      }
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
        const stopped = listed ? [...pending].filter(([, agent]) => !liveAgents.has(agent)) : [];
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
    // R43: an open Inventory reloads its estimate at each main-thread turn end, keeping its
    // figures when the reload fails (R22 as modified).
    if ((await safe(() => read($, view))) === 'inventory') {
      await safe(() => loadInventory($, 'keep'));
    }
    // R26, R27: the context share Claude Code reports now, or none; the plain call is free.
    const usage = await safe(() => $.session.usage());
    await safe(() => update($, totals, (t) => ({ ...t, ctx: usage?.context?.percent ?? null })));
    await showStatus($);
    // R28: the turn's held large-result toast, when no error took the turn's toast.
    const held = await safe(() => read($, deferredToast));
    if (held && held.turn === n) {
      await update($, deferredToast, () => null);
      let took = false;
      await update($, toastedTurn, (turn) => {
        took = turn !== n;
        return n;
      });
      if (took && interactive) $.ui.toast(held.text);
    }
    // delta R6: a headless run shows nothing of its own. A line another hook set stays first.
    if (!interactive || line === null) return r;
    return { ...r, text: r.text === e.answer ? line : `${r.text}\n${line}` };
  });

  // R29, R30, R31, R46: the band above the prompt while a counted call runs. It reads `tick`, so
  // the one-second timer redraws it; any fault leaves the engine's own band.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    let row: string | null = null;
    try {
      const inFlight = Object.values(await read($, running));
      await read($, tick);
      if (!e.props.hasSurvey && inFlight.length > 0) {
        const first = inFlight.reduce((a, b) => (b.startedAt < a.startedAt ? b : a));
        const now = await $.clock.now();
        const turn = turnNo + 1;
        const done = (await read($, calls)).filter(
          (call) => call.turn === turn && call.server !== null,
        );
        row = bandRow(
          {
            tool: serverTool(first.tool),
            elapsedMs: now - first.startedAt,
            more: inFlight.length - 1,
            turnCalls: done.length,
            turnTokens: done.reduce((sum, call) => sum + estTokens(call.textChars), 0),
            turnErrors: done.filter((call) => call.isError).length,
          },
          e.props.bodyColumns,
        );
      }
    } catch {
      row = null;
    }
    if (row === null) return next(e);
    const { Text } = $.ui.resolve(e);
    return <Text>{row}</Text>;
  }).catch(($, e, next) => next(e));

  // R44, R46: a completed counted call's cost on the line beneath its transcript tool row. It
  // reads `calls`, so the row redraws once the call lands; any fault leaves the engine's row.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    let line: string | null = null;
    try {
      if (!e.props.isRunning && mcpServer(e.props.tool) !== null) {
        const call = (await read($, calls)).find((one) => one.id === e.props.tool_use_id);
        if (call) {
          const tokens = formatTokens(estTokens(call.textChars));
          line = `${formatDur(call.ms)} · ~${tokens} tok${call.isError ? ' · error' : ''}`;
        }
      }
    } catch {
      line = null;
    }
    const drawn = await next(e);
    if (line === null) return drawn;
    const { Box, Text } = $.ui.resolve(e);
    return (
      <Box flexDirection="column">
        {drawn}
        <Text dimColor>{line}</Text>
      </Box>
    );
  }).catch(($, e, next) => next(e));

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
      // R45: docked beside the transcript in the fullscreen layout, the pane stays open while
      // the person works, so toasts show; on the main screen it is a dialog and holds them.
      ...(e.presentation?.isFullscreen ? {} : { holdToasts: true as const }),
    });
    if (next === 'calls') await focusRow($, newest);
    return { text: known ? 'opened' : `unknown view "${raw}"; views: calls, inventory` };
  });

  // delta R11: the selection follows the focus ring across the rows.
  on('ui.focus', async ($, e, next) => {
    const element = e.element;
    if (e.plugin === 'telltale' && e.requestId === PANE) {
      // R39: a copy message lasts until the focus moves. telltale's own moves follow a press or a
      // view change, which clear it already.
      if (e.origin.kind === 'person') await safe(() => update($, message, () => null));
      if (element?.startsWith('row:')) {
        await safe(() => update($, selected, () => element.slice(4)));
      }
    }
    return next(e);
  });

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    await settled;
    const { Box, Text, Button } = $.ui.resolve(e);
    const width = e.props.bodyColumns;
    const current = await read($, view);
    // R23: the detail counts as Calls; the tab of the view not shown is dim.
    const onCalls = current !== 'inventory';
    const tabs = (
      <Box flexDirection="row" columnGap={2}>
        <Button
          key="view:calls"
          hotkey="1"
          plain
          dimColor={!onCalls}
          onPress={() => openView($, 'calls')}
        >
          Calls
        </Button>
        <Button
          key="view:inventory"
          hotkey="2"
          plain
          dimColor={onCalls}
          onPress={() => openView($, 'inventory')}
        >
          Inventory
        </Button>
      </Box>
    );
    // R35, R48: each view ends with one dim row naming its keys, cut to the width.
    const keyRow = (keys: string) => (
      <Text key="keys" dimColor>
        {clip(keys, width)}
      </Text>
    );
    const keysOf = (shown: View) =>
      shown === 'detail' ? KEYS_DETAIL : shown === 'inventory' ? KEYS_INVENTORY : KEYS_CALLS;
    try {
      const list = await read($, calls);
      const chosen = await read($, selected);
      const call = list.find((one) => one.id === chosen);
      const frame = { e, width, tabs, keyRow };
      if (current === 'detail' && call) return await drawDetail($, frame, list, call);
      if (current === 'inventory') return await drawInventory($, frame);
      return await drawCalls($, frame, list, chosen);
    } catch {
      // R46: a view that fails keeps the pane, its view row and its keys.
      return (
        <Box flexDirection="column">
          {tabs}
          <Text>this view could not be drawn</Text>
          {keyRow(keysOf(current))}
        </Box>
      );
    }
  });
};

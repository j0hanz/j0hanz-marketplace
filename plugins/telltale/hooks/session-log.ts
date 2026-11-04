// The session's durable output (R4, R5, R7, R8, R14, R15, R16, R19, R49, R51): the running turn's
// records, the turn and context numbers, the log folder, and writing them. No `$`: `restore` and
// `write` take a port, built from the calling `$`, and register.tsx persists what they hand back.

import type { NextAction } from '../types';
import { cutArgs, estTokens, isAbsolute, redact, safe, toParts } from './lib';

export type Captured = {
  id: string;
  tool: string;
  server: string | null;
  agentId: string | null;
  ms: number;
  args: Record<string, unknown>;
  text: string;
  isError: boolean;
  blocks: string[];
  turn: number; // R34
  permission?: 'allow' | 'ask' | 'deny'; // R50
  rule?: string; // R50: the settings rule that decided, raw; logged redacted, never put in state
};

type ApiTool = {
  id: string;
  name: string;
  agentId: string | null;
  input: unknown;
  ms: number | null;
};

export type Turn = {
  calls: Captured[];
  skills: { skill: string; chars: number }[];
  context: { reason: string; files: { path: string; kind: string; chars: number }[] } | null;
  apiTools: ApiTool[];
};

/** What the turn end knows about a call that its record carries. */
export type CallOutcome = {
  next: NextAction;
  used: string[];
  model: string | null;
  effort: string | number | null;
  ctxDelta?: number;
};

export type LogPort = {
  sessionId(): Promise<string>;
  exists(path: string): Promise<boolean>;
  write(path: string, text: string): Promise<unknown>;
  list(path: string): Promise<readonly { name: string }[]>;
  version(): Promise<string | undefined>;
  /** R16: called at most once per session, also across a reload. */
  onWriteFailed(notice: string): Promise<unknown>;
};

/** What a reload kept in `$.state`. Each is absent on a session's first start. */
export type KeptLog = {
  folder: string | undefined;
  startDir: string | undefined;
  turnNo: number | undefined;
  warned: boolean | undefined;
};

const emptyTurn = (): Turn => ({ calls: [], skills: [], context: null, apiTools: [] });

export const createSessionLog = (options: { logDir?: unknown; fullPayloads?: unknown }) => {
  const logDir =
    typeof options.logDir === 'string' && options.logDir ? options.logDir : '.claude/telltale';
  const fullPayloads = options.fullPayloads === true;
  let root = '';
  let folder = '';
  let startDir = '';
  let turnNo = 0;
  let contextNo = 0;
  let rootReady = false;
  let warned = false;
  let pendingReason: 'clear' | 'compact' | null = null;
  let buffer = emptyTurn();
  const described = new Map<string, { server: string | null; chars: number; deferred: boolean }>();

  const writeFile = async (port: LogPort, name: string, text: string) => {
    try {
      if (!rootReady) {
        if (!(await port.exists(`${root}/.gitignore`)))
          await port.write(`${root}/.gitignore`, '*\n'); // R19
        rootReady = true;
      }
      await port.write(`${folder}/${name}`, text);
    } catch {
      if (warned) return;
      warned = true;
      await safe(() => port.onWriteFailed(`telltale: cannot write logs to ${folder}`));
    }
  };

  return {
    /**
     * R19: anchored to where the session started, and kept so a reload or a later `cd` never moves
     * it. One folder per session id, kept across /clear and resume. Returns what to keep.
     */
    async restore(port: LogPort, { cwd, kept }: { cwd: string; kept: KeptLog }) {
      const here = cwd.replace(/[\\/]+$/, '');
      if (kept.folder) {
        folder = kept.folder;
        root = folder.slice(0, folder.lastIndexOf('/'));
        // A folder kept by v0.2, which kept no start directory: this session's directory stands in.
        startDir = kept.startDir || here;
      } else {
        startDir = here;
        root = isAbsolute(logDir) ? logDir : `${startDir}/${logDir}`;
        folder = `${root}/${(await safe(() => port.sessionId())) ?? 'session'}`;
      }
      for (const entry of (await safe(() => port.list(folder))) ?? []) {
        const turn = /^turn-(\d+)/.exec(entry.name);
        const context = /^context-(\d+)\.json$/.exec(entry.name);
        if (turn) turnNo = Math.max(turnNo, Number(turn[1]));
        if (context) contextNo = Math.max(contextNo, Number(context[1]));
      }
      // R34: a failed write uses up its number, which only the kept counter remembers.
      turnNo = Math.max(turnNo, kept.turnNo ?? 0);
      warned ||= kept.warned === true;
      return { folder, startDir };
    },

    location: () => ({ folder, startDir }),

    /** R34: the number the running turn's file will get (a call between turns joins the next). */
    currentTurn: () => turnNo + 1,

    addCall(call: Captured) {
      buffer.calls.push(call);
    },
    addSkill(skill: string, chars: number) {
      buffer.skills.push({ skill, chars });
    },
    /** R49: a paused turn may list the same use again when it continues: one record per id. */
    addApiTool(use: ApiTool) {
      const seen = buffer.apiTools.find((t) => t.id === use.id);
      if (seen) seen.ms ??= use.ms;
      else buffer.apiTools.push(use);
    },
    describeTool(tool: string, info: { server: string | null; chars: number; deferred: boolean }) {
      described.set(tool, info);
    },
    /** R8: why the next context record exists; `start` when nothing marked it. */
    markReason(reason: 'clear' | 'compact') {
      pendingReason = reason;
    },
    noteContext(files: { path: string; kind: string; chars: number }[]) {
      buffer.context = { reason: pendingReason ?? 'start', files };
      pendingReason = null;
    },

    /** Ends the running turn. R34: the number is taken with the swap, so a call that lands while
     * the turn ends is captured with the next number, matching the file it goes to. */
    take() {
      const turn = buffer;
      buffer = emptyTurn();
      const hasRecords = turn.calls.length + turn.skills.length + turn.apiTools.length > 0;
      const n = hasRecords ? ++turnNo : turnNo;
      return { turn, n, hasRecords };
    },

    /** R4, R5, R7, R8, R15, R51: one turn's records, and its context record when it has one. */
    async write(port: LogPort, turn: Turn, n: number, outcomes: Map<string, CallOutcome>) {
      const records = [
        ...turn.calls.map((call) => {
          const text = redact(call.text) as string;
          const outcome = outcomes.get(call.id)!;
          return JSON.stringify({
            type: 'call',
            tool: call.tool,
            server: call.server,
            agentId: call.agentId,
            model: outcome.model,
            effort: outcome.effort,
            ms: call.ms,
            permission: call.permission ?? null, // R50: null when no verdict was seen
            ...(call.rule ? { permissionRule: redact(call.rule) } : {}),
            args: cutArgs(redact(call.args)),
            chars: call.text.length,
            estTokens: estTokens(call.text.length),
            ...(outcome.ctxDelta === undefined ? {} : { ctxDelta: outcome.ctxDelta }), // R51
            isError: call.isError,
            blocks: call.blocks,
            head: text.slice(0, 300),
            tail: text.slice(-300),
            next: outcome.next,
            usedInAnswer: redact(outcome.used), // R14: the pane keeps the raw values (R25)
            ...(fullPayloads ? { text } : {}),
          });
        }),
        ...turn.skills.map((skill) =>
          JSON.stringify({ type: 'skill', ...skill, estTokens: estTokens(skill.chars) }),
        ),
        ...turn.apiTools.map((use) =>
          JSON.stringify({
            type: 'apiTool',
            id: use.id,
            name: use.name,
            agentId: use.agentId,
            args: cutArgs(redact(use.input)),
            ms: use.ms,
          }),
        ),
      ];
      if (records.length > 0) {
        const parts = toParts(records);
        for (const [k, part] of parts.entries()) {
          const name = parts.length === 1 ? `turn-${n}.jsonl` : `turn-${n}-part${k + 1}.jsonl`;
          await writeFile(port, name, `${part.join('\n')}\n`);
        }
      }
      if (turn.context) {
        contextNo += 1;
        const tools = [...described].map(([tool, info]) => ({ tool, ...info }));
        // R8: which Claude Code built this context, so logs compare across versions.
        const version = await safe(() => port.version());
        await writeFile(
          port,
          `context-${contextNo}.json`,
          JSON.stringify({ ...turn.context, version, tools }),
        );
      }
    },
  };
};

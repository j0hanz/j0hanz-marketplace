// Model responses and pending labels (R4, R12, delta R12, R51): records each agent's steps,
// attributes streamed tool calls to their issuing response, and holds calls labelled `pending`
// at turn end until their agent's next complete response settles them. No `$`: register.tsx
// writes the state it returns.

import type { Call, NextAction } from '../types';

type Response = {
  toolNames: string[];
  complete: boolean;
  model?: string; // R4: the model that answered, else the one the request named
  effort?: string | number; // R4: as the request asked; absent for a model without effort
  /** R51: API-reported input (all three input counts summed) and output, and server tool uses. */
  usage?: { in: number; out: number; serverTools: number } | null;
};

type StepResult = {
  stopReason?: unknown;
  usage?: {
    model?: string;
    input_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
    output_tokens: number;
  } | null;
  serverToolUses?: readonly unknown[] | null;
} | null;

type LabelCall = { id: string; tool: string; agent: string; response: number | null };
type Row = Pick<Call, 'id' | 'tool' | 'next'>;

/** R12: each call's next action, read from the next complete response of its agent. */
const labelCalls = (
  responses: Record<string, Response[]>,
  calls: LabelCall[],
  isRunning: (agent: string) => boolean,
): Record<string, NextAction> => {
  const labels: Record<string, NextAction> = {};
  for (const call of calls) {
    const list = responses[call.agent] ?? [];
    const next =
      call.response === null
        ? undefined
        : list.slice(call.response + 1).find((response) => response.complete);
    labels[call.id] = !next
      ? isRunning(call.agent)
        ? 'pending'
        : 'aborted'
      : next.toolNames.length === 0
        ? 'answered'
        : next.toolNames.includes(call.tool)
          ? 'retried'
          : next.toolNames.includes('AskUserQuestion')
            ? 'asked-user'
            : 'other-tool';
  }
  return labels;
};

/**
 * R51: how much the agent's context grew after response `k`: the next response with usage, its
 * input minus k's input and k's output. Only when k asked for exactly one tool (any tool, built-in
 * included) and no server tool, and the growth is not negative (a compaction ran between them).
 * Clearing old tool results in between shrinks the input without going negative: the figure is
 * then understated, not dropped.
 */
// ponytail: no split for parallel or mixed calls; attribute by chars share if anyone asks.
const ctxDelta = (list: Response[], k: number): number | undefined => {
  const at = list[k];
  if (!at?.usage || at.toolNames.length !== 1 || at.usage.serverTools > 0) return undefined;
  const next = list.slice(k + 1).find((response) => response.usage)?.usage;
  if (!next) return undefined;
  const delta = next.in - at.usage.in - at.usage.out;
  return delta >= 0 ? delta : undefined;
};

export const createPending = () => {
  // ponytail: responses and callResponse grow ~200 B per model request for the process life;
  // prune per agent if sessions ever run 100k+ requests.
  const responses: Record<string, Response[]> = {};
  const callResponse = new Map<string, { agent: string; index: number }>();
  // By id, with their agent.
  const pending = new Map<string, string>();
  // Pending ids carried over a reload: their response index belongs to the old module.
  const stale = new Set<string>();
  const forget = (ids: Iterable<string>) => {
    for (const id of ids) {
      pending.delete(id);
      stale.delete(id);
    }
  };
  return {
    /** Starts a model step for `agentId ?? 'main'` and returns a handle for its stream and end. */
    startStep(agentId?: string, init?: { model?: string; effort?: string | number }) {
      const agent = agentId ?? 'main';
      const list = (responses[agent] ??= []);
      const index =
        list.push({ toolNames: [], complete: false, model: init?.model, effort: init?.effort }) - 1;
      return {
        tool(id: string, name: string) {
          list[index]!.toolNames.push(name);
          callResponse.set(id, { agent, index });
        },
        finish(r?: StepResult): boolean {
          // R4: the model that answered (a fallback, or a model a hook above rewrote) beats the request's.
          if (r?.usage?.model) list[index]!.model = r.usage.model;
          // R51: what the request cost as the API reported it; read by `ctxDelta` at log time.
          const usage = r?.usage;
          if (usage) {
            list[index]!.usage = {
              in:
                usage.input_tokens +
                usage.cache_read_input_tokens +
                usage.cache_creation_input_tokens,
              out: usage.output_tokens,
              serverTools: r?.serverToolUses?.length ?? 0,
            };
          }
          // A null stopReason is a request that failed or was cut off: not a response (delta R12).
          const complete = r?.stopReason != null;
          list[index]!.complete = complete;
          return complete;
        },
      };
    },
    /** Whether `id` was streamed in a model step in this process. */
    hasCall: (id: string) => callResponse.has(id),
    /** R4, R51: the issuing response's model, effort, and measured context growth for `id`. */
    callMeta(id: string): {
      model: string | null;
      effort: string | number | null;
      ctxDelta?: number;
    } {
      const from = callResponse.get(id);
      const list = from ? (responses[from.agent] ?? []) : [];
      const issued = from ? list[from.index] : undefined;
      const delta = from ? ctxDelta(list, from.index) : undefined;
      return {
        model: issued?.model ?? null,
        effort: issued?.effort ?? null,
        ...(delta === undefined ? {} : { ctxDelta: delta }),
      };
    },
    /** R12: labels each call from the next complete response of its agent and holds any that end `pending`. */
    labelTurn(
      calls: { id: string; tool: string; agentId: string | null }[],
      isRunning: (agent: string) => boolean,
    ): Record<string, NextAction> {
      const labels = labelCalls(
        responses,
        calls.map((call) => {
          const agent = call.agentId ?? 'main';
          const from = callResponse.get(call.id);
          return {
            id: call.id,
            tool: call.tool,
            agent,
            response: from?.agent === agent ? from.index : null,
          };
        }),
        isRunning,
      );
      for (const call of calls) {
        if (labels[call.id] === 'pending') pending.set(call.id, call.agentId ?? 'main');
      }
      return labels;
    },
    /** Takes back the ids kept in `$.state` before a reload; each one is stale. */
    restore(kept: Record<string, string>) {
      for (const [id, agent] of Object.entries(kept)) {
        if (!pending.has(id)) {
          pending.set(id, agent);
          stale.add(id);
        }
      }
    },
    waitsOn: (agent: string) => [...pending.values()].includes(agent),
    agents: () => new Set(pending.values()),
    /** Labels for `agent`'s waiting rows once a later response exists. Reads only, so it is
     * safe inside a state updater; `settle` the result afterwards. */
    labelWaiting(rows: Row[], agent: string): Record<string, NextAction> {
      const last = (responses[agent]?.length ?? 0) - 1;
      const waiting = rows.filter((row) => {
        if (pending.get(row.id) !== agent || row.next !== 'pending') return false;
        if (stale.has(row.id)) return last >= 0;
        const from = callResponse.get(row.id);
        return from?.agent === agent && from.index < last;
      });
      return labelCalls(
        responses,
        // A stale call is labelled from the first complete response since the reload.
        waiting.map((row) => ({
          id: row.id,
          tool: row.tool,
          agent,
          response: stale.has(row.id) ? -1 : callResponse.get(row.id)!.index,
        })),
        () => true,
      );
    },
    /** Forgets the ids whose label is final. */
    settle(labels: Record<string, NextAction>) {
      forget(Object.keys(labels).filter((id) => labels[id] !== 'pending'));
    },
    /** R12 rule 2: the ids whose agent has stopped. Only on a list that answered: a failed list
     * says nothing about who stopped. */
    stopped: (liveAgents: Set<string>, listed: boolean) =>
      listed ? [...pending].filter(([, agent]) => !liveAgents.has(agent)).map(([id]) => id) : [],
    forget,
    clear() {
      pending.clear();
      stale.clear();
    },
    snapshot: (): Record<string, string> => Object.fromEntries(pending),
  };
};

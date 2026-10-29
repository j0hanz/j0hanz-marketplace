// Pending labels (delta R12): calls labelled `pending` at their turn end, held until their
// agent's next complete response settles them. No `$`: register.tsx writes the state it returns.

import type { Call, NextAction } from '../types';
import { labelCalls, type Response } from './lib';

type Row = Pick<Call, 'id' | 'tool' | 'next' | 'response'>;

export const createPending = () => {
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
    /** Labels for `agent`'s waiting rows once its response `index` completes. Reads only, so it is
     * safe inside a state updater; `settle` the result afterwards. */
    labelWaiting(
      rows: Row[],
      agent: string,
      index: number,
      responses: Record<string, Response[]>,
    ): Record<string, NextAction> {
      const waiting = rows.filter(
        (row) =>
          pending.get(row.id) === agent &&
          row.next === 'pending' &&
          (stale.has(row.id) || (row.response !== null && row.response < index)),
      );
      return labelCalls(
        responses,
        // A stale call is labelled from the first complete response since the reload.
        waiting.map((row) => ({
          id: row.id,
          tool: row.tool,
          agent,
          response: stale.has(row.id) ? -1 : row.response,
        })),
        () => true,
      );
    },
    /** Forgets the ids whose label is final. */
    settle(labels: Record<string, NextAction>) {
      forget(Object.keys(labels).filter((id) => labels[id] !== 'pending'));
    },
    /** Holds the turn's calls that ended `pending`. */
    track(
      calls: { id: string; agentId: string | null }[],
      done: Map<string, { next: NextAction }>,
    ) {
      for (const call of calls) {
        if (done.get(call.id)?.next === 'pending') pending.set(call.id, call.agentId ?? 'main');
      }
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

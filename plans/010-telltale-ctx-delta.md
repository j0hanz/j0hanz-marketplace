# Plan 010: Log measured context growth (ctxDelta) for single-tool responses

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report, do not improvise. When done, update this plan's status row in
> `plans/README.md` if the index has one. At planning time the index lists
> only plans 001–005; rows for 006–013 are added by whoever maintains the
> index. If there is still no row for 010, say so in your report instead of
> adding one, unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**: `git diff --stat f3e7fb0..HEAD -- plugins/telltale/ docs/plan/2026-10-03-telltale/telltale.spec.md`
> This plan depends on plan 007 (`plans/007-telltale-model-version-server-tools.md`),
> which edits the same places this plan edits. Expect these differences
> from the excerpts below, and no others, in the regions this plan touches:
>
> - **Plan 007**: `Response` in `lib.ts` gains `model?` and `effort?`; the
>   `turn.step` handler's `list.push(...)` also stores `model: e.model, effort: e.effort`,
>   and right after `const r = step.value;` there is a new
>   `await safe(() => { if (r?.usage?.model) list[index]!.model = r.usage.model; for (const use of r?.serverToolUses ?? []) { … } });`
>   block; `writeLogs` gains `const from = callResponse.get(call.id);`,
>   `const issued = …` and `model:` / `effort:` fields after `agentId`;
>   the test harness gains a `usages` queue (World field `usages: unknown[]`,
>   `worldOf` init `usages: [],`, and `usage: world.usages.shift() ?? null,`
>   in place of `usage: null` in the fake `turn.step`), a `serverToolUses`
>   queue, and a fifth `input` parameter on `respond`.
> - **Plan 008** (`plans/008-telltale-permission-verdict.md`, may or may not
>   have landed): `Captured` gains `permission?` and `rule?`, and the
>   `writeLogs` call record gains, right after `ms: call.ms,`:
>   `permission: call.permission ?? null,` and
>   `...(call.rule ? { permissionRule: redact(call.rule) } : {}),`.
> - Plans 004/005/011/013 edit `session.end` and `turn.complete` (not touched
>   here); every telltale plan bumps the version and may add a requirement ID.
>
> Any other change to the `turn.step` handler, the `Response` type in
> `lib.ts`, or the `writeLogs` record literal is a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M (one pure helper, one store, one record field, tests on
  007's harness extension, docs)
- **Risk**: LOW, logs only: a new optional field on `call` records; no UI,
  no change to anything Claude sees (R3), and the field is left out
  whenever it cannot be pinned to one call, so existing records and
  tests are unchanged
- **Depends on**: plans/007-telltale-model-version-server-tools.md (both
  edit the per-response store in `turn.step` and the call record in
  `writeLogs`, and this plan's tests use 007's `usages` harness queue;
  land 007 first and add next to its fields)
- **Category**: direction
- **Planned at**: commit `f3e7fb0`, 2026-10-09

## Why this matters

Every token figure telltale writes is an estimate: `estTokens = ceil(chars / 4)`.
That ratio is badly off for JSON, CJK text and base64, which is exactly
what MCP servers return, and the logs offer no way to check it. Claude Code
already hands telltale the API-reported token counts of every model
request on the `turn.step` result, for free and without any network call.
When a response asks for exactly one tool, the growth of the agent's input
from that response to its next one, minus that response's own output, is a
measured figure for what the tool result (plus anything Claude Code
injected alongside it) added to the context.

After this plan: a `call` record carries `ctxDelta`, that measured growth
in tokens, whenever the call was the only tool its response asked for and
the next response of the same agent reported usage. Nothing on screen
changes; the logs gain a calibration point next to `estTokens`.

What this figure is not: it is not "the exact cost of the tool result".
It also counts system reminders, hook `additionalContext` and attachments
Claude Code added between the two requests. Two more effects can push it
the other way, and neither is verified from the code:

- **Thinking.** With extended thinking, `output_tokens` counts the full
  thinking the model produced, while what is sent back as input on the
  next request may be a different size (a summary, or nothing at all).
  If the replayed part is smaller, every `ctxDelta` comes out low, and for
  a small result it can go negative, in which case the field is dropped.
- **Cleared tool results.** If Claude Code clears or shortens older tool
  results between the two requests (microcompact or context editing), the
  input shrinks without going negative, and `ctxDelta` is understated
  rather than dropped.

The premise that `next.in − k.in − k.out` tracks the result's size is
therefore only checked by the live look in step 7; the unit tests prove
the arithmetic, not the premise. The README wording in step 6 says the
figure is growth, not cost, and the field is named `ctxDelta`, never
`measured` (R21 already owns that word for the Inventory's exact count).

## Current state

- `plugins/telltale/hooks/lib.ts`: pure helpers, unit-tested directly.
  The per-response type and its only reader (lines 131–160, as at
  f3e7fb0; plan 007 adds `model?` and `effort?` to the type):

  ```ts
  export type Response = { toolNames: string[]; complete: boolean };
  export type LabelCall = { id: string; tool: string; agent: string; response: number | null };

  /** R12: each call's next action, read from the next complete response of its agent. */
  export const labelCalls = (
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
      …
  ```

  Line 2 says "Requirement IDs (R1 to R48) are indexed in ../README.md".

- `plugins/telltale/hooks/register.tsx`: the mod.
  - Imports from `./lib` (lines 17–45), one name per line in alphabetical
    order (`chunks`, `clip`, `cutArgs`, …), including `estTokens`,
    `labelCalls` and `type Response`.
  - Module state (lines 127–130):

    ```ts
    // ponytail: responses and callResponse grow ~100 B per model request for the process life;
    // prune per agent if sessions ever run 100k+ requests.
    const responses: Record<string, Response[]> = {};
    const callResponse = new Map<string, { agent: string; index: number }>();
    ```

  - The `Captured` type (lines 78–90) has `agentId: string | null` and
    `response: number | null` (the index of the response that streamed the
    call, within its agent's list). `tool.call` fills it at line 902:
    `response: callResponse.get(id)?.index ?? null,`.
  - `writeLogs` (lines 171–210). Its doc comment at line 171 reads
    `/** R4, R5, R7, R8, R15: one turn's records, and its context record when it has one. */`.
    It builds one JSON line per captured call:

    ```ts
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
    ```

    It runs at each main-thread `turn.complete` (line 1043). After plan 004
    it also runs from `session.end`; this plan needs no change there,
    because the field is computed inside `writeLogs`.

  - The `turn.step` handler (lines 841–866, as at f3e7fb0). The response is
    stored before streaming, and `r` is the `TurnStepResult` once the
    stream ends:

    ```ts
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
    ```

    After plan 007, a `await safe(() => { … });` block sits directly after
    `const r = step.value;`; its first line is
    `if (r?.usage?.model) list[index]!.model = r.usage.model;` and it then
    loops over `r?.serverToolUses` (see the drift check).

    Note `toolNames` collects every tool chunk, built-in ones included, not
    only MCP tools. That is the count the gate needs.

- The API (`plugins/telltale/.claude-plugin/types/claude-code/index.d.ts`,
  cited as api:N):
  - `TurnStepResult.usage: TurnUsage | null` (api:13416): "What the request
    cost as the API reported it, and the model that answered; null when no
    response arrived or it carried no usage."
  - `TurnStepResult.serverToolUses?` (api:13406): tool calls "the API ran
    itself inside the request (the advisor is one)… `toolUses` never lists
    them". Their results come back inside the same response and are re-sent
    as input on the next request, so a response with any server tool use
    cannot be credited to its one client tool. Server tools stream as
    `engine` chunks, never `tool` chunks (api:13294–13297), so they are not
    in `toolNames` and need their own gate.
  - `TurnUsage = ModelUsage & { model: string }` (api:13542); `ModelUsage`
    (api:6387–6414) has `input_tokens`, `output_tokens`,
    `cache_read_input_tokens`, `cache_creation_input_tokens`, "All four
    counts are always present". The full input of a request is the sum of
    the three input fields.
  - The test kit's `expect` has `toHaveLength` (api:15140) and
    `toBeUndefined` (api:15152).

- Tests. `plugins/telltale/tests/lib.test.ts` builds responses with
  `const resp = (toolNames: string[], complete = true) => ({ toolNames, complete });`
  (line 194) and tests `labelCalls` at lines 196–236: the pattern for the
  new helper's tests. `plugins/telltale/tests/register.test.ts`:
  - `World` type (lines 8–29) and `worldOf` (lines 42–157). At f3e7fb0 the
    `turn.step` stub (lines 134–145) always returns `usage: null`:

    ```ts
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
    ```

    Plan 007 step 5 adds `usages: unknown[]` to `World`, `usages: [],` to
    `worldOf`, and replaces `usage: null,` in this stub with
    `usage: world.usages.shift() ?? null,`. A test that pushes a usage object
    onto `world.usages` makes the next `turn.step` return that usage. This
    plan uses that queue and adds no harness change of its own.

  - `respond($, world, tools, agentId?)` (line 173) drives one response;
    `complete($, answer?)` (line 188) ends the turn; `lines(world, path)`
    (line 198) parses a turn file. The R4 test at line 262 is the closest
    end-to-end pattern (respond, call, respond, complete, read record).
  - No existing test asserts a whole `call` record with `toEqual` (R4 uses
    `toMatchObject`), so absence of the field is proven only by the new test.

- `plugins/telltale/README.md`: the `call` record table (lines 87–106), the
  "Reading the logs" jq line (line 130), the index header "(`R1` to `R48`…)"
  (line 164), **R4** (line 169) and **R21** (line 186). Docs file
  `docs/plan/2026-10-03-telltale/telltale.spec.md:145`, an assumption this
  plan makes false as worded:

  ```text
  - Estimated tokens are characters ÷ 4, and every estimate is labeled as one. Only the Inventory's measure action gives exact counts (R21).
  ```

- Conventions: requirement IDs are cited in comments (`// R12: …`);
  deliberate shortcuts carry a `ponytail:` comment naming the ceiling (see
  `register.tsx:127` and `lib.ts:195`); mod work runs inside `safe(...)`.
  Match all three.

## Commands you will need

| Purpose      | Command                       | Expected on success                                                                                                        |
| ------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Plugin tests | `npm run validate`            | exit 0; runs `claude plugin test plugins/telltale` and `tsc -p` on the plugin                                              |
| Lint plugin  | `npx eslint plugins/telltale` | 0 problems (only meaningful once plan 002 landed; before it, eslint ignores `plugins/**` and reports the files as ignored) |
| Full gate    | `npm run check`               | exit 0                                                                                                                     |

`npm run validate` typechecks the plugin only when
`plugins/telltale/.claude-plugin/types/` exists (gitignored, laid by
loading the plugin once with `claude --plugin-dir plugins/telltale`). Until
plan 002 lands, a missing folder prints a `⚠ … no generated types` line and
skips `tsc` silently; check that line is absent from the output.
`npm run check` chains `site:data`, which may rewrite the root `README.md`
generated regions and `site/src/data/marketplace.json`; commit what it
regenerates.

## Scope

**In scope** (the only files you should modify):

- `plugins/telltale/hooks/lib.ts`: the `Response` type, a new `ctxDelta`
  helper, the line-2 ID range comment
- `plugins/telltale/hooks/register.tsx`: the `turn.step` handler (inside
  007's `safe` block), the `writeLogs` call record and its doc comment,
  the import list, the ponytail comment at line 127
- `plugins/telltale/tests/lib.test.ts`: new `ctxDelta` tests
- `plugins/telltale/tests/register.test.ts`: two new tests only (they use
  007's `usages` queue; no change to `World`, `worldOf` or the stub)
- `plugins/telltale/README.md`: call-record table, jq recipe, R4, the new
  requirement, index header range
- `docs/plan/2026-10-03-telltale/telltale.spec.md`: line 145 only
- `plugins/telltale/.claude-plugin/plugin.json`: patch version bump

**Out of scope** (do NOT touch):

- Any UI: receipt, band, status entry, Calls/detail view, Inventory. They
  keep `estTokens`. A UI slice can follow once the logs prove the figure.
- `labelCalls` and its `complete` rule: `ctxDelta` uses "next response with
  usage", not "next complete response"; do not merge the two lookups.
- A `turn` record or `turn.complete`'s `e.usage`: that is a whole-turn
  billing sum, not context growth, and belongs to another idea.
- Splitting a parallel batch's growth across its calls (by chars share or
  otherwise). Left out on purpose, see the ponytail comment in step 2.
- Model/effort/server-tool logging (plan 007), subagent names (006),
  permission verdict (008).
- The test harness (`World`, `worldOf`, the fake `turn.step`): plan 007
  owns those edits.

## Git workflow

- Branch: `telltale/plan-010-ctx-delta` (repo style `<plugin>/<topic>`,
  e.g. `telltale/v0.3-ui`)
- Conventional subject scoped like `git log` shows, e.g.
  `feat(telltale): add status line, live band and table views`. For this
  plan: `feat(telltale): log measured context growth after single-tool responses`
- Do NOT push or open a PR unless the operator instructed it

## Steps

### Step 0: Settle the requirement ID and record baselines

Plans 007 and 008 both claim R49 in their text, and others may add IDs
before this one lands, so the ID is decided now, once:

```bash
grep -n "^- \*\*R" plugins/telltale/README.md | tail -1
```

The new ID is the number on that last line plus one (R49 if the last line
is R48 as at f3e7fb0; R50 after 007; R51 after 007 and 008). Everywhere
this plan writes `R<N>` (code comments, the JSDoc, test names, the README,
the spec line), type that ID, e.g. `R50`. Never type `R<N>` literally.

Also record one baseline for the done criteria:

```bash
grep -c "measured" plugins/telltale/hooks/register.tsx
```

It prints 10 at f3e7fb0; note whatever it prints now.

**Verify**: you have one ID number and one count written down.

### Step 1: Check plan 007 is in place

```bash
grep -n "usages" plugins/telltale/tests/register.test.ts
grep -n "r.usage.model" plugins/telltale/hooks/register.tsx
```

Expected: the first finds 007's `World` field, `worldOf` init and stub
`usage:` line (plus 007's tests); the second finds the `safe` block in
`turn.step`. If either finds nothing, plan 007 has not landed: see STOP
conditions.

### Step 2: The pure helper in `lib.ts`

In `plugins/telltale/hooks/lib.ts`, add an optional `usage` field to
`Response`, next to 007's `model` and `effort` (optional, so `labelCalls`
tests and any literal without it still typecheck):

```ts
export type Response = {
  toolNames: string[];
  complete: boolean;
  model?: string; // (007's line, unchanged)
  effort?: string | number; // (007's line, unchanged)
  /** R<N>: API-reported input (all three input counts summed) and output, and server tool uses. */
  usage?: { in: number; out: number; serverTools: number } | null;
};
```

Below `labelCalls`, add:

```ts
/**
 * R<N>: how much the agent's context grew after response `k`: the next response with usage, its
 * input minus k's input and k's output. Only when k asked for exactly one tool (any tool, built-in
 * included) and no server tool, and the growth is not negative (a compaction ran between them).
 * Clearing old tool results in between shrinks the input without going negative: the figure is
 * then understated, not dropped.
 */
// ponytail: no split for parallel or mixed calls; attribute by chars share if anyone asks.
export const ctxDelta = (list: Response[], k: number | null): number | undefined => {
  const at = k === null ? undefined : list[k];
  if (!at?.usage || at.toolNames.length !== 1 || at.usage.serverTools > 0) return undefined;
  const next = list.slice(k! + 1).find((response) => response.usage)?.usage;
  if (!next) return undefined;
  const delta = next.in - at.usage.in - at.usage.out;
  return delta >= 0 ? delta : undefined;
};
```

Update line 2's "(R1 to R48)" (or whatever top ID it names now) to
"(R1 to R<N>)".

**Verify**: `npm run validate` → exit 0 (nothing uses the helper yet).

### Step 3: Store usage in `turn.step`

In `plugins/telltale/hooks/register.tsx`, in the `turn.step` handler,
inside 007's `await safe(() => { … });` block, directly after its first
line `if (r?.usage?.model) list[index]!.model = r.usage.model;` and before
007's `for (const use of r?.serverToolUses ?? [])` loop, add:

```ts
// R<N>: what the request cost as the API reported it; read by `ctxDelta` at log time.
const usage = r?.usage;
if (usage) {
  list[index]!.usage = {
    in: usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens,
    out: usage.output_tokens,
    serverTools: r?.serverToolUses?.length ?? 0,
  };
}
```

The block then reads, in order: 007's model line, these lines, 007's
server-tool loop. Store usage whether or not the response is `complete`:
a cut-off request that still reported usage measured the context it was
sent with. Do not change `r`; it is returned untouched (R3).

Only if the operator confirmed running this plan without 007 (see STOP
conditions): there is no `safe` block yet, so add one of your own directly
after `const r = step.value;`, wrapping exactly the lines above:
`await safe(() => { …the lines above… });`.

Update the ponytail comment at line 127: change "~100 B" to "~200 B" (007's
model and effort strings plus the three numbers this adds). If 007 has not
landed, use "~150 B".

**Verify**: `npm run validate` → exit 0.

### Step 4: Write `ctxDelta` on the call record

Add `ctxDelta,` to the import list from `./lib`, in alphabetical order
(between `clip,` and `cutArgs,`). In `writeLogs`, inside the
`turn.calls.map` callback, compute the figure next to the other lookups at
the top of the callback (after 007's `const issued = …;` line), and spread
it in right after `estTokens`, so the field sits next to the estimate it
calibrates and is absent (not `null`) when unknown:

```ts
      const delta = ctxDelta(responses[call.agentId ?? 'main'] ?? [], call.response);
      return JSON.stringify({
        …
        estTokens: estTokens(call.text.length),
        ...(delta === undefined ? {} : { ctxDelta: delta }), // R<N>
        isError: call.isError,
        …
```

Do not reorder any field 007 or 008 added. Add the new ID to `writeLogs`'s
doc comment at line 171, so it reads
`/** R4, R5, R7, R8, R15, R<N>: one turn's records, and its context record when it has one. */`
(keep any ID another plan already added there).

The agent key `call.agentId ?? 'main'` is the same one `turn.complete`
passes to `labelCalls` (line 1023). A subagent call whose agent has not
responded again when the file is written gets no field; logs are written
once, so it never gets one later (the same limit as `next: pending`).

**Verify**: `npm run validate` → exit 0; every existing test still passes.
The only 007 test that queues a `usage` (its R4 model/effort test) queues
it for the first response alone, so no later response has usage and no
record gains the field; 007's server-tool tests queue no usage and write
no call record. If an existing test does fail, see STOP conditions.

### Step 5: Tests

`plugins/telltale/tests/lib.test.ts`: add `ctxDelta` to the import list and,
after the R12 `labelCalls` tests (around line 236), add:

```ts
const used = (toolNames: string[], inTok: number, out: number, serverTools = 0) => ({
  toolNames,
  complete: true,
  usage: { in: inTok, out, serverTools },
});

test('R<N>: growth after a single-tool response, net of its output', async () => {
  expect(ctxDelta([used(['x'], 1000, 50), used([], 1400, 20)], 0)).toBe(350);
});

test('R<N>: the next response with usage counts, not a failed one', async () => {
  const list = [
    used(['x'], 1000, 50),
    { toolNames: [], complete: false, usage: null },
    used([], 1600, 9),
  ];
  expect(ctxDelta(list, 0)).toBe(550);
});

test('R<N>: no figure for parallel calls, server tools, no next usage or negative growth', async () => {
  expect(ctxDelta([used(['x', 'Read'], 1000, 50), used([], 1400, 20)], 0)).toBeUndefined();
  expect(ctxDelta([used(['x'], 1000, 50, 1), used([], 1400, 20)], 0)).toBeUndefined();
  expect(ctxDelta([used(['x'], 1000, 50)], 0)).toBeUndefined();
  expect(ctxDelta([used(['x'], 1000, 50), used([], 600, 20)], 0)).toBeUndefined();
  expect(ctxDelta([used(['x'], 1000, 50), used([], 1400, 20)], null)).toBeUndefined();
});
```

`plugins/telltale/tests/register.test.ts`: add no harness code. Near the R4
tests (after the test at line 262), add these two tests, which queue usage
through 007's `usages` queue:

```ts
const U = (input: number, cacheRead: number, cacheWrite: number, output: number) => ({
  model: 'm',
  input_tokens: input,
  cache_read_input_tokens: cacheRead,
  cache_creation_input_tokens: cacheWrite,
  output_tokens: output,
});

test('R<N>: a single-tool call records how much the context grew after it', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  world.usages.push(U(400, 500, 100, 50), U(100, 1200, 100, 20)); // in 1000 out 50, then in 1400
  await respond($ as never, world, [{ id: 'a', name: 'mcp__orders__search' }]);
  await $.tool.call({ tool: 'mcp__orders__search', tool_use_id: 'a' } as never);
  await respond($ as never, world, []);
  await complete($ as never);
  expect(lines(world, `${DIR}/turn-1.jsonl`)[0]).toMatchObject({ estTokens: 1, ctxDelta: 350 });
});

test('R<N>: calls from one response carry no ctxDelta', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  world.usages.push(U(1000, 0, 0, 50), U(1400, 0, 0, 20));
  await respond($ as never, world, [
    { id: 'a', name: 'mcp__orders__search' },
    { id: 'b', name: 'Read' },
  ]);
  await $.tool.call({ tool: 'mcp__orders__search', tool_use_id: 'a' } as never);
  await $.tool.call({ tool: 'Read', tool_use_id: 'b' } as never);
  await respond($ as never, world, []);
  await complete($ as never);
  const records = lines(world, `${DIR}/turn-1.jsonl`);
  expect(records).toHaveLength(2);
  expect(records.some((record) => 'ctxDelta' in record)).toBe(false);
});
```

`estTokens: 1` holds because the stub's default result text is `'ok'`.
Arithmetic of the first test: the first response's input is
400 + 500 + 100 = 1000 and its output 50; the second's input is
100 + 1200 + 100 = 1400; 1400 − 1000 − 50 = 350.

**Verify**: `npm run validate` → exit 0 with the five new tests passing and
every existing test unchanged and green.

### Step 6: README, spec assumption, version

`plugins/telltale/README.md`:

- Call-record table: add a row after `estTokens`:
  `| ctxDelta | number | measured growth of the agent's context after this call, in tokens: the next response's API-reported input minus this response's input and output. Includes reminders and hook context Claude Code added in between. Only when the call was the only tool its response asked for; absent otherwise |`
  (let prettier re-pad the table: `npx prettier --write plugins/telltale/README.md`).
- "Reading the logs": after the existing jq line, add a second block:
  `jq -r 'select(.ctxDelta) | [.tool, .estTokens, .ctxDelta] | @tsv' .claude/telltale/*/turn-*.jsonl`
  with one sentence before it: "Compare the estimate with the measured growth:".
- **R4** (line 169): insert ", and `ctxDelta` when R<N> gives one" before
  the line's final period, whatever its wording is now (plan 007 rewrites
  the middle of this line; keep its words).
- Add **R<N>** as a new line after the current last index line:
  "- **R<N>** A call that was the only tool (built-in included) its model
  response asked for, in a response with no server tool use, is recorded
  with `ctxDelta`: the input tokens the same agent's next response with
  usage was sent with, minus that response's input and output tokens, as
  the API reported them; the field is left out when any condition fails,
  when no such next response exists when the file is written, or when the
  result is negative. It is measured context growth, not the result's exact
  cost: injected reminders and hook context count too."
- Index header (line 164): change its top ID (`R48` at f3e7fb0) to `R<N>`.

`docs/plan/2026-10-03-telltale/telltale.spec.md:145`: replace the second
sentence with "Only the Inventory's measure action gives exact counts of
what is loaded (R21); the logs' `ctxDelta` (README R<N>) is the measured,
approximate growth of the context after a single-tool response."

`plugins/telltale/.claude-plugin/plugin.json`: bump `"version"` one patch
step from whatever it holds (it is `0.3.1` at f3e7fb0; other plans bump it
too).

**Verify**: `grep -n "ctxDelta" plugins/telltale/README.md` → at least the
table row, the jq line, R4 and the new requirement; `npm run check` → exit 0.

### Step 7 (interactive, recommended): the only check of the premise

The unit tests prove the arithmetic; only a live session shows whether
`ctxDelta` tracks real results (see "Why this matters" on thinking and
cleared results). If the operator can run Claude Code: load the plugin
(`claude --plugin-dir plugins/telltale`), ask for a few single MCP calls,
at least one returning plain text of known length and one returning JSON,
then read the turn files:

```bash
jq -c 'select(.type=="call") | {tool, chars, estTokens, ctxDelta}' .claude/telltale/*/turn-*.jsonl
```

Expected: lone calls carry a numeric `ctxDelta` larger than zero, and for
the plain-text result it is roughly `estTokens` plus a small overhead
(tens to a few hundred tokens for reminders). Report every
`estTokens`/`ctxDelta` pair in your summary. If the operator cannot run
Claude Code, say in your report that the premise is unverified.

**Verify**: the jq output has at least one line with a numeric `ctxDelta`,
or the STOP condition below applies.

## Test plan

- `lib.test.ts`, three tests (step 5): the happy path with the exact
  arithmetic (`1400 − 1000 − 50 = 350`); a failed request between the two
  responses is skipped; and the five "no figure" gates (parallel or mixed
  tools, a server tool use, no later usage, negative growth, a call no
  response streamed). Pattern: the R12 `labelCalls` tests at
  `tests/lib.test.ts:194–236`.
- `register.test.ts`, two tests (step 5): end-to-end through `turn.step`
  and `writeLogs`, proving all three input counts are summed (the usage
  numbers are split across `input_tokens`, cache read and cache write);
  and a parallel batch where neither record carries the field. Pattern:
  the R4 test at `tests/register.test.ts:262`.
- Absent, not `null`: the parallel-batch test checks `'ctxDelta' in record`
  is false, which `toMatchObject`-based tests could not.
- Premise: step 7's live look, the only check that the figure means what
  the README says.
- Verification: `npm run validate` → exit 0; `npm run check` → exit 0.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run validate` → exit 0, five new tests present and passing, and
      no `no generated types` warning in the output
- [ ] `npm run check` → exit 0
- [ ] `grep -n "export const ctxDelta" plugins/telltale/hooks/lib.ts` → 1 match,
      and the `ponytail:` comment sits directly above it
- [ ] `grep -c "ctxDelta" plugins/telltale/hooks/register.tsx` → 4 (the
      import, the step 3 comment, `const delta = ctxDelta(` and
      `{ ctxDelta: delta }`); `grep -n "cache_creation_input_tokens" plugins/telltale/hooks/register.tsx`
      → 1 match, inside `turn.step`
- [ ] `grep -c "measured" plugins/telltale/hooks/register.tsx` → the same
      count you recorded in step 0 (10 at f3e7fb0): the word stays R21's
- [ ] `grep -n "ctxDelta" plugins/telltale/README.md` finds the table row,
      the jq line, R4 and the new requirement; the index header names
      `R<N>`; `grep -n "R<N>" plugins/telltale/hooks/lib.ts` (with your
      number) finds line 2, the `Response` field and the JSDoc
- [ ] `grep -rn "R<N>" plugins/telltale/hooks plugins/telltale/tests` (the
      literal text `R<N>`, angle brackets included) → no match
- [ ] `git status` shows only in-scope files (plus the `site:data` regen)
- [ ] `plans/README.md` row for 010 updated, or its absence reported

## STOP conditions

Stop and report back (do not improvise) if:

- The `turn.step` handler, the `Response` type or the `writeLogs` record
  differs from the excerpts by more than the plan 007 and plan 008
  additions listed in the drift check.
- Plan 007 has not landed (step 1 finds nothing). This plan may still be
  executed, but only if the operator confirms. In that case also add 007's
  `usages` harness queue exactly as 007 step 5 describes it (World field
  `usages: unknown[]`, `worldOf` init `usages: [],`, and
  `usage: world.usages.shift() ?? null,` in place of `usage: null,` in the
  fake `turn.step`; skip 007's `serverToolUses` lines), and wrap the step 3 lines in their own `safe` block; 007's
  executor will then find those lines already present.
- The test kit's `turn.step` stub result does not reach telltale's `r` with
  the `usage` the test queued (the register tests get no field while the
  lib tests pass). Report what `r` holds; do not compute usage from
  anything else.
- Any existing test changes outcome, in particular the R4 record tests
  (007's included) or the R12 labelling tests (the `Response` widening
  must not change `labelCalls`).
- In the live check, `ctxDelta` is missing on most lone MCP calls across
  several turns (either `TurnStepResult.usage` is null in practice, or
  thinking makes the growth negative), or on a plain-text result it sits
  far from `estTokens` (below it, or more than double it plus a few
  hundred tokens). Report the pairs before declaring done; the premise
  may be wrong and the README wording would then overclaim.

## Maintenance notes

- Overlaps: plan 007 widens the same `Response` type and `turn.step` `safe`
  block, adds call-record fields and the test harness queue this plan's
  tests use; plan 008 adds call-record fields in `writeLogs` and to
  `Captured`. Plans 006, 009, 011, 012 and 013 share only the version bump
  and the README requirements index. Whoever lands second merges by adding
  fields, never by reordering existing ones. The requirement ID is whichever
  is free at step 0.
- The figure's known noise, for anyone reading the logs: reminders, hook
  `additionalContext` (PostToolUse hooks from other plugins land exactly
  between k and the next request), file-change attachments, tool
  definitions a ToolSearch call loaded, a model fallback that changes
  tokenizer mid-turn, thinking replayed at a size different from its
  `output_tokens` (biases low, can drop the field), and older tool results
  cleared between the two requests (microcompact or context editing;
  understates without dropping). The README calls it growth, not cost, for
  that reason.
- Deliberately deferred: a per-call split for parallel batches (the
  `ponytail:` comment names the upgrade path), and any UI use of the figure.
  A UI slice should wait until real logs show how often `ctxDelta` exists
  and how far it sits from `estTokens`.
- If a later change prunes `responses` (the ponytail at `register.tsx:127`),
  it must keep each agent's responses until that agent's calls are written,
  or `ctxDelta` silently disappears.
- What a reviewer should scrutinize: the gate in `ctxDelta` (exactly one
  tool counting built-ins, no server tools, next response _with usage_ of
  the _same agent_, non-negative), that the store sits inside the `safe`
  block, and that `r` returned from `turn.step` is the same object,
  unmodified.

# Plan 007: Stamp model and effort on call records, engine version on context files, and log server-side tool uses

> **Executor instructions**: Follow this plan step by step. Run every
> command from the repo root, `C:/j0hanz-marketplace` (all paths below are
> relative to it). Run every verification command and confirm the expected
> result before moving to the next step. If anything in the "STOP
> conditions" section occurs, stop and report, do not improvise. When done,
> update the status row for this plan in `plans/README.md` (add the row if
> the index table does not list 007 yet), unless a reviewer dispatched you
> and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat f3e7fb0..HEAD -- plugins/telltale/hooks/register.tsx plugins/telltale/hooks/lib.ts plugins/telltale/tests/register.test.ts plugins/telltale/README.md plugins/telltale/.claude-plugin/plugin.json`
> Other plans touch these files too, and some may have landed first:
> 002 respells regex character classes in `lib.ts` and one boolean at
> `register.tsx:989`; 003 adds list entries in `lib.ts`; 004 adds an `else`
> branch to the `session.end` handler that copies the buffer swap and
> `hasRecords` line from `turn.complete` (step 2 below must then edit that
> copy too); 006 edits `detailHeader` in `lib.ts` and the `$.agent.list()`
> block in `turn.complete`; 008 adds a `permission` field to the call record
> in `writeLogs`, a row to the README call-record table, and bumps the
> "`R1` to `R48`" range at `README.md:164`; 010 (which depends on this plan)
> adds a `usage` block to the `turn.step` hook and a `usages` queue to the
> test harness, the same queue this plan adds. None of 002-006 or 008
> touches the `turn.step` hook, the `Response` type, or the context-file
> write. If the excerpts below for those three places no longer match
> beyond the changes just named, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW, every new read happens after the model response has been
  handed on and inside `safe`, so nothing reaching Claude changes (R3); the
  one behavioral shift is that a turn whose only records are server-side
  tool uses now writes a file and so uses a turn number
- **Depends on**: none (plan 010 depends on this one: it adds more fields to
  the same per-response store)
- **Category**: direction
- **Planned at**: commit `f3e7fb0`, 2026-10-09

## Why this matters

Telltale's logs are its durable output, and the reason to keep them is to
compare runs. Today a call record does not say which model produced the
response that issued the call, or how hard that model was asked to think,
and a `context-<N>.json` does not say which Claude Code version built the
context. After a `/model` switch, a fallback, or with subagents running a
different model, two otherwise identical records cannot be told apart.

Separately, tool calls that the API runs itself inside a model response (the
advisor tool is the one Claude Code has today) never raise `tool.call`, so
they never appear in the logs at all, even though the log is meant to be the
full record of what Claude called.

After this plan: each `call` record carries `model` and `effort`, each
`context-<N>.json` carries `version`, and each server-side tool use is
written as an `apiTool` record in the turn file. These are log-only: no
receipt, total, status entry, toast, band or pane row changes.

Naming: the record type is `apiTool`, not `serverTool`, on purpose.
`serverTool` is already an exported helper in `lib.ts:493` that formats an
MCP tool as `<server>.<tool>` (used at `register.tsx:36,439,1108`). Reusing
the word for "a tool the API ran itself" would give it two meanings in the
same files and greps. The API's own field, `serverToolUses`, keeps its name
wherever the code reads it.

Value caveat, stated plainly so a reviewer can weigh it: the advisor is
neither an MCP tool nor a skill, so the `apiTool` records add little to
telltale's core question (what do skills and MCP servers cost in context).
The API exposes no result text for a server tool use, so no size or token
figure can be logged for it. The model and version stamps are the main win.

## Current state

- `plugins/telltale/hooks/register.tsx` (main module, 1,247 lines).
- `plugins/telltale/hooks/lib.ts` (pure helpers; holds the `Response` type).
- `plugins/telltale/tests/register.test.ts` (the module's tests, run by
  `claude plugin test` from `npm run validate`).
- `plugins/telltale/README.md` (user docs, with the requirements index
  R1 to R48 that source comments and test names cite).
- Mod API types (generated, gitignored, read-only for you):
  `plugins/telltale/.claude-plugin/types/claude-code/index.d.ts`, cited below
  as `api:N`.

### The per-response store

`lib.ts:131`:

```ts
export type Response = { toolNames: string[]; complete: boolean };
```

`register.tsx:127-130`, module-level maps:

```ts
// ponytail: responses and callResponse grow ~100 B per model request for the process life;
// prune per agent if sessions ever run 100k+ requests.
const responses: Record<string, Response[]> = {};
const callResponse = new Map<string, { agent: string; index: number }>();
```

`register.tsx:841-866`, the `turn.step` hook. It pushes one `Response` per
model request, maps each streamed tool id to that response, and reads the
result `r` once the stream ends. It never reads `e.model`, `e.effort`,
`r.usage` or `r.serverToolUses`:

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

### The turn buffer

`register.tsx:92-96` and `:126`:

```ts
type Turn = {
  calls: Captured[];
  skills: { skill: string; chars: number }[];
  context: { reason: string; files: { path: string; kind: string; chars: number }[] } | null;
};
...
let buffer: Turn = { calls: [], skills: [], context: null };
```

`register.tsx:998-1003`, the swap in `turn.complete` (the `buffer = ...`
line is `:999`; plan 004, if landed, has an identical copy in the
`session.end` `else` branch):

```ts
const turn = buffer;
buffer = { calls: [], skills: [], context: null };
// R34: the number is taken with the swap, before any await, so a call that lands while this
// turn ends is captured with the next number, matching the file it goes to.
const hasRecords = turn.calls.length + turn.skills.length > 0;
const n = hasRecords ? ++turnNo : turnNo;
```

### The log writer

`register.tsx:171-209`, `writeLogs`. The call record object starts:

```ts
      return JSON.stringify({
        type: 'call',
        tool: call.tool,
        server: call.server,
        agentId: call.agentId,
        ms: call.ms,
        args: cutArgs(redact(call.args)),
```

and the skill records and context file are written as:

```ts
    ...turn.skills.map((skill) =>
      JSON.stringify({ type: 'skill', ...skill, estTokens: estTokens(skill.chars) }),
    ),
  ];
  ...
  if (turn.context) {
    contextNo += 1;
    const tools = [...described].map(([tool, info]) => ({ tool, ...info }));
    await write($, `context-${contextNo}.json`, JSON.stringify({ ...turn.context, tools }));
  }
```

`redact` (`lib.ts:99`) and `cutArgs` (`lib.ts:129`) both take `unknown`; the
call record redacts first, then cuts (R14 "before any cut", R24). Do the same
for server tool input.

### The requirement-range headers

Two lines name the current highest requirement ID and go stale when R49 is
added:

- `plugins/telltale/hooks/lib.ts:2`: `// directly. Requirement IDs (R1 to R48) are indexed in ../README.md, "Requirements index".`
- `plugins/telltale/README.md:164`: ``The source and tests cite these IDs (`R1` to `R48`, and "delta R12" and similar). ...``

### The API (read these lines yourself before coding)

- `TurnStepInput.model: string` (api:13330): "Which model the request
  names, as the engine resolved it for this step (the session's, a
  fallback's)". A hook above telltale may have rewritten it.
- `TurnStepInput.effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max' | number`
  (api:13335), "absent for a model without effort".
- `TurnStepResult.serverToolUses?: readonly TurnStepServerToolUse[]`
  (api:13406): "The tool calls the API ran itself inside the request (the
  advisor is one) ... no `tool.check` and no `tool.call` chain ...
  `toolUses` never lists them."
- `TurnStepServerToolUse` (api:13427): `{ id, name, input: unknown,
startedAt: number, endedAt?: number }`, both in `$.clock.now()`
  milliseconds. `endedAt` (api:13444-13452) is "Absent when the response
  ended before the result (a stream cut short, a turn paused); a response
  that came whole stamps both alike." There is no result or output field.
  The doc also says "A tool the engine runs (`WebSearch` too) is in
  `toolUses`", so web search already reaches telltale through `tool.call`.
- `TurnStepResult.usage: TurnUsage | null` (api:13416); `TurnUsage.model:
string` (api:13546) is "Which model answered, by the id the API reports".
  Prefer it over `e.model`: it is what actually answered.
- `$.session.version(): Promise<SessionVersion>` (api:2835);
  `SessionVersion` (api:11695) has `version: string` ("as `claude --version`
  prints it"), plus optional `base` and `builtAt`. Log only `version`.

A paused turn is the one case where the same server tool use could be
reported twice: once without `endedAt` in the step that paused, and again
in a later step when the turn continues. The API doc does not promise
either way, so step 3 keeps one record per `id` within a turn and writes
the `id` into the record so a reader can join any repeat across turns.

### Repo conventions to match

- Every piece of mod work is wrapped in `safe(...)` (`register.tsx:98-104`)
  and every hook returns exactly what `next` gave it (R3). Keep both.
- Absent values are written as `null` in records (`server`, `agentId`), not
  left out. **One deliberate exception in this plan**: the context file's
  `version` is left out (not `null`) when Claude Code cannot report it. The
  existing R8 test at `tests/register.test.ts:343` uses `toEqual` on
  `context-1.json` and does not stub `session.version`; writing
  `version: null` would break it. Do not "fix" step 4 into `null`.
- Test names start with the requirement they prove (`'R4: ...'`).
- `.prettierrc` sets `printWidth: 100`. Several code lines below are longer
  than that once indented; step 7 runs `prettier --write` to wrap them, so
  do not hand-wrap to guess prettier's layout.

### Test harness facts (`tests/register.test.ts`)

- `World` type, lines 8-30; `worldOf` initialiser, lines 42-66. `World`
  already has a `usage` field (the `$.usage` report the Inventory uses,
  R21); it is unrelated to the per-step usage added below.
- The fake `turn.step` beneath the plugin, lines 134-147, returns
  `{ turnId, index, answer: '', toolUses, stopReason, usage: null }`. It has
  no way to return `usage` or `serverToolUses` yet; step 5 adds one.
- `respond` (lines 172-186, the doc comment at 172, the arrow at 173)
  drives one model response and passes `model: 'm'` in the `turn.step`
  event, no `effort`.
- An event no test hook answers reaches the kit's bottom hook, which throws
  (api:15769). `$.session.version` is not stubbed in `worldOf`, so in
  existing tests the new `safe(() => $.session.version())` resolves
  `undefined`, `JSON.stringify` drops the key, and the existing R8 test at
  line 343 keeps passing. The existing R3 test already relies on the same
  behavior for `clock.now`.
- Pattern tests: the R4 test at line 262 (a call record via `lines`), the
  R14 args test at lines 384-391 (`token` arg becomes `'[redacted]'`), the R8
  test at line 343 (context file), and the receipt assertion in the R1 test
  at line 566 (`(await complete($ as never, 'the answer')).text` equals the
  answer when there is nothing to report).

## Commands you will need

Run all of these from the repo root, `C:/j0hanz-marketplace`.

| Purpose                  | Command                                                           | Expected on success                                                                     |
| ------------------------ | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Types present (precheck) | `ls plugins/telltale/.claude-plugin/types/claude-code/index.d.ts` | the path prints; if missing, `npm run validate` skips `tsc` with a `⚠` line (see below) |
| Plugin tests + typecheck | `npm run validate`                                                | exit 0; runs `claude plugin test` and `tsc -p plugins/telltale`                         |
| Format (rewrite)         | `npx prettier --write plugins/telltale`                           | exit 0; rewraps lines over 100 columns and re-aligns README tables                      |
| Format (check)           | `npx prettier --check plugins/telltale`                           | exit 0                                                                                  |
| Full gate                | `npm run check`                                                   | exit 0                                                                                  |

Two honest gaps in the gate as of `f3e7fb0` (plan 002 closes both): `npm run
lint` ignores `plugins/**`, so telltale is not linted; and when
`plugins/telltale/.claude-plugin/types/` is absent, `npm run validate` prints
`⚠ ... no generated types` and skips the typecheck while still exiting 0.
Run the precheck above; if the types are missing, STOP (see STOP
conditions). If plan 002 has landed, also run `npx eslint plugins/telltale`
and expect 0 problems.

`npm run check` chains `site:data`, which rewrites the generated regions of
the root `README.md` and `site/src/data/marketplace.json` (the plugin
version shows there). Commit what it regenerates.

## Scope

**In scope** (the only files you should modify):

- `plugins/telltale/hooks/lib.ts`: the `Response` type, and the
  "R1 to R48" range in the header comment at line 2
- `plugins/telltale/hooks/register.tsx`: the `Turn` type, the `buffer`
  initialiser, `writeLogs`, the `turn.step` hook, the buffer swap and
  `hasRecords` line in `turn.complete` (and in `session.end`'s `else` branch
  if plan 004 has landed)
- `plugins/telltale/tests/register.test.ts`: the `World` type, `worldOf`,
  the fake `turn.step`, `respond`, and five new tests
- `plugins/telltale/README.md`: the Logs section, the "`R1` to `R48`" range
  at line 164, and the requirements index
- `plugins/telltale/.claude-plugin/plugin.json`: the version
- `plans/README.md`: this plan's status row only
- Root `README.md`, `site/src/data/marketplace.json`: only as regenerated by
  `npm run check`

**Out of scope** (do NOT touch, even though they look related):

- Receipt, totals, status entry, toasts, band, transcript line and pane:
  server tool uses are logged only. Adding them to any count would make
  R1's "MCP call count" wrong and there is no size to show.
- A `model` or `effort` field on `skill` records: a skill expansion is not
  issued by a model response telltale can tie it to.
- `base` and `builtAt` from `SessionVersion`: `version` already carries the
  dev build suffix.
- Per-response token usage (`r.usage` counts): that is plan 010
  (`ctxDelta`), which builds on the `Response` fields added here.
- The `serverTool` helper in `lib.ts:493`: unrelated (it formats MCP names);
  do not rename it.
- `types/index.d.ts` (telltale's pane-state types): nothing here goes into
  pane state.
- The `ponytail:` note on `responses`/`callResponse`: two short fields per
  response do not change its ceiling meaningfully.

## Git workflow

- Branch: `telltale/plan-007-model-version-server-tools` (repo style is
  `<plugin>/<topic>`, e.g. `telltale/v0.3-ui`)
- Conventional subjects scoped to the plugin, like `git log`'s
  `fix(telltale): redact secret fields in any spelling`. For this plan, e.g.
  `feat(telltale): stamp model and effort on call records` and
  `feat(telltale): log server-side tool uses`
- Do NOT push or open a PR unless the operator instructed it

## Steps

### Step 1: Stamp model and effort on each call record

1. In `plugins/telltale/hooks/lib.ts:131`, widen the type with two optional
   fields (optional so `tests/lib.test.ts`, which builds `Response` objects
   by hand, still typechecks unchanged):

   ```ts
   export type Response = {
     toolNames: string[];
     complete: boolean;
     model?: string; // R4: the model that answered, else the one the request named
     effort?: string | number; // R4: as the request asked; absent for a model without effort
   };
   ```

2. In `register.tsx`'s `turn.step` hook, record what the request named when
   the response is pushed (prettier will wrap this line in step 7):

   ```ts
   const index =
     list.push({ toolNames: [], complete: false, model: e.model, effort: e.effort }) - 1;
   ```

   Then, right after `const r = step.value;`, overwrite the model with the
   one that answered when the API reported it:

   ```ts
   // R4: the model that answered (a fallback, or a model a hook above rewrote) beats the request's.
   await safe(() => {
     if (r?.usage?.model) list[index]!.model = r.usage.model;
   });
   ```

   Keep `return r;` unchanged. Step 3 extends this same `safe` block.

3. In `writeLogs`, inside `turn.calls.map((call) => { ... })`, look up the
   issuing response and add two fields right after `agentId`:

   ```ts
      const from = callResponse.get(call.id);
      const issued = from ? responses[from.agent]?.[from.index] : undefined;
      ...
        agentId: call.agentId,
        model: issued?.model ?? null,
        effort: issued?.effort ?? null,
   ```

   Use `callResponse` (the agent key the stream used), not `call.agentId`
   plus `call.response`: it is the exact entry the response was stored
   under. A call no model response streamed (no `callResponse` entry) gets
   `null` for both, like `server` for a built-in.

**Verify**: `npm run validate` → exit 0. The existing R4 tests use
`toMatchObject`, so the new fields do not break them; the R15 600-call test
grows by about 30 characters per record and must still produce 3 parts.

### Step 2: Add an `apiTools` list to the turn buffer

1. `register.tsx:92-96`, add to `Turn`:

   ```ts
   apiTools: {
     id: string;
     name: string;
     agentId: string | null;
     input: unknown;
     ms: number | null;
   }
   [];
   ```

2. Every place that builds an empty buffer gets `apiTools: []`: the
   declaration at line 126, the swap in `turn.complete` at line 999, and, if
   plan 004 has landed, the swap in `session.end`'s `else` branch. `tsc`
   flags any you miss.

3. Every `hasRecords` line counts the new list, so a turn whose only records
   are server tool uses still writes its file (R5) instead of silently
   dropping them at the swap:

   ```ts
   const hasRecords = turn.calls.length + turn.skills.length + turn.apiTools.length > 0;
   ```

   `tsc` will NOT flag a missed `hasRecords` line. Find them all with
   `grep -n "const hasRecords" plugins/telltale/hooks/register.tsx`: one
   line before plan 004, two after it. Edit each.

4. In `writeLogs`, append the records after the skill records (redact, then
   cut, exactly like call args):

   ```ts
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
   ```

**Verify**: `npm run validate` → exit 0 (nothing fills the list yet).

### Step 3: Capture server tool uses in `turn.step`

Extend the `safe` block added in step 1:

```ts
await safe(() => {
  if (r?.usage?.model) list[index]!.model = r.usage.model;
  // R49: tools the API ran itself raise no tool.call. Logged into the running turn (as R2
  // does for subagent calls), never counted: the API exposes no result to size.
  for (const use of r?.serverToolUses ?? []) {
    const ms = use.endedAt === undefined ? null : use.endedAt - use.startedAt;
    // A paused turn may list the same use again when it continues: one record per id.
    const seen = buffer.apiTools.find((t) => t.id === use.id);
    if (seen) seen.ms ??= ms;
    else
      buffer.apiTools.push({
        id: use.id,
        name: use.name,
        agentId: e.agentId ?? null,
        input: use.input,
        ms,
      });
  }
});
```

Raw `input` goes into the buffer; it is redacted when written (step 2.4),
the same as call args, so redaction stays in one place. The dedupe only
sees the current turn's buffer: a repeat that arrives after the turn file
was written is logged again, with the same `id`, so a reader can still join
the two.

**Verify**: `npm run validate` → exit 0.

### Step 4: Write the engine version into each context file

In `writeLogs`, inside `if (turn.context) { ... }`:

```ts
// R8: which Claude Code built this context, so logs compare across versions.
const version = (await safe(() => $.session.version()))?.version;
await write($, `context-${contextNo}.json`, JSON.stringify({ ...turn.context, version, tools }));
```

An unavailable version leaves `version` undefined, which `JSON.stringify`
omits. This is the deliberate exception to the "absent means `null`"
convention (see Repo conventions); keep it.

**Verify**: `npm run validate` → exit 0; the existing R8 test at line 343
(a `toEqual` on `context-1.json`) must still pass, because nothing in it
answers `session.version`.

### Step 5: Let the harness return usage and server tool uses, then add the tests

In `plugins/telltale/tests/register.test.ts`. The `usages` lines below are
word for word the ones plan 010 adds, so that 010, which lands after this
plan, finds its harness step already done instead of adding a second way to
queue usage:

1. `World` type: add these two fields
   ```ts
   usages: unknown[]; // usage each turn.step returns, in order; null when empty
   serverToolUses: unknown[]; // serverToolUses each turn.step returns, in order; absent when empty
   ```
2. `worldOf` initialiser: add `usages: [],` and `serverToolUses: [],`.
3. The fake `turn.step` (lines 134-147): replace `usage: null,` with
   `usage: world.usages.shift() ?? null,` and add
   `serverToolUses: world.serverToolUses.shift(),` after it.
4. `respond` (lines 172-186): add a fifth parameter
   `input: Record<string, unknown> = {}` and spread `...input` last into the
   `turn.step` event object. Existing callers are unchanged.
5. Add these tests: the R4 test after the R4 test that starts at line 317
   (it ends before the R7 test at 332); the R8 test after the R8 test that
   starts at line 368 (it ends before the R14 test at 384); the three R49
   tests right after that new R8 test.

```ts
test('R4: a call record names the model that answered and the effort asked for', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  world.usages.push({
    input_tokens: 1,
    output_tokens: 1,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
    model: 'claude-answered',
  });
  await respond($ as never, world, [{ id: 'a', name: 'mcp__o__s' }], undefined, { effort: 'high' });
  await $.tool.call({ tool: 'mcp__o__s', tool_use_id: 'a' } as never);
  await respond($ as never, world, [{ id: 'b', name: 'mcp__o__s' }]);
  await $.tool.call({ tool: 'mcp__o__s', tool_use_id: 'b' } as never);
  await respond($ as never, world, []);
  await complete($ as never);
  const records = lines(world, `${DIR}/turn-1.jsonl`);
  expect(records[0]).toMatchObject({ model: 'claude-answered', effort: 'high' });
  // No usage reported: the model the request named, and no effort.
  expect(records[1]).toMatchObject({ model: 'm', effort: null });
});

test('R8: a context record names the Claude Code version', async ($, on) => {
  const world = worldOf(on);
  on('prompt.context', ($, e) => ({ blocks: e.blocks, instructionFiles: e.instructionFiles }));
  on('session.version', () => ({ value: { version: '2.1.300' } }) as never);
  await $.session.start(SESSION);
  await $.prompt.context({ blocks: [], instructionFiles: [] } as never);
  await complete($ as never);
  expect(JSON.parse(world.files.get(`${DIR}/context-1.json`)!)).toMatchObject({
    reason: 'start',
    version: '2.1.300',
  });
});

test('R49: a tool the API ran itself is logged redacted and counted nowhere', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  world.serverToolUses.push([
    {
      id: 'sv1',
      name: 'advisor',
      input: { q: 'x', token: 'abc123' },
      startedAt: 100,
      endedAt: 350,
    },
  ]);
  await respond($ as never, world, []);
  expect((await complete($ as never, 'the answer')).text).toBe('the answer'); // no receipt
  expect(lines(world, `${DIR}/turn-1.jsonl`)).toEqual([
    {
      type: 'apiTool',
      id: 'sv1',
      name: 'advisor',
      agentId: null,
      args: { q: 'x', token: '[redacted]' },
      ms: 250,
    },
  ]);
  expect(world.toasts).toEqual([]);
});

test('R49: a subagent’s cut-short server tool use joins the main turn with no ms', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  world.serverToolUses.push([{ id: 'sv1', name: 'advisor', input: {}, startedAt: 100 }]);
  await respond($ as never, world, [], 'agent-1');
  await complete($ as never);
  expect(lines(world, `${DIR}/turn-1.jsonl`)).toEqual([
    { type: 'apiTool', id: 'sv1', name: 'advisor', agentId: 'agent-1', args: {}, ms: null },
  ]);
});

test('R49: a server tool use listed again after a pause is logged once', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  world.serverToolUses.push(
    [{ id: 'sv1', name: 'advisor', input: {}, startedAt: 100 }],
    [{ id: 'sv1', name: 'advisor', input: {}, startedAt: 100, endedAt: 180 }],
  );
  await respond($ as never, world, []);
  await respond($ as never, world, []);
  await complete($ as never);
  expect(lines(world, `${DIR}/turn-1.jsonl`)).toEqual([
    { type: 'apiTool', id: 'sv1', name: 'advisor', agentId: null, args: {}, ms: 80 },
  ]);
});
```

If `'token'` is not redacted in the third test, re-read the R14 args test at
lines 384-391 and match the field name it uses; do not weaken the assertion.

**Verify**: `npm run validate` → exit 0, with the five new tests listed as
passing.

### Step 6: Document it in the README

In `plugins/telltale/README.md`:

1. "`call` record" section (heading at line 87, table from line 91): add
   two rows after `agentId`:
   - `model` | string or null | the model that answered the response that
     issued the call (the one the request named when no usage was reported);
     null when no model response streamed the call
   - `effort` | string, number or null | the thinking effort that response's
     request asked for; null for a model without effort

   The new type text is wider than the column, so the table will be
   re-aligned by `prettier --write` in step 7; do not pad it by hand.

2. After the "`skill` record" section, add an "`apiTool` record" section:

   ````markdown
   ### `apiTool` record

   ```json
   { "type": "apiTool", "id": "sv1", "name": "advisor", "agentId": null, "args": {}, "ms": 250 }
   ```

   A tool the API ran itself inside a model response (the advisor is one). Claude Code runs no tool hooks for it, so it never counts in the receipt, the totals or the pane, and has no `chars` or `estTokens`: the API reports no result. `id` is the API's id for the use, one record per id in a turn. `args` are redacted and cut like a call's. `ms` is the time the API stamped from start to result, null when the response ended first.
   ````

3. "`context-<N>.json`" example: add `"version": "2.1.300",` after
   `"reason"`, and append to the paragraph below it: "`version` is the Claude
   Code version the session ran on, as `claude --version` prints it; absent
   when Claude Code could not report it."
4. Line 164: change "`R1` to `R48`" to "`R1` to `R49`" (or to whatever the
   highest ID is after this plan's new line; plan 008 makes the same edit
   for its own ID, so take the higher of the two).
5. Requirements index:
   - **R4** (line 169): replace "agentId, `next` and `usedInAnswer`." with
     "agentId, the model that answered the response that issued it (else the
     one requested) and the effort requested, `next` and `usedInAnswer`."
   - **R8** (line 173): after "the tool descriptions sent" insert ", and the
     Claude Code version".
   - **R49 (or the next free ID when this lands)**, a new line after R48:
     "- **R49** Each tool call the API ran itself inside a model response, on
     the main thread or in a subagent, is recorded once per id as an
     `apiTool` record in the turn it belongs to, with id, name, agentId,
     redacted and cut args, and ms (null when the response ended before its
     result); it counts in no receipt, total, status entry, toast, band or
     pane row." If plans 006, 008, 010 or 012 already took R49, use the next
     free number and update the three R49 test names, the code comment in
     step 3, line 164 and `lib.ts:2` to match.

In `plugins/telltale/hooks/lib.ts:2`, change "(R1 to R48)" to "(R1 to R49)"
(or the same highest ID used in item 4).

**Verify**: `grep -n "apiTool" plugins/telltale/README.md` → 3 hits (the
section heading, the JSON example, the R49 index line);
`grep -n "Claude Code version" plugins/telltale/README.md` → 2 hits (context
paragraph, R8); `grep -n "R48)" plugins/telltale/hooks/lib.ts` → no hit on
line 2.

### Step 7: Version, format and gate

Bump `"version"` in `plugins/telltale/.claude-plugin/plugin.json` by one
patch step from whatever it holds at execution time (it is `0.3.1` at
`f3e7fb0`).

Then run `npx prettier --write plugins/telltale`. It wraps the code lines
above that run past 100 columns (step 1's `list.push` line, step 2's `Turn`
field, step 3's `push` line, step 4's `write` line, the long test lines) and
re-aligns the README call-record table. Review its diff: it must touch only
lines this plan changed.

**Verify**: `npx prettier --check plugins/telltale` → exit 0;
`npm run check` → exit 0.

## Test plan

- Five new tests in `plugins/telltale/tests/register.test.ts` (step 5):
  - R4 model and effort: the answered model wins over the requested one,
    and a response with no usage falls back to the requested model with
    `effort: null`.
  - R8 version: the context file carries the stubbed version.
  - R49 happy path: one `apiTool` record, args redacted, `ms` computed,
    no receipt line, no toast.
  - R49 edge: a subagent's server tool use with no `endedAt` lands in the
    main turn's file with its `agentId` and `ms: null`, and a turn whose
    only record is a server tool use still writes `turn-1.jsonl`.
  - R49 dedupe: the same id reported first without and then with `endedAt`
    gives one record carrying the later `ms`.
- Structural pattern: the R4 test at `tests/register.test.ts:262` and the
  R8 test at `:343`.
- Regression guard: every existing test, especially the R8 `toEqual` at
  `:343`, the R15 600-call parts test at `:405`, and the R5 numbering test
  at `:298`.
- Verification: `npm run validate` → exit 0, including the 5 new tests.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run validate` → exit 0, and its output lists the five new test
      names as passed
- [ ] `npx prettier --check plugins/telltale` → exit 0
- [ ] `npm run check` → exit 0
- [ ] `grep -n "serverToolUses" plugins/telltale/hooks/register.tsx` → 1 hit,
      inside the `turn.step` hook
- [ ] `grep -n "session.version" plugins/telltale/hooks/register.tsx` → 1 hit,
      inside `writeLogs`
- [ ] `grep -c "turn.apiTools.length" plugins/telltale/hooks/register.tsx`
      equals `grep -c "const hasRecords" plugins/telltale/hooks/register.tsx`
- [ ] `grep -n "R49" plugins/telltale/README.md` (or the ID actually used)
      finds the new index line, and line 164 names it as the top of the range
- [ ] `git status` shows changes only in the in-scope files (which include
      `plans/README.md` and the `site:data` regen of root `README.md` and
      `site/src/data/marketplace.json`)
- [ ] `plans/README.md` has a 007 row with its status updated

## STOP conditions

Stop and report back (do not improvise) if:

- `plugins/telltale/.claude-plugin/types/claude-code/index.d.ts` is missing:
  `npm run validate` would skip the typecheck that catches a missed
  `apiTools: []`. Ask the operator to load the plugin once with
  `--plugin-dir`.
- The API types no longer match: `TurnStepResult` has no `serverToolUses`,
  `TurnStepServerToolUse` has no `id` or `startedAt`, `TurnUsage` has no
  `model`, or `$.session.version` is gone. Report the current shape instead
  of guessing.
- The `turn.step` hook, the `Response` type, or the context-file write no
  longer match the excerpts above (drift beyond the plans named in the
  drift check).
- The existing R8 test at line 343 fails after step 4: that would mean the
  kit answers an unstubbed `session.version` with a value. Do not change
  the old test's expectation; report it.
- Any existing test fails after step 2's `hasRecords` change, especially
  R34/R47 turn-numbering tests. That would mean a turn number moved in a
  case this plan did not foresee.
- The new R4 test fails on `effort: null` for the second response because
  the test kit fills in an `effort` the test did not set. Report what the
  kit supplied rather than loosening the assertion.
- The kit refuses the extra fields returned from the fake `turn.step`
  result or the `effort` spread into its event.
- The harness already has a `usages` field (plan 010 landed first, against
  its own dependency order). Keep 010's version, add only
  `serverToolUses`, and report the order in your summary.

## Maintenance notes

- Plan 010 (ctxDelta) depends on this plan. It adds token figures to the
  same `Response` entries in `turn.step` with its own `usage` block right
  after `const r = step.value;`, next to (not inside) the `safe` block from
  step 3; both read `r`, neither changes it. It reads them back through
  `callResponse`, like step 1.3. Its test-harness step (the `usages` queue)
  is already done word for word by step 5 here; 010's executor should find
  it present and skip it, not add a second queue.
- Plan 004's `session.end` `else` branch copies the buffer swap and
  `hasRecords` line; both copies must count `apiTools`. Any future third
  copy must too. A reviewer should check `grep -n "const hasRecords"`.
- Plan 008 adds a `permission` field to the same call-record object in
  `writeLogs`, a row to the same README table, and the same line-164 range
  bump; the edits are adjacent but independent, so a textual merge is all
  that is needed, keeping the higher ID on line 164.
- `e.model` is the request as telltale sees it, after hooks above it; a hook
  beneath could still change it. That is why `r.usage.model`, which comes
  from the API, wins whenever it is present.
- Per the API doc, a response that arrived whole may stamp `startedAt` and
  `endedAt` alike, so `ms: 0` on an `apiTool` record is a real value, not
  a bug.
- The `id` dedupe covers the current turn's buffer only. If paused turns
  turn out to split one use across two turn files in practice, a
  module-level set of logged ids is the upgrade; until then the shared `id`
  lets a reader join them.
- If Claude Code ever exposes server tool results, a `chars`/`estTokens`
  pair and a place in the totals become possible; until then they would be
  invented numbers, so they are deliberately absent.
- Deferred: model on `skill` records and `base`/`builtAt` from
  `SessionVersion` (see Out of scope).

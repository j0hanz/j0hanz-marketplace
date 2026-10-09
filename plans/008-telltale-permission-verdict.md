# Plan 008: Record each call's permission verdict through a pass-through tool.check hook

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report, do not improvise. When done, update the status row for this plan
> in `plans/README.md` (add the row if the index has none for 008 yet),
> unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first, from the repo root)**: `git diff --stat f3e7fb0 -- plugins/telltale/hooks/register.tsx plugins/telltale/hooks/lib.ts plugins/telltale/types/index.d.ts plugins/telltale/tests/register.test.ts plugins/telltale/tests/lib.test.ts plugins/telltale/README.md plugins/telltale/.claude-plugin/plugin.json`
> With no `..HEAD`, this compares the planned-at commit with the working
> tree, so sibling-plan edits not yet committed show up too. Several sibling
> plans edit these same files, so a non-empty diff is expected. Plans 002 and 003 touch only regex classes, list entries and
> lint fixes in `lib.ts`. Plan 006 edits `detailHeader` in `lib.ts`, the
> header call in the detail view and the R36 README line. Plan 007 adds
> `model` and `effort` to the per-call log record in `writeLogs` (after
> `agentId`) and entries to the per-response store, rewrites the middle of the
> R4 README line, and adds its own new requirement to the README index; it
> does not change `Captured`. Plan 010 edits `turn.step`
> and `callResponse`. What must still hold for this plan: the `tool.call`
> handler's `try { r = await next(e); } finally { … }` block, the
> `const call: Captured = { … }` literal, the destructure in `listCall`, and
> the detail view's `duration includes any permission prompt` line all read
> as excerpted below (extra fields added by a sibling plan are fine). If any of those
> four differ in shape, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S (one hook of about 8 lines, a field threaded through three
  places, one wording helper, five tests, README edits)
- **Risk**: LOW. The new hook sits on the permission chain, but it only
  awaits `next(e)` and returns that result object untouched; the engine also
  skips a `tool.check` hook that throws and keeps the verdict beneath it
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `f3e7fb0`, 2026-10-09

## Why this matters

Every call's `ms` in telltale is wall time "including any permission prompt"
(README `ms` row, and a fixed line in the detail view). So no duration can be
trusted on its own. A 40-second "slow MCP server" may be 39 seconds of the
person reading a permission dialog, or of the auto-mode classifier deciding.
Claude Code raises a `tool.check` event for every real tool call, and its
result says whether the call was allowed outright (`allow`), put to the
mode's decider (`ask`), or refused (`deny`), plus the settings rule that
decided (such as `Bash(git push:*)`). Telltale does not hook `tool.check`
today, so it cannot tell these cases apart.

After this plan: each call record in the logs carries `permission`
(`allow`, `ask`, `deny`, or null when unknown) and, when a settings rule
decided, `permissionRule` (redacted). The detail view replaces the blanket
caveat with a line that matches the verdict. For most tools an `allow` means
the duration has no permission dialog or classifier time in it, so a slow
allowed call really is a slow tool.

Three things this plan deliberately does **not** claim, and the README must
say so: `ask` does not mean a person waited (the auto-mode classifier or a
headless host may settle it, so the wording is "a permission decision
(dialog or classifier)"); the recorded verdict is the one reached by the
engine and the plugins beneath telltale, and a plugin loaded above telltale
may still override it; and for a tool that always needs the person (a
question put to them such as `AskUserQuestion`, or a plan to approve such as
`ExitPlanMode`), an `allow` does not dismiss the dialog (`api:12794-12795`),
so such a call's duration includes the person's time whatever its verdict.

## Current state

Files involved:

- `plugins/telltale/hooks/register.tsx`: the mod. Holds the module-level
  maps, the `Captured` type, `writeLogs`, `listCall`, the detail view and the
  `tool.call` hook.
- `plugins/telltale/hooks/lib.ts`: pure helpers, unit-tested in
  `tests/lib.test.ts`.
- `plugins/telltale/types/index.d.ts`: telltale's own types, including the
  `Call` row kept in shared plugin state.
- `plugins/telltale/tests/register.test.ts`, `plugins/telltale/tests/lib.test.ts`:
  tests, run by `claude plugin test` (through `npm run validate`).
- `plugins/telltale/README.md`: user docs plus the requirements index R1 to
  R48, which the source and tests cite.
- `plugins/telltale/.claude-plugin/types/claude-code/index.d.ts`: the Claude
  Code mod API types (gitignored, laid by Claude Code when the plugin loads;
  cited below as `api:N`). Read only.

### The engine API (verified in `api:N`)

- `api:3928-3941`, the `tool.check` event:

  ```ts
  /**
   * Fires when the engine decides whether a tool call may run, after the
   * `tool.call` and PreToolUse hooks and before the mode settles an ask.
   *
   * `next(e)` resolves to the engine's verdict (rules, mode, the tool's own
   * check, PreToolUse's decision) and runs no tool: return any `{ decision }`,
   * a deny after it too. `$.tool.check` runs the same chain, executing nothing.
   *
   * @remarks A guard that fails is skipped, leaving the verdict beneath.
   ...
   */
  'tool.check': ToolCheckInput;
  ```

  "After the `tool.call` and PreToolUse hooks" means it runs beneath the
  `tool.call` chain, inside telltale's own `await next(e)` in the `tool.call`
  hook. So by the time that `await` settles, telltale's `tool.check` hook has
  already seen the verdict.

- `api:12727-12733`: `type ToolCheckDecision = 'allow' | 'ask' | 'deny';`
  documented as "run the tool, put it to the mode's decider (the dialog, the
  auto-mode classifier, a headless host), or refuse it". This type is **not
  exported** (no `export` keyword), so write the literal union in telltale's
  own code rather than importing it.

- `api:12757-12763`, `ToolCheckInput.tool_use_id?: string`: "The call being
  decided, on a real call only; absent on a query." A `$.tool.check` query
  from any plugin carries no id (also stated at `api:2998-3001`), so a
  missing id is the whole filter for queries; no `next.origin` check is
  needed.

- `api:12780-12815`, `ToolCheckResult`: `decision`, `reason?`, `rule?`
  ("The settings rule that decided, as written (`Bash(git push:*)`). Absent
  for a mode or a tool's own check."), `hook?`, `ceiling?`. The doc at
  `api:12784-12786`: "A hook may answer any verdict in either direction; the
  last word up the chain is the decision." That is why the recorded verdict
  may not be final when a plugin above telltale hooks `tool.check`.

- `api:12794-12795`, on `decision`: "For a tool that requires the person (a
  question put to them, a plan to approve) a hook only tightens: its `allow`
  does not dismiss the dialog." The API exposes no flag that marks such a
  tool, so this plan does not special-case them in code; it documents the
  gap in Known limits and in the new requirement instead.

- The test kit (`api:15758-15759`): "The body gets the engine's `$` and an
  `on` whose hooks sit beneath every plugin". The engine `$`'s calls take the
  event's input whole (`api:14861-14865`, `EngineCall<E> = (e: Args<E>)`),
  so a test can raise `$.tool.check({ tool, input, tool_use_id })` with an id,
  and a test's own `on('tool.check', …)` acts as the engine's verdict beneath
  telltale.

### Telltale today

- `register.tsx:1-2`, the file's contract, which the new hook must honour:

  ```ts
  // telltale: an observe-only mod. Every hook hands back exactly what `next(e)` returned (R3);
  // its own work runs inside `safe`, so a fault here never changes or blocks a call.
  ```

- `register.tsx:78-90`, the captured call (what `writeLogs` and `listCall`
  read):

  ```ts
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
  ```

- `register.tsx:141`, a module-level map in the same style the new one
  should follow:

  ```ts
  const described = new Map<string, { server: string | null; chars: number; deferred: boolean }>();
  ```

- `register.tsx:172-191`, the per-call log record inside `writeLogs`
  (abridged; the fields between are unchanged):

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
          ...
          ...(fullPayloads ? { text } : {}),
        });
      }),
  ```

- `register.tsx:213-216`, `listCall` turns a `Captured` into the pane row
  `Call` by dropping the large fields; every other `Captured` field flows into
  shared plugin state through `...meta`:

  ```ts
  async function listCall($: EngineInterface, call: Captured) {
    const json = JSON.stringify(call.args);
    const { args: _args, text: _text, blocks: _blocks, ...meta } = call;
    const shown: Call = { ...meta, argsChars: json.length, textChars: call.text.length, next: null };
  ```

- `register.tsx:493` `drawDetail($, frame, list, call: Call)`, and at line
  578 the blanket caveat this plan replaces:

  ```tsx
  <Text dimColor>{clip('duration includes any permission prompt', width)}</Text>
  ```

- `register.tsx:868-923`, the `tool.call` hook (abridged):

  ```ts
  on('tool.call', async ($, e, next) => {
    const started = (await safe(() => $.clock.now())) ?? 0;
    ...
    let r: Awaited<ReturnType<typeof next>>;
    try {
      r = await next(e);
    } finally {
      if (counted) void later(() => stopRunning($, e.tool_use_id));
    }
    // R1: only calls Claude made. ...
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
  ```

  Note that built-in tools (`Read`, `Bash`) are captured and logged too; only
  the receipt, totals and band count MCP calls. So the verdict map must not
  be limited to MCP tools.

- `register.tsx:925-928`, the existing pattern for a pass-through hook that
  records something after `next`:

  ```ts
  on('skill.prompt', async ($, e, next) => {
    const r = await next(e);
    await safe(() => buffer.skills.push({ skill: e.skill, chars: r.text.length }));
  ```

- `types/index.d.ts`, the pane row type (lines 4-16):

  ```ts
  export type Call = {
    id: string; // tool_use_id
    tool: string;
    ...
    next: NextAction | null; // null until the turn ends
    turn: number; // R34: the number of the turn file the call's record goes to
  };
  ```

  Rows saved before this plan lands (restored after a hot reload, R47) have
  no `permission` field, so the new field must be optional.

- `hooks/lib.ts:435-453`, `detailHeader`, an example of a small exported
  string helper with an R-ID doc comment; follow its style for the new
  helper. (Plan 006 edits this function; do not touch it.)

- `README.md`: line 9 promises "It only observes: it never changes, delays
  or blocks a tool call". Line 97 is the `ms` row of the `call` record
  table, whose meaning cell reads `wall time including any permission prompt`.
  Line 133 is `### Known limits` and line 135 its one paragraph. Line 164 says the index runs `R1` to
  `R48`. Line 169 is R4 (fields recorded per call), line 176 is R11 (what
  the detail shows), line 213 is R48, the last entry.

- Existing tests this plan touches or patterns after, in
  `tests/register.test.ts`:
  - `callThrough` (line 645): one call through the plugin, after its model
    response streamed it.
  - `endTurn` (line 1284): an empty response plus `turn.complete`, then
    `world.clock.settle()`.
  - `lines` (line 198) and `DIR` (line 33): read a turn file's records.
  - `linesOf` (line 1517) and `openDetail` (line 1676): draw the detail view
    of one call and split it into lines.
  - The R11 test at line 692 asserts at line 702
    `expect(detail.text).toContain('duration includes any permission prompt');`.
    It raises no `tool.check`, so after this plan it is the "verdict
    unknown" case and must keep passing unchanged.
  - The R14 test that starts at line 393 shows, at line 395, how this repo
    writes a fake secret in a test without a literal key:
    `const key = 'AKIA' + 'Q7ZX2P9LMN4RTV8W';`.
  - `stateOf` (line 160): registers a `state.set` hook beneath the plugin and
    returns a map of the last value telltale wrote to each state key. The R25
    test at line 803 uses it to prove text stays out of `calls`.
  - The R3 test at line 214 shows that a test may add its own `on(...)`
    hooks after `worldOf(on)`; `worldOf` registers no `tool.check` hook, so a
    test's `on('tool.check', …)` is the only one beneath the plugin.

## Commands you will need

Run every command from the repo root (`C:/j0hanz-marketplace`). From another
directory, `npx tsc -p` fails with "This is not the tsc command you are
looking for".

| Purpose           | Command                               | Expected on success                                         |
| ----------------- | ------------------------------------- | ----------------------------------------------------------- |
| Plugin tests only | `claude plugin test plugins/telltale` | exit 0, every test passes                                   |
| Plugin typecheck  | `npx tsc -p plugins/telltale`         | exit 0, no output (verified at `f3e7fb0`)                   |
| Validate + tests  | `npm run validate`                    | exit 0; runs `claude plugin test` and `tsc -p` for telltale |
| Full gate         | `npm run check`                       | exit 0                                                      |

Notes on the gate, so you read its result correctly:

- Until plan 002 lands, `npm run lint` does not lint `plugins/**` at all
  (`eslint.config.js` ignores it), so a green lint says nothing about this
  change. If plan 002 has landed, also run `npx eslint plugins/telltale` and
  expect 0 problems.
- `npm run validate` typechecks telltale only when
  `plugins/telltale/.claude-plugin/types/` exists; otherwise it prints
  `⚠ plugins/telltale: no generated types; load it once with --plugin-dir to typecheck`
  and skips `tsc` (plan 002 turns that into a failure). If you see that
  warning, start Claude Code once with `--plugin-dir plugins/telltale` and
  rerun, so the typecheck really ran.
- `npm run check` chains `site:data`, which rewrites the generated regions of
  the root `README.md` and `site/src/data/marketplace.json`. Commit whatever
  it regenerates; that is expected, not a stray change.

## Scope

**In scope** (the only files you should modify):

- `plugins/telltale/hooks/register.tsx`: a new module-level `verdicts` map,
  a new `tool.check` hook, two optional fields on `Captured`, the `finally`
  block and `Captured` literal in the `tool.call` hook, one destructure in
  `listCall`, two fields in the `writeLogs` call record, and the one caveat
  line in `drawDetail`
- `plugins/telltale/hooks/lib.ts`: one new exported helper, `permissionNote`
- `plugins/telltale/types/index.d.ts`: one optional field on `Call`
- `plugins/telltale/tests/register.test.ts`: new tests appended at the end
- `plugins/telltale/tests/lib.test.ts`: one import and one new test
- `plugins/telltale/README.md`: the `call` record table, Known limits, the
  index header, R4, R11, and the new requirement
- `plugins/telltale/.claude-plugin/plugin.json`: the version
- `plans/README.md`: only this plan's status row (add a row for 008 if the
  index has none yet), and one item for the live check under "Direction"
  (see Maintenance notes). Touch no other row or section.

**Out of scope** (do NOT touch, even though they look related):

- The live band (R29) and the transcript cost line (R44): an earlier draft
  of this idea put a `?` mark on asked calls there. Skip it: the band's clock
  already includes the decision wait, and the mark is noise.
- `detailHeader` in `lib.ts` and the header line of the detail view: plan
  006 edits them. The permission note stays its own dim line.
- Totals, the receipt, toasts: a verdict changes no count.
- Any `next.origin` filter in the new hook: a missing `tool_use_id` already
  excludes queries, and an origin filter would wrongly drop calls inside a
  subagent that another plugin spawned, which R1/R2 still count.
- Answering anything other than `r` from the `tool.check` hook, ever. This
  is the R3 / observe-only promise.
- Storing `reason`, `hook` or `ceiling` from the result: the rule is the
  useful log context; the rest is not needed.

## Git workflow

- Branch: `telltale/plan-008-permission-verdict`
- Conventional subject, matching `git log` (for example
  `fix(telltale): redact secret fields in any spelling`,
  `feat(telltale): add status line, live band and table views`). For this
  plan: `feat(telltale): record each call's permission verdict`
- One commit is fine; two (code plus tests, then README and version) is
  also fine
- Do NOT push or open a PR unless the operator instructed it

## Steps

### Step 1: Add the wording helper to `lib.ts`, with its unit test

In `plugins/telltale/hooks/lib.ts`, directly after `detailHeader` (which ends
at line 453 at `f3e7fb0`; find it by name if plan 006 moved it), add:

```ts
/** R49: the detail's line on what a call's duration includes, by its permission verdict. */
export const permissionNote = (decision?: 'allow' | 'ask' | 'deny'): string => {
  if (decision === undefined) return 'duration includes any permission prompt';
  return decision === 'ask'
    ? 'duration includes a permission decision (dialog or classifier)'
    : 'no permission dialog or classifier in this time';
};
```

Why `deny` reads like `allow`: a `deny` from beneath refuses the call at
once, with no dialog and no classifier. Only `ask` hands the call to the
mode's decider, which is where waiting happens.

In `plugins/telltale/tests/lib.test.ts`, add `permissionNote` to the import
list from `'../hooks/lib'` (lines 2-34), and add this test after the R36
`detailHeader` test (around line 492):

```ts
test('R49: the permission note follows the verdict, and keeps the old caveat when unknown', async () => {
  expect(permissionNote()).toBe('duration includes any permission prompt');
  expect(permissionNote('ask')).toBe(
    'duration includes a permission decision (dialog or classifier)',
  );
  expect(permissionNote('allow')).toBe('no permission dialog or classifier in this time');
  expect(permissionNote('deny')).toBe('no permission dialog or classifier in this time');
});
```

**Verify**: `claude plugin test plugins/telltale` → exit 0, including the new
R49 lib test; `npx tsc -p plugins/telltale` → exit 0.

### Step 2: Add the field to the types

In `plugins/telltale/types/index.d.ts`, add to `Call`, after `turn`:

```ts
  permission?: 'allow' | 'ask' | 'deny'; // R49: the tool.check verdict beneath telltale; absent when unknown
```

In `plugins/telltale/hooks/register.tsx`, add to `Captured` (lines 78-90),
after `turn`:

```ts
  permission?: 'allow' | 'ask' | 'deny'; // R49
  rule?: string; // R49: the settings rule that decided, raw; logged redacted, never put in state
```

In `listCall` (line 215), drop `rule` from the row, so the raw rule never
lands in shared plugin state (every plugin can read `$.state`; see the
comment at lines 142-143):

```ts
const { args: _args, text: _text, blocks: _blocks, rule: _rule, ...meta } = call;
```

`permission` flows into the `Call` row through `...meta`, which is what the
detail view reads, and survives a hot reload with the row (R47).

**Verify**: `npx tsc -p plugins/telltale` → exit 0;
`claude plugin test plugins/telltale` → exit 0 (no behaviour changed yet).

### Step 3: Add the verdict map and the pass-through `tool.check` hook

In `register.tsx`, next to `described` (line 141), add:

```ts
// R49: each real call's permission verdict from the tool.check tiers beneath telltale, by id.
// The call's own tool.call hook takes the entry out once its `next` settles, so none outlive it.
const verdicts = new Map<string, { decision: 'allow' | 'ask' | 'deny'; rule?: string }>();
```

Register the hook directly before `on('tool.call', …)` (line 868):

```ts
// R49: observe the verdict only; R3: the result goes back exactly as `next` returned it.
// A query (`$.tool.check`) carries no tool_use_id and records nothing.
on('tool.check', async ($, e, next) => {
  const r = await next(e);
  const id = e.tool_use_id;
  if (id) await safe(() => verdicts.set(id, { decision: r.decision, rule: r.rule }));
  return r;
});
```

Do not add an `{ tool: … }` matcher: every tool, built-in or MCP, is
captured and logged.

**Verify**: `npx tsc -p plugins/telltale` → exit 0;
`claude plugin test plugins/telltale` → exit 0, and the R11 test at
`tests/register.test.ts:692` still passes unchanged.

### Step 4: Take the verdict in `tool.call` and put it on the call

In the `tool.call` hook, change the `try`/`finally` around `next` (lines
883-888) so the entry is taken out whether the call returns or throws:

```ts
let r: Awaited<ReturnType<typeof next>>;
let verdict: { decision: 'allow' | 'ask' | 'deny'; rule?: string } | undefined;
try {
  r = await next(e);
} finally {
  // R49: the tool.check beneath ran inside this `next`; get-and-delete, captured or not.
  verdict = verdicts.get(e.tool_use_id);
  verdicts.delete(e.tool_use_id);
  if (counted) void later(() => stopRunning($, e.tool_use_id));
}
```

Taking the entry before the R1 early return (`if (next.origin.plugin !==
'engine' && …) return r;`) matters: a call another plugin made still gets a
`tool.check`, and its entry must not stay in the map.

Then, in the `const call: Captured = { … }` literal, after
`turn: turnNo + 1,`, add:

```ts
        permission: verdict?.decision,
        rule: verdict?.rule,
```

**Verify**: `npx tsc -p plugins/telltale` → exit 0;
`claude plugin test plugins/telltale` → exit 0.

### Step 5: Log the verdict and show it in the detail

In `writeLogs`, in the call record, directly after `ms: call.ms,` (line
181), add:

```ts
        permission: call.permission ?? null, // R49: null when no verdict was seen
        ...(call.rule ? { permissionRule: redact(call.rule) } : {}),
```

`redact` is already imported. A settings rule is written by the user and can
hold a command line with a token in it, so it goes through the same
redaction as args.

In `drawDetail`, replace line 578:

```tsx
<Text dimColor>{clip(permissionNote(call.permission), width)}</Text>
```

and add `permissionNote` to the import list from `'./lib'` at the top of the
file (lines 15-46, alphabetical position after `pct`).

**Verify**: `npx tsc -p plugins/telltale` → exit 0;
`claude plugin test plugins/telltale` → exit 0. The R4 tests use
`toMatchObject`, so the extra `permission: null` field does not break them;
the R11 test at line 692 still finds `duration includes any permission prompt`.

### Step 6: Add the end-to-end tests

Append to the end of `plugins/telltale/tests/register.test.ts`:

```ts
// R49: the permission verdict from the tool.check tiers beneath telltale.

/** Raises the verdict a session's tool.check would give call `id`, as the engine does. */
const checkCall = ($: never, id: string, tool = 'mcp__o__s') =>
  ($ as { tool: { check: (e: unknown) => Promise<unknown> } }).tool.check({
    tool,
    input: {},
    tool_use_id: id,
  });

test('R3, R49: a tool.check verdict passes through unchanged', async ($, on) => {
  worldOf(on);
  on('tool.check', () => ({ decision: 'ask', reason: 'a rule asks', rule: 'mcp__o__s' }));
  await $.session.start(SESSION);
  expect(await checkCall($ as never, 'u1')).toEqual({
    decision: 'ask',
    reason: 'a rule asks',
    rule: 'mcp__o__s',
  });
  // A query: no tool_use_id.
  expect(await $.tool.check({ tool: 'mcp__o__s', input: {} })).toEqual({
    decision: 'ask',
    reason: 'a rule asks',
    rule: 'mcp__o__s',
  });
});

test('R49: an asked call logs its verdict and redacted rule, and the detail says so', async ($, on) => {
  const world = worldOf(on);
  const state = stateOf(on);
  const key = 'AKIA' + 'Q7ZX2P9LMN4RTV8W';
  on('tool.check', () => ({ decision: 'ask', rule: `Bash(echo ${key}:*)` }));
  await $.session.start(SESSION);
  await checkCall($ as never, 'a');
  await callThrough($ as never, world, 'a');
  await endTurn($ as never, world);
  const [record] = lines(world, `${DIR}/turn-1.jsonl`);
  expect(record).toMatchObject({ permission: 'ask', permissionRule: 'Bash(echo [redacted]:*)' });
  expect(JSON.stringify(record)).not.toContain(key);
  // The row reaches shared state with its verdict, and the raw rule never does.
  expect(JSON.stringify(state.get('calls'))).toContain('"permission":"ask"');
  expect(JSON.stringify(state.get('calls'))).not.toContain(key);
  expect(linesOf(await openDetail($ as never, 'a'))).toContain(
    'duration includes a permission decision (dialog or classifier)',
  );
});

test('R49: an allowed call says its duration has no permission wait', async ($, on) => {
  const world = worldOf(on);
  on('tool.check', () => ({ decision: 'allow' }));
  await $.session.start(SESSION);
  await checkCall($ as never, 'a');
  await callThrough($ as never, world, 'a');
  await endTurn($ as never, world);
  const [record] = lines(world, `${DIR}/turn-1.jsonl`);
  expect(record!.permission).toBe('allow');
  expect(Object.keys(record!)).not.toContain('permissionRule');
  expect(linesOf(await openDetail($ as never, 'a'))).toContain(
    'no permission dialog or classifier in this time',
  );
});

test('R49: a call with no verdict logs permission null', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callThrough($ as never, world, 'a');
  await endTurn($ as never, world);
  expect(lines(world, `${DIR}/turn-1.jsonl`)[0]!.permission).toBeNull();
});
```

Why the tests raise `checkCall` before `callThrough` rather than from inside
the call: in a real session `tool.check` fires inside telltale's
`await next(e)`, but the map is keyed by id and the entry is taken in the
`finally` after `next`, so either order exercises the same code. If the test
kit also raises `tool.check` on its own during `$.tool.call`, the test's own
`on('tool.check')` answers it with the same verdict, so the result is the
same.

`openDetail` draws at 80 columns and `clip` cuts each line to the width; the
longest new line is 62 characters, so no line is cut.

**Verify**: `claude plugin test plugins/telltale` → exit 0, with the four new
R49/R3 tests passing.

### Step 7: Update the README

In `plugins/telltale/README.md`:

1. `call` record table, the `ms` row (line 97): change the meaning cell to
   exactly this text, where only the last word is in backticks:
   wall time, including any permission decision; see `permission`
2. Add two rows directly after `ms` (keep the table aligned; prettier will
   check it in `npm run check`, so run `npx prettier --write plugins/telltale/README.md`
   if `format:check` complains):
   - `permission` | string or null | `allow` (no permission dialog or
     classifier, see Known limits), `ask` (put to the dialog or the auto-mode classifier, inside
     `ms`) or `deny`; the verdict of the rules and the hooks beneath telltale;
     null when none was seen
   - `permissionRule` | string | the settings rule that decided, as written,
     redacted; only when a rule decided
3. Known limits (a new paragraph after the one at line 135), add:
   "`permission` is the verdict the engine's rules and the plugins beneath
   telltale reached. A plugin loaded above telltale may still change it, and
   the log does not show that. For a tool that always needs the person (a
   question put to them, or a plan to approve), an `allow` does not dismiss
   the dialog, so that call's duration includes the person's time even when
   the detail says no permission dialog was in it. A call whose verdict was
   never seen (a row saved by an older telltale, or a call still running when
   the mod reloaded) shows the old caveat in the detail."
4. Line 164: change "`R1` to `R48`" to "`R1` to `R49`" (or the new highest
   ID).
5. R4 (line 169): insert ", and the permission verdict and rule (R49)"
   before the line's final period, whatever precedes it now (plans 007 and
   010 also edit this line; keep their words).
6. R11 (line 176): in "size, error flag, next action and used-in-answer",
   add "the permission note (R49)" to that list.
7. Add after R48 (line 213), as **R49 (or the next free ID when this lands;
   plans 007 and 010 also claim new IDs, so take the lowest one still free)**:

   "- **R49** Each call records the `tool.check` verdict the tiers beneath
   telltale reached (`allow`, `ask` or `deny`, null when none was seen) and
   the settings rule that decided, redacted; the detail reads
   `duration includes a permission decision (dialog or classifier)` for
   `ask`, `no permission dialog or classifier in this time` for `allow` or
   `deny`, and `duration includes any permission prompt` when the verdict is
   unknown; for a tool that always needs the person, an `allow` does not
   dismiss its dialog, so its duration still includes the person's time;
   telltale's `tool.check` hook returns exactly what `next(e)`
   returned."

   If you take a different ID, replace `R49` everywhere this plan wrote it
   (the comments in `register.tsx`, `lib.ts` and `types/index.d.ts`, and the
   test names) so the IDs match.

**Verify**: `grep -n "<ID>" plugins/telltale/README.md`, with `<ID>` the
requirement ID this plan actually used (R49, or a later free ID) → the index header, R4,
R11 and the new entry, each line carrying this plan's text (another plan's
lines with the same ID do not count); `grep -n "permissionRule" plugins/telltale/README.md`
→ one table row.

### Step 8: Version and gate

Bump `"version"` in `plugins/telltale/.claude-plugin/plugin.json` by one
patch step from whatever it holds at execution time (it is `0.3.1` at
`f3e7fb0`; sibling plans may have bumped it).

**Verify**: `npm run check` → exit 0. Then `git status` shows only the
in-scope files plus the `site:data` regeneration.

## Test plan

- `tests/lib.test.ts`: one test for `permissionNote` covering undefined,
  `ask`, `allow` and `deny` (step 1). Pattern: the R36 `detailHeader` test
  at line 492.
- `tests/register.test.ts` (step 6):
  - R3: the verdict passes through unchanged, for a real call (with an id)
    and a query (without one).
  - R49 `ask`: log fields, rule redaction, and the detail line.
  - R49 `allow`: log field, no `permissionRule` key, and the detail line.
  - R49 no verdict: `permission: null` in the log. The existing R11 test at
    line 692 already covers the detail line for this case.
  - The `ask` test also checks, through `stateOf`, that the row in shared
    state carries `permission` and never the raw rule.
  - Not covered end to end, by choice: a `deny` verdict (the unit test of
    `permissionNote` covers its wording, and it takes the same path as
    `allow`); the early `return r` for a call another plugin made; and the
    map cleanup when `next` throws. The last two leave nothing a test can
    observe, since the map is private; reviewers check them by reading the
    `finally` block.
- Structural pattern: the R14 test at lines 393-395 (fake secret, `lines`,
  `JSON.stringify(record)).not.toContain(key)`) and the R36 tests at
  lines 1683-1705 (`openDetail`, `linesOf`).
- Verification: `claude plugin test plugins/telltale` → exit 0, with five
  new tests passing; `npm run check` → exit 0.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run check` exits 0
- [ ] `claude plugin test plugins/telltale` exits 0, and the output lists the
      new `R49` tests and the `R3, R49` test as passed
- [ ] `grep -n "on('tool.check'" plugins/telltale/hooks/register.tsx` → exactly one match
- [ ] `grep -n "verdicts.delete(e.tool_use_id)" plugins/telltale/hooks/register.tsx` → one match, inside the `finally` block of the `tool.call` hook
- [ ] `grep -n "duration includes any permission prompt" plugins/telltale/hooks/register.tsx` → no match (the string now lives only in `lib.ts`)
- [ ] `grep -n "rule: _rule" plugins/telltale/hooks/register.tsx` → one match in `listCall`
- [ ] `grep -n "<ID>" plugins/telltale/README.md`, with `<ID>` the ID this plan actually used → at least four matches that carry this plan's text (index header, R4, R11, the new entry)
- [ ] `git status` shows only in-scope files, plus the root `README.md` and
      `site/src/data/marketplace.json` if `site:data` rewrote them
- [ ] `plans/README.md` has a row for 008 with its status updated, and the
      live-check item under "Direction"

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows the `tool.call` `try`/`finally`, the `Captured`
  literal, the `listCall` destructure or the detail caveat line no longer
  match the excerpts in shape (added fields from plan 007 are fine).
- After step 3 or step 5, the existing R11 test at line 692 fails because
  the detail no longer says `duration includes any permission prompt`. That
  means the test kit raises `tool.check` by itself with a default verdict
  during `$.tool.call`, so the "unknown" case cannot occur in tests the way
  this plan assumes. Report what verdict it raised; do not edit the R11
  assertion to make it pass.
- In the step 6 tests, the plugin's `tool.check` hook sees no
  `tool_use_id` for `checkCall` (the `ask` test logs `permission: null`).
  That means the kit strips the id from engine calls; report it rather than
  inventing another way to raise the event.
- The R3 pass-through test fails because the result carries extra fields
  (for example `hook` or `ceiling`) that the test hook did not return. Report
  the exact result object; do not loosen the assertion to `toMatchObject`
  without saying so.
- Any existing test fails, especially the R3 tests (lines 208-260): the
  new hook must change nothing that reaches Claude.
- The change appears to need edits to the band, the transcript line, the
  detail header, or any file outside the Scope list.

## Maintenance notes

- Overlaps with sibling plans: plan 006 edits `detailHeader` and the header
  line of the same detail view (a different line than the caveat this plan
  replaces); plan 007 adds `model` and `effort` to the same `writeLogs` call
  record (after `agentId`, not near `ms`), rewrites the middle of R4, and adds
  its own new requirement, so whichever lands second takes the next free R-ID
  and renumbers its references; plan 010 edits `turn.step` and
  `callResponse`, not touched here, and inserts text into R4. Plans 002 and 003 do not
  touch any line this plan edits. Expect simple textual merges, not logic
  conflicts.
- Memory: an entry is added only for a real call and is removed in the same
  call's `finally`. The one way an entry could stay is a `tool.check` for a
  call whose `tool.call` hook never ran in telltale (a plugin above telltale
  answering `tool.call` without calling `next` never reaches `tool.check`
  either, so none is known). At about 50 bytes each, that is the same
  accepted ceiling as `callResponse`.
- What `ask` means depends on the session's mode: in the default mode a
  person saw a dialog; in auto mode the classifier settled it; in a
  headless host it may be refused. The wording "a permission decision
  (dialog or classifier)" is deliberate; do not change it to "waited on a
  prompt".
- The recorded verdict is from beneath telltale. If a reviewer wants the
  final verdict, that needs telltale's hook to sit above every other
  plugin, which the mod API does not let a plugin choose; leave it as
  documented.
- The executor adds one item to the pending live-check session
  (`plans/README.md`, "Direction", appended to its first bullet): in a real session, make an MCP call that needs approval and
  one that a rule allows, and confirm the logs read `ask` and `allow`. This
  confirms that `tool.check` really fires inside the `tool.call` chain, as
  `api:3929-3930` says.
- What a reviewer should scrutinize: that the `tool.check` hook returns `r`
  itself (not a copy or a spread), that the raw `rule` never reaches
  `$.state` (the `rule: _rule` destructure; the `ask` test fails if it is
  dropped), and that `permissionRule` is
  redacted.
- Deferred: the `?` marks on the band and transcript line (noise, see
  Scope), and storing `reason` (the dialog text, which can be long and is not
  needed to read a duration).

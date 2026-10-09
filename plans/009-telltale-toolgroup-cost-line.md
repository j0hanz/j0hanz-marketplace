# Plan 009: Show a cost line under folded ToolGroup rows

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report, do not improvise. When done, update the status row for this plan
> in `plans/README.md` (add a row for 009 if the table has none yet),
> unless a reviewer dispatched you and told you they maintain the index.
>
> **Where to run commands**: run every command in this plan from the repo
> root, `C:/j0hanz-marketplace`, in Git Bash. The `grep` patterns use GNU
> `\|` alternation, which PowerShell's `Select-String` does not understand.
>
> **Drift check (run first)**: `git diff --stat f3e7fb0 -- plugins/telltale/hooks/register.tsx plugins/telltale/tests/register.test.ts plugins/telltale/README.md plugins/telltale/.claude-plugin/plugin.json`
> (no `..HEAD`, so the diff is against the working tree and also shows a
> sibling plan that was applied but not yet committed).
> Several sibling plans edit these same files, so a non-empty diff is
> expected. What must still hold: the `ToolUse` render hook (excerpt below)
> is unchanged, the R44 test block and its `toolRow` helper are unchanged,
> and the README R44 line reads as quoted below. Plans 002 and 003 touch only
> regex classes and list entries in `lib.ts` plus lint fixes; plans 006, 007,
> 008, 010, 011 and 013 edit other handlers (`turn.step`, `tool.call`,
> `turn.complete`, the detail view, `maybeToast`); plan 012 edits the
> `command.run` handler that sits directly below this plan's insertion point.
> If the `ToolUse` hook, the R44 tests or the R44 README line differ from the
> excerpts, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S (one render hook of about 30 lines, three tests, two README
  lines)
- **Risk**: LOW, the hook only wraps the engine's drawing and falls back to
  it on any fault; no call, log or pane state changes
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `f3e7fb0`, 2026-10-09

## Why this matters

In the default terminal view, Claude Code folds a run of tool calls into
one `ToolGroup` count line ("Read 3 files, ran 2 shell commands", and for
MCP servers a "called github N times" style label). Telltale's per-call cost
line (R44) hangs off the `ToolUse` row, and a folded call has no `ToolUse`
row, so it gets nothing. The turns with the most MCP traffic fold the most,
which means they are exactly the turns where the transcript shows the least
cost. The README admits the gap: R44 says "folded ... calls get none".

After this plan, a folded group that is no longer active gets one dim line
under its count line summing the completed MCP calls the pane keeps, for
example `3 MCP calls · ~1.1k tok · 1 error`. Nothing is unfolded and the
engine's own line is drawn unchanged. An expanded group is left alone,
because its calls are then `ToolUse` rows and the existing hook already
draws their lines.

## Current state

- `plugins/telltale/hooks/register.tsx` (1,247 lines), the mod's main
  module. The existing transcript hook this plan mirrors, lines 1126–1150:

  ```tsx
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
  ```

  `grep -n ToolGroup plugins/telltale/hooks/` finds nothing today.

- Helpers already imported at the top of `register.tsx` (lines 15–45, from
  `./lib`): `mcpServer`, `estTokens`, `formatTokens`, `plural`. The `calls`
  atom is declared at line 55 and holds the newest 200 counted calls
  (`KEEP = 200`, line 48, R25). Their definitions in `hooks/lib.ts`:

  ```ts
  export const mcpServer = (tool: string): string | null => { … };      // line 7, null for built-ins
  export const estTokens = (chars: number): number => Math.ceil(chars / 4);  // line 14
  export const formatTokens = (t: number): string =>                     // line 17
    t < 1000 ? String(t) : `${(Math.round(t / 100) / 10).toFixed(1)}k`;
  export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`; // line 20
  ```

  The `Call` record (`plugins/telltale/types/index.d.ts`, from line 4) has
  `id`, `ms`, `textChars` and `isError`, among others. No type change is
  needed.

- The engine's `ToolGroup` render site, from the Claude Code mod API types
  at `plugins/telltale/.claude-plugin/types/claude-code/index.d.ts`
  (generated, gitignored; laid by loading the plugin once). `'ToolGroup'` is
  in `RenderComponent` (line 9303). Its doc comment and props (lines
  9920–9958), condensed here: the per-prop doc comments are shortened to
  trailing comments.

  ```ts
  /**
   * A run of tool calls the transcript folds into one count line (`Read 3
   * files, ran 2 shell commands`): reads, searches, listings.
   *
   * A hook that sets `isExpanded` unfolds the group where it is, and each row
   * it unfolds into is a `ToolUse` drawing a `ToolUse` hook then sees.
   *
   * @remarks In fullscreen mode the ctrl+o transcript does not fold runs: each
   *   call there is a `ToolUse` row and no `ToolGroup` is drawn.
   *
   * Raised on every surface.
   */
  ToolGroup: {
      calls: ReadonlyArray<ToolGroupCall>;  // in the order the model made them
      isActive: boolean;    // a call may still run and the model's next call may join it
      isExpanded: boolean;  // each call draws as its own ToolUse row
      onScreen?: OnScreen | null;
  };
  ```

  "Raised on every surface" means the new line also draws on the desktop
  surface, not only in the terminal. That matches the existing `ToolUse`
  hook, which does not filter by surface either, so it is intended.

  `ToolGroupCall` (lines 12901–12934): `tool_use_id?: string` ("The id
  `tool.call` carried for this call ... Absent on a desktop host that
  predates it"), `tool`, `input`, `isRunning`, `isErrored`,
  `isInterrupted`, `output?`. There is no width prop (unlike `AbovePrompt`'s
  `bodyColumns`), so the line is not clipped, exactly like the `ToolUse`
  line.

- Do MCP calls actually fold? The doc comment above names only "reads,
  searches, listings", and the v0.3 spec left it as an open question
  (`docs/plan/2026-10-08-telltale-ui/telltale-ui.delta.md:350`: "Do MCP
  calls fold into tool groups at all?"). The installed Claude Code 2.1.295
  binary settles it: its collapse classifier contains
  `if(y?.isMcp&&!S)return{isCollapsible:!0,…,mcpCallLabel:y.mcpInfo?.serverName}`,
  where `S` is true only for "minted" servers. So MCP calls fold, except
  minted servers. (Checked during planning with
  `grep -a -o ".\{300\}mcpCallLabel.\{300\}" "$(which claude)"`; you do not
  need to rerun it.)

- `plugins/telltale/README.md`:
  - Line 43, the "Transcript." bullet: "Each completed MCP call's row gets
    one dim line beneath its tool line: `812ms · ~1.9k tok`, plus
    `· error` when it failed."
  - Line 209, **R44**: "In an interactive session a completed counted call
    the pane keeps gets one dim line beneath its transcript tool line,
    `<dur> · ~<t> tok` (` · error` when it failed); the engine's row is
    drawn unchanged; running, built-in, folded and evicted calls get none."
  - Line 211, **R46**: a failing drawing "leaves the band and transcript
    rows as Claude Code draws them". It already covers the new hook through
    the `.catch`; no wording change.
  - R48 covers only pane and band rows; it does not apply here.

- Tests, `plugins/telltale/tests/register.test.ts`, the block headed
  `// v0.3: the transcript line, the docked pane and drawing faults (R44, R45, R46).`
  (line 1955). The helper and the first test to pattern after:

  ```ts
  const ENGINE_ROW = { type: 'Text', children: [''] };
  const toolRow = async ($: never, id: string, tool: string, isRunning = false) =>
    ($ as { ui: { render: (e: unknown) => Promise<unknown> } }).ui.render({
      component: 'ToolUse',
      surface: 'terminal',
      requestId: id,
      viewport: { columns: 100, rows: 40, isFullscreen: true },
      props: {
        tool_use_id: id,
        tool,
        input: {},
        isRunning,
        isErrored: false,
        isInterrupted: false,
      },
    });

  test('R44: a completed MCP call gets its cost line beneath the engine row', async ($, on) => {
    const world = worldOf(on);
    await $.session.start(SESSION);
    await callBatch($ as never, world, [
      { id: 'u1', tool: 'mcp__github__search_issues', text: 'x'.repeat(7600), ms: 812 },
    ]);
    const tree = (await toolRow($ as never, 'u1', 'mcp__github__search_issues')) as Element;
    expect(tree.type).toBe('Box');
    expect(tree.props?.flexDirection).toBe('column');
    expect(tree.children?.[0]).toEqual(ENGINE_ROW);
    const line = tree.children?.[1] as Element;
    expect(line.props?.dimColor).toBe(true);
    expect(stringsOf(line).join('').trim()).toBe('812ms · ~1.9k tok');
  });
  ```

  Also in that block: the R44 negative test at line 1990 (running,
  built-in and unknown calls return `ENGINE_ROW`) and the R46 fault test at
  line 2015. That R46 test is meant to make `estTokens` throw by having a
  `state.set` hook rewrite `textChars` to the bigint `10n`, but in practice
  the rewrite leaves `calls` empty, so the hook finds no call and returns
  `ENGINE_ROW` without ever reaching its `catch`. A planning review proved
  it: with the `ToolUse` hook's `catch` changed to set a non-null line, that
  test still passes. Do not copy its `state.set` trick, and do not fix that
  test here (out of scope); mention it in your report. `worldOf`
  (line 42) registers `on('ui.render', () => ({ type: 'Text', children: [''] }))`
  as the stand-in engine drawing, which is what `next(e)` returns.
  `callOne` (line 1268) drives one call, with an `isError` flag;
  `callBatch` (line 1524) drives several from one response. `Element` and
  `stringsOf` are at lines 608–609.

## Commands you will need

| Purpose        | Command                                                           | Expected on success                                                                                |
| -------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Plugin tests   | `claude plugin test plugins/telltale`                             | exit 0, all tests pass (faster loop than validate)                                                 |
| Validate + tsc | `npm run validate`                                                | exit 0; runs `claude plugin test` and `tsc -p plugins/telltale`                                    |
| Types present  | `ls plugins/telltale/.claude-plugin/types/claude-code/index.d.ts` | the file is listed; without it validate prints `⚠ … no generated types` and skips `tsc`            |
| Lint plugin    | `npx eslint plugins/telltale`                                     | 0 problems, but only once plan 002 has landed; before that `eslint.config.js` ignores `plugins/**` |
| Full gate      | `npm run check`                                                   | exit 0, or failing only on the `plans/*.md` files Step 0 recorded                                  |

At the planned-at state, `npm run check` already fails before this plan
starts: `format:check` flags several untracked plan files under `plans/`
(006, 007, 009, 010, 012 and 013 when this plan was written). Those files
are out of scope. Step 0 records the baseline so you can tell them apart
from failures you cause.

Before plan 002 lands, `npm run check` does not lint telltale and skips its
typecheck when the types folder is missing. If `ls` above finds no types,
load the plugin once (`claude --plugin-dir plugins/telltale`, then exit) so
`npm run validate` typechecks it. `npm run check` also runs `site:data`,
which may rewrite the generated regions of the root `README.md`; that
regeneration is expected.

## Scope

**In scope** (the only files you should modify):

- `plugins/telltale/hooks/register.tsx`, one new `ui.render` hook directly
  after the `ToolUse` hook
- `plugins/telltale/tests/register.test.ts`, a helper and three tests in the
  R44/R45/R46 block
- `plugins/telltale/README.md`, the "Transcript." bullet (line 43) and the
  R44 index line (line 209)
- `plugins/telltale/.claude-plugin/plugin.json`, the version

**Out of scope** (do NOT touch):

- The `ToolUse` hook itself: its per-call line stays as it is, and it is
  what draws lines on an expanded group's rows.
- `hooks/lib.ts`: every helper needed already exists. Do not add a
  formatting helper for one line.
- `types/index.d.ts`: no new atom.
- `docs/plan/2026-10-08-telltale-ui/telltale-ui.delta.md`: a dated record of
  the v0.3 change; the README index is the current wording. Mention the
  answered open question in your report instead.
- Setting `isExpanded` or otherwise changing the group: telltale observes,
  it never unfolds anything.
- A summed or longest duration on the line (see Maintenance notes).
- The `command.run` handler directly below the insertion point (plan 012
  edits it).

## Git workflow

- Branch: `telltale/plan-009-toolgroup-cost-line` (repo style is
  `<plugin>/<topic>`, e.g. `telltale/v0.3-ui`)
- Conventional subject, matching `git log` (e.g.
  `feat(telltale): add status line, live band and table views`):
  `feat(telltale): add a cost line under folded tool groups`
- Do NOT push or open a PR unless the operator instructed it

## Steps

### Step 0: Record the baseline

Run `npm run check` and `claude plugin test plugins/telltale` on the
starting tree and note the results.

**Verify**: `claude plugin test plugins/telltale` → exit 0 with 175 passing
at the planned-at commit (more if sibling plans that add tests have landed;
note the number, it is your baseline). `npm run check` → exit 0, or a
failure whose only flagged files are under `plans/*.md`. Those plan-file
failures are out of scope: ignore them here and at Step 4, and do not
format or edit the plan files. Any other failure on the starting tree is a
STOP condition.

### Step 1: Add the `ToolGroup` render hook

In `plugins/telltale/hooks/register.tsx`, directly after the `ToolUse`
hook's closing `}).catch(($, e, next) => next(e));` (line 1150) and before
the `// R9, R23, delta R6: \`/telltale [calls|inventory]\`.` comment, add:

```tsx
// R44, R46: a folded group of tool calls gets one dim line summing its completed counted
// calls the pane keeps. Expanded, its rows are ToolUse rows and the hook above draws theirs;
// while active, a call may still join it. Any fault leaves the engine's row.
on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
  let line: string | null = null;
  try {
    if (!e.props.isExpanded && !e.props.isActive) {
      // A host that predates `tool_use_id` names no call, so its groups get no line.
      const ids = new Set(
        e.props.calls.flatMap((one) =>
          one.tool_use_id !== undefined && !one.isRunning && mcpServer(one.tool) !== null
            ? [one.tool_use_id]
            : [],
        ),
      );
      const found = ids.size > 0 ? (await read($, calls)).filter((one) => ids.has(one.id)) : [];
      if (found.length > 0) {
        const tokens = found.reduce((sum, one) => sum + estTokens(one.textChars), 0);
        const errors = found.filter((one) => one.isError).length;
        line = `${plural(found.length, 'MCP call')} · ~${formatTokens(tokens)} tok${
          errors > 0 ? ` · ${plural(errors, 'error')}` : ''
        }`;
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
```

Notes on the shape:

- Tokens are summed per call (`estTokens` of each, then added), the same
  way the band sums `turnTokens` at line 1112, so the group line and the
  per-call lines agree once expanded.
- `await next(e)` happens after the try block, as in the `ToolUse` hook, so
  a fault in telltale's part never prevents the engine's drawing.
- Reading `calls` inside the hook is what makes the row redraw when a call
  lands, as the `ToolUse` hook's comment says.
- Let prettier decide the final line breaks. `npx prettier --write` is
  allowed on the three in-scope text files only:
  `plugins/telltale/hooks/register.tsx`,
  `plugins/telltale/tests/register.test.ts` and
  `plugins/telltale/README.md`. Never run it on the whole repo or on
  `plans/`.

**Verify**: `claude plugin test plugins/telltale` → exit 0, the Step 0
baseline count passing (175 at the planned-at commit) and no new tests yet;
then `npm run validate` → exit 0 with
no `tsc` error for `plugins/telltale` (this proves `e.props` narrows to the
`ToolGroup` props).

### Step 2: Add the tests

In `plugins/telltale/tests/register.test.ts`, directly after the R44 test
`'R44: running, built-in and unknown calls keep the engine row alone'`
(ends around line 1998) and before the R45 test, add a helper and three
tests:

```ts
const groupRow = async (
  $: never,
  members: { id?: string; tool: string; isRunning?: boolean }[],
  state = { isActive: false, isExpanded: false },
) =>
  ($ as { ui: { render: (e: unknown) => Promise<unknown> } }).ui.render({
    component: 'ToolGroup',
    surface: 'terminal',
    requestId: 'g1',
    viewport: { columns: 100, rows: 40, isFullscreen: false },
    props: {
      calls: members.map(({ id, tool, isRunning = false }) => ({
        ...(id === undefined ? {} : { tool_use_id: id }),
        tool,
        input: {},
        isRunning,
        isErrored: false,
        isInterrupted: false,
      })),
      ...state,
    },
  });

test('R44: a folded group sums its completed MCP calls on one line', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callBatch($ as never, world, [
    { id: 'u1', tool: 'mcp__github__search_issues', text: 'x'.repeat(4000) },
    { id: 'u2', tool: 'mcp__db__q', text: 'y'.repeat(400) },
  ]);
  await callOne($ as never, world, 'u3', 'mcp__db__q', 'x'.repeat(40), true);
  await callOne($ as never, world, 'r', 'Read', 'ok');
  const tree = (await groupRow($ as never, [
    { id: 'u1', tool: 'mcp__github__search_issues' },
    { id: 'u2', tool: 'mcp__db__q' },
    { id: 'u3', tool: 'mcp__db__q' },
    { id: 'r', tool: 'Read' },
  ])) as Element;
  expect(tree.type).toBe('Box');
  expect(tree.props?.flexDirection).toBe('column');
  expect(tree.children?.[0]).toEqual(ENGINE_ROW);
  const line = tree.children?.[1] as Element;
  expect(line.props?.dimColor).toBe(true);
  expect(stringsOf(line).join('').trim()).toBe('3 MCP calls · ~1.1k tok · 1 error');
});

test('R44: an expanded, active or unmatched group keeps the engine row alone', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callOne($ as never, world, 'u1', 'mcp__o__s', 'ok');
  const one = [{ id: 'u1', tool: 'mcp__o__s' }];
  expect(await groupRow($ as never, one, { isActive: false, isExpanded: true })).toEqual(
    ENGINE_ROW,
  );
  expect(await groupRow($ as never, one, { isActive: true, isExpanded: false })).toEqual(
    ENGINE_ROW,
  );
  expect(await groupRow($ as never, [{ tool: 'mcp__o__s' }])).toEqual(ENGINE_ROW);
  expect(await groupRow($ as never, [{ id: 'nope', tool: 'mcp__o__s' }])).toEqual(ENGINE_ROW);
  expect(await groupRow($ as never, [{ id: 'u1', tool: 'mcp__o__s', isRunning: true }])).toEqual(
    ENGINE_ROW,
  );
});

test('R46: a group line that fails to draw leaves the engine row', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callOne($ as never, world, 'u1', 'mcp__o__s', 'ok');
  // A non-string tool name makes `mcpServer` throw inside the hook's `try`.
  expect(await groupRow($ as never, [{ id: 'u1', tool: 42 as never }])).toEqual(ENGINE_ROW);
});
```

The expected figure in the first test: 4,000 / 4 = 1,000 tokens, 400 / 4 =
100, 40 / 4 = 10, summed 1,110, which `formatTokens` prints as `1.1k`. The
`Read` call is not counted (`mcpServer('Read')` is null), so the count
is 3. The R46 test reaches the `catch` for real: `mcpServer(42)` calls
`42.startsWith`, which throws a `TypeError` inside the `try`. Do not use the
`state.set` rewrite from the existing `ToolUse` R46 test instead; it never
reaches the `catch` (see Current state).

The test code above is already formatted for prettier's 100-column width.
If prettier still reflows anything, run `npx prettier --write
plugins/telltale/tests/register.test.ts` and keep its output.

**Verify**: `claude plugin test plugins/telltale` → exit 0, three more tests
passing than the Step 0 baseline (178 passing, 0 failing at the planned-at
commit), with the three new tests listed. Then prove the tests can fail,
reverting each change before the next:

1. Temporarily change `!e.props.isExpanded` to `e.props.isExpanded` in the
   new hook, rerun, and confirm both R44 group tests fail.
2. Temporarily change the new hook's `catch` body from `line = null;` to
   `line = 'X';`, rerun, and confirm the R46 group test fails.

Revert both and rerun → exit 0, 178 passing.

### Step 3: README

In `plugins/telltale/README.md`:

- Line 43, the "Transcript." bullet, append one sentence: "A folded run of
  calls gets one such line beneath its count line instead, summing its MCP
  calls: `3 MCP calls · ~1.1k tok`, plus `· 1 error` when any failed."
- Line 209, replace **R44** with:
  "**R44** In an interactive session a completed counted call the pane
  keeps gets one dim line beneath its transcript tool line,
  `<dur> · ~<t> tok` (` · error` when it failed); a folded group of tool
  calls that is no longer active gets one dim line beneath its count line
  instead, `<k> MCP call(s) · ~<t> tok` (` · <n> error(s)` when any failed),
  summing its completed counted calls the pane keeps, and none when it has
  none or the host does not identify its calls; an expanded group's calls
  get their own lines; the engine's rows are drawn unchanged; running,
  built-in and evicted calls get none."

Do not touch the generated regions of the root `README.md`; `npm run check`
rewrites them itself.

**Verify**: `grep -n "folded group of tool calls" plugins/telltale/README.md`
→ one match, on the R44 line; `grep -n "folded and evicted" plugins/telltale/README.md`
→ no match.

### Step 4: Version and gate

Bump `"version"` in `plugins/telltale/.claude-plugin/plugin.json` by one
patch step from whatever it holds at execution time (it is `0.3.1` at the
planned-at commit; sibling plans bump it too, so read the live value).

**Verify**: `npm run check` → exit 0, or failing only on the same
`plans/*.md` files Step 0 recorded. No file under `plugins/telltale/` may
appear in its output.

## Test plan

- New tests, all in `plugins/telltale/tests/register.test.ts` in the R44,
  R45, R46 block:
  - `R44: a folded group sums its completed MCP calls on one line`: the
    happy path, with two plain MCP calls, an errored one and a built-in
    `Read` in the same group; pins the count, the summed tokens, the error
    suffix, the `Box`/dim-`Text` shape and the unchanged engine row.
  - `R44: an expanded, active or unmatched group keeps the engine row alone`:
    expanded (the `ToolUse` hook owns those rows, so no double line),
    active, a call with no `tool_use_id` (older desktop host), an id the
    pane does not keep, and a running call.
  - `R46: a group line that fails to draw leaves the engine row`: a
    non-string tool name makes `mcpServer` throw inside the `try`, so the
    `catch` must leave the engine row. Step 2 proves it is reached by
    breaking the `catch` and watching the test fail.
- Structural pattern: the existing R44 tests at
  `tests/register.test.ts:1967` and `:1990`. Do not pattern the fault test
  after the R46 test at `:2015`, which never reaches its `catch`.
- Verification: `claude plugin test plugins/telltale` → 178 passing at the
  planned-at commit (baseline + 3); `npm run validate` → exit 0.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -c "component: 'ToolGroup'" plugins/telltale/hooks/register.tsx` → `1`
- [ ] `grep -c "component: 'ToolUse'" plugins/telltale/hooks/register.tsx` → `1`
      (the existing hook is still there, unchanged)
- [ ] `grep -n "a folded group sums its completed MCP calls\|an expanded, active or unmatched group\|a group line that fails to draw" plugins/telltale/tests/register.test.ts`
      → three matches
- [ ] `claude plugin test plugins/telltale` → exit 0, Step 0 baseline + 3
      passing (178 at the planned-at commit)
- [ ] `npm run validate` → exit 0, with no `⚠ … no generated types` line
      for `plugins/telltale`
- [ ] `npm run check` → exit 0, or failing only on the `plans/*.md` files
      Step 0 recorded
- [ ] `grep -n "folded group of tool calls" plugins/telltale/README.md` →
      one match
- [ ] `git status` shows only the in-scope files (plus the root `README.md`
      if `site:data` regenerated it)
- [ ] `plans/README.md` has a row for 009 with its status updated (added if
      it was missing), unless a reviewer said they maintain the index

## STOP conditions

Stop and report back (do not improvise) if:

- At Step 0, `npm run check` or `claude plugin test plugins/telltale` fails
  on anything other than formatting of `plans/*.md` files.
- The `ToolUse` hook, the R44 test block or the README R44 line does not
  match the excerpts above beyond the drift the header allows.
- The test kit rejects `component: 'ToolGroup'` in `ui.render`, or the
  stand-in engine hook in `worldOf` is not what `next(e)` returns for it
  (the first test's `tree.children?.[0]` is not `ENGINE_ROW`). Report what
  the kit returned; do not change `worldOf`.
- `tsc` reports that `e.props.calls`, `isActive` or `isExpanded` does not
  exist on the hook's event: the matcher is not narrowing, which means the
  generated types differ from the excerpt above. Report the live type
  rather than casting.
- `ToolGroupCall` in the live types has no `tool_use_id`, or `ToolGroup` has
  lost `isActive`/`isExpanded`.
- Any existing test fails after step 1, in particular the R44 and R46
  `ToolUse` tests: the new hook must not change what a `ToolUse` row draws.
- A step's verification fails twice after a reasonable fix attempt.

Not a STOP condition, but report it: the existing `ToolUse` R46 test
(`tests/register.test.ts:2015`) passes without reaching its hook's `catch`
(see Current state). Fixing it is out of scope for this plan; name it in
your report so it can be planned separately.

## Maintenance notes

- File overlap with sibling plans: plans 006, 007, 008, 010, 011, 012 and
  013 all edit `hooks/register.tsx`, `tests/register.test.ts` and
  `README.md`, and every plan bumps the `plugin.json` version. None edits
  the `ToolUse` hook or the R44 line. Plan 012 edits the `command.run`
  handler directly below this hook, so expect a trivial textual merge
  conflict at the insertion point if both land on parallel branches. Plans
  006 and 008 change the detail view and plan 007 adds call-record fields;
  none of that affects the `Call` fields this hook reads (`id`,
  `textChars`, `isError`).
- No new requirement ID is added; R44 is amended. If a sibling plan has
  taken R49 meanwhile, nothing here conflicts.
- The line deliberately shows no time. Durations of parallel calls overlap,
  so a summed duration overstates wall time. If a time is wanted later,
  show the longest (`max <dur>`, via `formatDur`), not the sum.
- The engine's own count line already names the server and how many calls
  it made, so the new information is cost and errors. If the engine ever
  starts showing cost on folded groups, this hook becomes redundant and
  should be removed with R44 reworded.
- The fold behavior was confirmed in the 2.1.295 binary only (MCP calls
  fold, except "minted" servers). This also answers the open question at
  `docs/plan/2026-10-08-telltale-ui/telltale-ui.delta.md:350` and part of
  the pending live checks listed under "Direction" in `plans/README.md`;
  whoever runs those live checks should confirm the line shows under a
  folded MCP group and redraws when the group's last call lands.
- What a reviewer should scrutinize: that the expanded case is skipped (or
  every call would get two lines), that `next(e)` is awaited outside the
  `try`, and that the `.catch(($, e, next) => next(e))` is present (R46).

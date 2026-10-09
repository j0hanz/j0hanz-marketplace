# Plan 006: Name subagents in the call detail header

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report, do not improvise. When done, update the status row for this plan
> in `plans/README.md`; if the index has no 006 row yet (at planning time it
> lists 001–005 only), add one in the same table format, with the title,
> priority, effort and dependency from the Status section below. Skip this if
> a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat f3e7fb0..HEAD -- plugins/telltale/`
> Other plans written in the same run edit the same files: 002 and 003
> respell or extend regexes in `lib.ts`; 004, 005, 011 and 013 edit
> `session.end`, the tail of `turn.complete` or the toast helper; 007 and 010
> edit `turn.step` and `callResponse`; 008 edits the `duration includes any
permission prompt` line of `drawDetail` and adds a field to `Call` in
> `types/index.d.ts`. Plans 005 and 013 also add atoms next to `toastedTurn`
> (`deferredToast`, `toastedNames`) and the matching keys to
> `PluginState.telltale` (`deferred`, `toastedNames`); 013 rewrites the
> `// R47: …` comment above `NO_TOTALS`; and 005 and 013 both rewrite the
> README R47 line ("the turn's toast" becomes "the turn's toast, fired or
> held, the tools that already toasted"). None of them touches the lines this
> plan edits. If `detailHeader` in `hooks/lib.ts`, the `const header =
detailHeader({…})` call in `drawDetail`, the `if (ready) {` block of
> `turn.complete`, the `pendingIds` atom line, or the `PluginState.telltale`
> block in `types/index.d.ts` no longer match the excerpts below beyond those
> changes, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW, display only: the logs, labels, totals and the agent list's
  existing use (R12) are untouched; the one visible trade-off is a longer
  detail header (see Maintenance notes)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `f3e7fb0`, 2026-10-09

## Why this matters

The detail view of a subagent's call says `agent a1b2`, an id the person
cannot map to anything. When several subagents call the same MCP server, the
pane cannot tell which task made which call, or which agent is the costly
one. The type and the task description of every subagent are already fetched
at each main-turn end (`$.agent.list()`, used today only to tell running
agents from stopped ones) and then thrown away.

After this plan: the detail header reads `agent map the db layer (Explo…`
(the agent's task, then its type in brackets, cut to 24 characters together)
instead of `agent a1b2`, and falls back to the id for an agent telltale never
saw listed. The task comes first because it is what tells two agents apart:
plugin agent types are named `<plugin>:<name>` and can be 29 characters or
more on their own, so a type-first label would often clip away the task
entirely. Names are kept in pane state, so they survive a hot reload (R47)
and outlive the engine dropping a finished subagent from its list.

## Current state

- `plugins/telltale/hooks/lib.ts`, `detailHeader` (lines 435–449), the pure
  formatter of the header. The agent part is the id:

  ```ts
  /** R36 (amended): `<tool> · <server> · agent <id> · <dur> · <c> chars · ~<tok> tok · <next>`. */
  export const detailHeader = (c: {
    tool: string;
    server: string | null;
    agentId: string | null;
    ms: number;
    chars: number;
    tokens: number;
    next: string | null;
  }): string =>
    [
      c.tool,
      ...(c.server ? [c.server] : []),
      ...(c.agentId ? [`agent ${c.agentId}`] : []),
      formatDur(c.ms),
      `${c.chars} chars`,
      `~${formatTokens(c.tokens)} tok`,
      c.next ?? '…',
    ].join(' · ');
  ```

  `clip` (R48) is defined earlier in the same file (lines 277–279), so
  `detailHeader` can call it directly:

  ```ts
  export const clip = (text: string, width: number): string =>
    text.length <= width ? text : `${text.slice(0, Math.max(0, width - 1))}…`;
  ```

- `plugins/telltale/hooks/register.tsx`:
  - The atoms block (lines 55–76). Pane state lives in `atom`s keyed under
    `plugin: 'telltale'`; for example (line 68):

    ```ts
    const pendingIds = atom({ plugin: 'telltale', key: 'pending' } as const, {});
    ```

    `atom`, `read` and `update` are imported from `claude-code` at line 4.

  - `drawDetail` (starts line 493). It already reads one atom at the top
    (line 497: `const note = await read($, message);`) and builds the header
    at lines 546–554:

    ```ts
    const header = detailHeader({
      tool: toolName(call.tool),
      server: call.server,
      agentId: call.agentId,
      ms: call.ms,
      chars: call.textChars,
      tokens: estTokens(call.textChars),
      next: call.next,
    });
    ```

    It is drawn at line 567, cut to the pane width by R48 (8 columns are
    kept for ` · error` on an errored call):

    ```tsx
    <Text bold>{clip(header, width - (call.isError ? 8 : 0))}</Text>
    ```

  - `turn.complete` (handler starts line 995). The agent list is read inside
    the `ready` block (line 1014) and returned from it; it is `undefined`
    when the list call failed:

    ```ts
    const ready = await safe(async () => {
      const listed = await safe(() => $.agent.list());
      const liveAgents = new Set(
        (listed ?? []).filter((agent) => agent.status === 'running').map((agent) => agent.id),
      );
      …
      return { listed, liveAgents, done };
    });
    if (ready) {
      const { listed, liveAgents, done } = ready;
      // R5, R6: the logs are the durable output. They are written first, in their own `safe`,
      // so a refused pane-state write (below) can never cost a turn its file.
      await safe(() => writeLogs($, turn, done, n));
      await settled;
      await safe(async () => {
    ```

    (lines 1013–1045). Every pane-state write after the logs is wrapped in
    `safe`, so a refused write never costs the turn its file. Follow that.

- `plugins/telltale/types/index.d.ts`, the plugin's own state types (not the
  engine API). Every atom key must be declared in `PluginState.telltale`
  (lines 49–67), for example:

  ```ts
  pending: Record<string, string>; // delta R12: pending call id -> agent id
  ```

- The engine API, `plugins/telltale/.claude-plugin/types/claude-code/index.d.ts`
  (generated, gitignored; read only):
  - `AgentInfo` (line 125; its doc comment starts at 121) has `id`,
    `description` ("The Agent call's own `description` of the task (a few
    words)", a required `string`), `type` ("`general-purpose`, `Explore`,
    ...; `teammate` for one spawned as none") and `status`. It also has an
    optional `name` (line 183): "What SendMessage addresses it by
    (`Agent({ name })`, or the engine's own for a background agent), when it
    has one; not `description` or `type`." This plan does not use `name`
    (see Maintenance notes).
  - `list` (lines 3155–3159): "One entry an agent, until the engine drops its
    task: as a teammate ends or seconds after, a subagent's later." So a
    finished subagent eventually leaves the list. Names must therefore be
    merged into what is already known, never replaced by the latest list.
  - `register`, just after `list` (line 3162): plugin agent types are
    "named `<plugin>:<name>`", for example `caveman:cavecrew-investigator`
    (29 characters). This is why the label puts the task first.

- Tests:
  - `plugins/telltale/tests/lib.test.ts` lines 492–511, `R36: the detail
header, with the agent right after the server`, asserts the header
    strings directly, including `'run_query · db · agent a1b2 · 2.1s · 120
chars · ~30 tok · retried'`.
  - `plugins/telltale/tests/register.test.ts`:
    - `World.results` is typed `Record<string, { result: unknown; text?:
string; isError?: true }>` (line 18). `isError` can only be `true` or
      absent; a successful result omits it (as at lines 264 and 455), and
      writing `isError: false` there fails the typecheck.
    - The `agent.list` stub (lines 115–126) answers each id in
      `world.running` as `{ id, description: id, type: 'general-purpose',
status: 'running' }`. So under test, agent `a1b2`'s name is
      `a1b2 (general-purpose)`.
    - `stateOf(on)` (lines 160–167) records the last `state.set` value by
      key; R47 tests read it, e.g. `expect(kept.get('pending')).toEqual({ z:
'a1' })` (line 868).
    - `respond` (line 173) drives one model step, optionally as an agent;
      `endTurn` (line 1284) ends a main turn.
    - `openDetail($, id, columns = 80)` (lines 1676–1681) opens a call's
      detail and returns the drawn tree; `linesOf(tree)` (line 1517) turns it
      into lines.
    - The test this plan must update, `R36: an errored subagent call puts
the agent right after the server` (lines 1694–1720), expects
      `'run_query · db · agent a1b2 · 2.1s · 120 chars · ~30 tok · retried'`
      at the default 80 columns.

- README, `plugins/telltale/README.md`:
  - Line 48, the reader-facing description of the detail view: "Press Enter
    to open a call's detail. Its header reads `tool · server · time · chars ·
tokens · next`." It already omits the agent part that R36 added.
  - The requirements index (each line is "the current wording; update the
    matching line whenever behaviour changes", line 164):
    - R36 (line 201): "The detail header reads `<tool> · <server> · agent
<id> · <dur> · <c> chars · ~<t> tok · <next>`, then ` · error` in the
      error colour; server and agent parts only where they apply."
    - R47 (line 212): "A hot reload keeps the Calls rows and labels, the
      selection, the view, the session totals, the turn counter, the turn's
      toast and the measured Inventory figures; it drops the kept argument
      and result text of earlier calls."
  - The logs' `agentId` field (line 96) stays the id; this plan writes no
    name to the logs.

- `plugins/telltale/.claude-plugin/plugin.json` holds `"version": "0.3.1"` at
  planning time.

## Commands you will need

| Purpose      | Command            | Expected on success                                       |
| ------------ | ------------------ | --------------------------------------------------------- |
| Plugin tests | `npm run validate` | exit 0, runs `claude plugin test` including the new tests |
| Full gate    | `npm run check`    | exit 0                                                    |

`npm run validate` also runs `tsc -p plugins/telltale`, but only when
`plugins/telltale/.claude-plugin/types/` exists; without it, it prints
`⚠ … no generated types` and skips the typecheck. If you see that warning,
load the plugin once with `claude --plugin-dir plugins/telltale` and rerun.
The typecheck matters here: it is what catches a wrongly typed test literal
that `claude plugin test` alone would pass. Until plan 002 lands, `npm run
lint` ignores `plugins/**`, so lint does not check this change; that is
expected. `npm run check` chains `site:data`, which may rewrite the root
`README.md`'s generated regions; commit what it regenerates.

## Scope

**In scope** (the only files you should modify):

- `plugins/telltale/hooks/lib.ts`, `detailHeader` only
- `plugins/telltale/hooks/register.tsx`: one new atom in the atoms block,
  the `header` construction in `drawDetail`, and one `safe` write in the
  `if (ready) {` block of `turn.complete`
- `plugins/telltale/types/index.d.ts`, one key in `PluginState.telltale`
- `plugins/telltale/tests/lib.test.ts`, the R36 test
- `plugins/telltale/tests/register.test.ts`, the R36 subagent test and two
  new tests next to it
- `plugins/telltale/README.md`, line 48 (the detail header description) and
  the R36 and R47 index lines
- `plugins/telltale/.claude-plugin/plugin.json`, the version
- `plans/README.md`, this plan's status row (see Executor instructions)

**Out of scope** (do NOT touch):

- An `agent.spawn` hook. It would name a subagent's rows mid-turn, but it
  puts telltale into the spawn chain, where a throw could affect a spawn.
  The turn-end list is enough.
- The Calls table's `↳ ` prefix (R32): the TOOL column is 4 to 32 wide and
  has no room for a name.
- The log records and their `agentId` field: names are display only.
- `session.end` and the `/clear` branch: an old agent's name is harmless
  after a clear (ids are unique), and plans 004, 005 and 013 edit that
  handler.
- The R12 stopped/running logic that also reads `listed`, and the
  `$.agent.list()` call itself: this plan reuses its result unchanged.
- `AgentInfo.name` (see Maintenance notes).

## Git workflow

- Branch: `telltale/plan-006-subagent-names`
- Conventional subject, matching `git log` (e.g. `7d6985e fix(telltale):
redact secret fields in any spelling`): `feat(telltale): name subagents in
the call detail header`
- Do NOT push or open a PR unless the operator instructed it

## Steps

### Step 1: Let `detailHeader` print a name

In `plugins/telltale/hooks/lib.ts`, give `detailHeader` an optional
`agentName` and print it instead of the id when present, cut to 24
characters with `clip`:

```ts
/** R36 (amended): `<tool> · <server> · agent <name or id> · <dur> · <c> chars · ~<tok> tok · <next>`. */
export const detailHeader = (c: {
  tool: string;
  server: string | null;
  agentId: string | null;
  agentName?: string; // `<task> (<type>)` from the agent list, when telltale saw it listed
  ms: number;
  chars: number;
  tokens: number;
  next: string | null;
}): string =>
  [
    c.tool,
    ...(c.server ? [c.server] : []),
    // R48: the name is capped so the figures after it survive the row clip.
    ...(c.agentId ? [`agent ${c.agentName ? clip(c.agentName, 24) : c.agentId}`] : []),
    formatDur(c.ms),
    `${c.chars} chars`,
    `~${formatTokens(c.tokens)} tok`,
    c.next ?? '…',
  ].join(' · ');
```

Then extend the R36 test in `plugins/telltale/tests/lib.test.ts` (after the
`agentId: 'a1b2'` expectation, before the `Read` one) with:

```ts
expect(
  detailHeader({
    tool: 'run_query',
    server: 'db',
    agentId: 'a1b2',
    agentName: 'map the db layer (Explore)',
    ms: 2100,
    chars: 120,
    tokens: 30,
    next: 'retried',
  }),
).toBe('run_query · db · agent map the db layer (Explo… · 2.1s · 120 chars · ~30 tok · retried');
```

(`'map the db layer (Explore)'` is 26 characters; `clip(…, 24)` keeps the
first 23 and adds `…`. The task survives whole; the type in brackets is what
gets cut.) The existing `agent a1b2` expectation stays as is: it is the
fallback when no name is passed.

**Verify**: `npm run validate` → exit 0; the lib R36 test passes with the
new expectation.

### Step 2: Keep the names in pane state

1. In `plugins/telltale/types/index.d.ts`, add to `PluginState.telltale`,
   after `pending`:

   ```ts
   agents: Record<string, string>; // R36: agent id -> `<task> (<type>)`, from the agent list
   ```

2. In `plugins/telltale/hooks/register.tsx`, add the atom next to
   `pendingIds` (line 68):

   ```ts
   // R36, R47: subagent names by id. Only added to: the engine drops a finished agent from its list.
   const agentNames = atom({ plugin: 'telltale', key: 'agents' } as const, {});
   ```

3. In `turn.complete`, inside `if (ready) {`, right after
   `await safe(() => writeLogs($, turn, done, n));` and before
   `await settled;`, add:

   ```ts
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
   ```

   It runs at every main-turn end, also a turn with no calls, because the
   `ready` block does not depend on `hasRecords`. The `...known` spread is
   what keeps a dropped agent's name; step 4's second test fails without it.

**Verify**: `npm run validate` → exit 0 (no behaviour change yet; the
typecheck leg passes with the new key).

### Step 3: Pass the name into the header

In `drawDetail` (`plugins/telltale/hooks/register.tsx`), next to
`const note = await read($, message);` (line 497), add:

```ts
const names = await read($, agentNames);
```

and add one field to the `detailHeader({…})` call (lines 546–554), after
`agentId: call.agentId,`:

```ts
    agentName: call.agentId ? names[call.agentId] : undefined,
```

**Verify**: `npm run validate` → it now FAILS in exactly one test,
`R36: an errored subagent call puts the agent right after the server`,
because the header now names the agent. Any other failure is a STOP
condition.

### Step 4: Update and add the register tests

In `plugins/telltale/tests/register.test.ts`:

1. In `R36: an errored subagent call puts the agent right after the server`
   (line 1694), open the detail at 100 columns, because the named header
   (84 characters) is longer than the 72 columns an errored call has at
   width 80, and expect the name:

   ```ts
   const tree = await openDetail($ as never, 'q', 100);
   expect(linesOf(tree)).toContain(
     'run_query · db · agent a1b2 (general-purpose) · 2.1s · 120 chars · ~30 tok · retried',
   );
   ```

2. Add, right after that test, the two tests below. Do not write `isError:
false` in the `world.results` literals: the field is typed `isError?:
true` (line 18), so a successful result leaves it out.

   ```ts
   test('R36: a subagent keeps its name after the agent list drops it', async ($, on) => {
     const world = worldOf(on);
     const kept = stateOf(on);
     world.running = ['a1b2'];
     await $.session.start(SESSION);
     await respond($ as never, world, [{ id: 'q', name: 'mcp__db__run_query' }], 'a1b2');
     world.results.q = { result: 'r', text: 'x'.repeat(120) };
     await $.tool.call({ tool: 'mcp__db__run_query', tool_use_id: 'q', agentId: 'a1b2' } as never);
     await endTurn($ as never, world);
     // The engine has dropped the finished a1b2; the list is not empty, so the names are merged.
     world.running = ['c3d4'];
     await endTurn($ as never, world);
     expect(kept.get('agents')).toEqual({
       a1b2: 'a1b2 (general-purpose)',
       c3d4: 'c3d4 (general-purpose)',
     }); // R47
     const lines = linesOf(await openDetail($ as never, 'q', 100));
     expect(lines.some((line) => line.includes(' · agent a1b2 (general-purpose) · '))).toBe(true);
   });

   test('R36: an agent never listed shows its id', async ($, on) => {
     const world = worldOf(on);
     await $.session.start(SESSION); // world.running is empty: the list names nobody
     await respond($ as never, world, [{ id: 'q', name: 'mcp__db__run_query' }], 'a1b2');
     world.results.q = { result: 'r', text: 'x'.repeat(120) };
     await $.tool.call({ tool: 'mcp__db__run_query', tool_use_id: 'q', agentId: 'a1b2' } as never);
     await endTurn($ as never, world);
     const lines = linesOf(await openDetail($ as never, 'q', 100));
     expect(lines.some((line) => line.includes(' · agent a1b2 · '))).toBe(true);
   });
   ```

   The `respond`/`$.tool.call`/`endTurn` sequence is the one the existing
   R36 subagent test uses (without its `world.slow` and error setup). The
   second `endTurn` of the first test lists only `c3d4`, a non-empty list
   without `a1b2`, so it runs the merge: if the `...known` spread of step 2
   were missing, `a1b2` would disappear from `agents` and the test would
   fail. The tests assert the header with `includes` so they do not depend
   on the `next` label or the duration.

**Verify**: `npm run validate` → exit 0, with the updated test and the two
new ones passing, and no `TS2322` from the typecheck leg.

### Step 5: README and version

In `plugins/telltale/README.md`:

- Line 48: replace "Its header reads `tool · server · time · chars · tokens
· next`." with "Its header reads `tool · server · agent · time · chars ·
tokens · next`; `agent` shows only on a subagent's call, as its task and
  type."
- R36 (line 201), replace with: "**R36** The detail header reads `<tool> ·
<server> · agent <name> · <dur> · <c> chars · ~<t> tok · <next>`, then
  ` · error` in the error colour; server and agent parts only where they
  apply; `<name>` is the subagent's `<task> (<type>)` from the agent list,
  cut to 24 characters, or its id when telltale never saw it listed (a
  running subagent's calls show the id until a main turn ends)."
- R47 (line 212): replace the exact text "and the measured Inventory
  figures" with ", the measured Inventory figures and the subagent names".
  That text is unchanged by plans 005 and 013, which edit only "the turn's
  toast" earlier in the same line. At `f3e7fb0` the result reads "…the turn
  counter, the turn's toast, the measured Inventory figures and the subagent
  names; it drops…".

Bump `"version"` in `plugins/telltale/.claude-plugin/plugin.json` by one
patch step from whatever it holds at execution time (0.3.1 at planning;
higher if other plans landed first).

**Verify**: `grep -n "agent <name>" plugins/telltale/README.md` → one hit on
the R36 line; `grep -n "Inventory figures and the subagent names"
plugins/telltale/README.md` → one hit on the R47 line; `grep -n "tool ·
server · agent · time" plugins/telltale/README.md` → one hit on line 48;
`npm run check` → exit 0.

## Test plan

- `tests/lib.test.ts`, the R36 test: one new expectation for a named header
  cut at 24 characters, with the task kept and the type cut; the existing
  `agent a1b2` expectation covers the fallback.
- `tests/register.test.ts`:
  - the updated R36 errored-subagent test (named header end to end, at 100
    columns);
  - a test in which turn 1 lists `a1b2` and turn 2 lists only `c3d4`,
    proving the names are merged rather than replaced, that `a1b2` keeps its
    name after the list drops it, and that pane state holds both under
    `agents` (R47);
  - a test proving an unlisted agent falls back to its id.
- Structural pattern: the existing `R36: an errored subagent call puts the
agent right after the server` test (`tests/register.test.ts:1694`) for
  driving a subagent call, and the R47 tests (`stateOf`, around line 1195)
  for reading pane state.
- Verification: `npm run validate` → exit 0 (both `claude plugin test` and
  the `tsc` leg); `npm run check` → exit 0.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run validate` → exit 0, with the two new register tests present
      and passing and the typecheck leg run (no `⚠ … no generated types`)
- [ ] `grep -n "isError: false" plugins/telltale/tests/register.test.ts`
      shows no line inside the new tests
- [ ] After a second turn that lists only `c3d4`, the merge test expects
      `{ a1b2: 'a1b2 (general-purpose)', c3d4: 'c3d4 (general-purpose)' }`
- [ ] `npm run check` → exit 0
- [ ] `grep -n "agentName" plugins/telltale/hooks/lib.ts plugins/telltale/hooks/register.tsx`
      finds the `detailHeader` field and the `drawDetail` argument
- [ ] `grep -n "key: 'agents'" plugins/telltale/hooks/register.tsx` finds
      one atom, and `grep -n "agents: Record<string, string>" plugins/telltale/types/index.d.ts`
      finds its declaration
- [ ] `grep -n "agent.spawn" plugins/telltale/hooks/register.tsx` returns no
      match (no spawn hook was added)
- [ ] `grep -n "agent <name>" plugins/telltale/README.md` hits the R36 line,
      `grep -n "Inventory figures and the subagent names" plugins/telltale/README.md`
      hits the R47 line, and `grep -n "tool · server · agent · time" plugins/telltale/README.md`
      hits line 48
- [ ] `git status` shows only in-scope files (plus the `site:data` regen)
- [ ] `plans/README.md` has a 006 row (added if it was missing) with its
      status updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any excerpt in "Current state" does not match the live code beyond the
  sibling-plan changes named in the drift check.
- After step 3, a test other than the R36 errored-subagent test fails: the
  change should alter that one header string and nothing else.
- The `agent.list` stub in `tests/register.test.ts` no longer answers
  `type: 'general-purpose'` and `description: id`; the expected strings in
  step 4 depend on it.
- The typecheck rejects `listed.map(…)` because `$.agent.list()` no longer
  returns `AgentInfo[]` with `type` and `description` (check
  `.claude-plugin/types/claude-code/index.d.ts` around line 3159).
- The step 4 tests fail at 100 columns because the header is still cut;
  do not raise the 24-character cap to make them pass, report instead.

## Maintenance notes

- The trade-off a reviewer should weigh: the name puts up to 24 characters
  where the id was, so a subagent's header gets longer. R48 cuts the header
  from the end, so on an 80-column pane the last figures (`~tok`, `next`) of
  a subagent call with a long tool name are cut. Without this plan they are
  already close to the edge. If that proves costly, the follow-up is to draw
  the name on its own dim line under the header and leave R36's header at
  `agent <id>`; it is a small change in `drawDetail` only.
- Label order: `<task> (<type>)` was chosen over `<type>: <task>` because
  the 24-character cap would otherwise clip a plugin type such as
  `caveman:cavecrew-investigator` (29 characters) down to the type alone,
  and leave `general-purpose: ` only 7 characters for the task. Capping only
  the task, or dropping the type, were the alternatives; task-first keeps
  the type whenever it fits and costs nothing when it does not.
- `AgentInfo.name` (the SendMessage name of a named or background agent) is
  another possible label. It was left out because `description` is a
  required field on every agent while `name` exists only for some; if
  people name their agents and find the name more telling, prefer `name`
  over `description` in step 2's expression, one line.
- Untested engine behaviour, needs a live check: the feature works only if
  a finished foreground subagent is still in `$.agent.list()` when the main
  turn that spawned it ends. The `list` doc (`index.d.ts:3155–3159`) says the
  engine drops a subagent's task "later", with no bound, and the test stub
  lists whatever `world.running` holds, so no test here can catch it. Live
  check: run a session in which an Explore subagent calls an MCP tool, then
  after the main turn ends open that call's detail with `/telltale` and
  expect `agent <task> (Explore)`, not the id. If it shows the id, the
  follow-up is the `agent.spawn` hook in the next note. When updating
  `plans/README.md`, add this check to the pending live checks bullet under
  "Direction".
- `ponytail:` the names are learned only at main-turn end, so the rows of a
  subagent still running show its id until the next main turn ends. The
  upgrade is a pass-through `on('agent.spawn')` that awaits `next(e)` and
  records `r.agentId`, `e.subagentType` and `e.description` when the spawn
  was not denied; it was left out because it adds telltale to the spawn
  chain.
- The `agents` record only grows: one short string per subagent the session
  ever listed, kept across `/clear` and reloads. That is a few hundred bytes
  for a busy session; it is not worth a cleanup path.
- File overlaps with sibling plans: plan 008 edits `drawDetail` (the
  permission line, about 30 lines below the header) and `types/index.d.ts`
  (a field on `Call`); plans 005 and 013 add atoms beside `toastedTurn` and
  keys to `PluginState.telltale`, and rewrite the R47 comment and README
  line; plans 005, 011 and 013 edit `turn.complete` after the pane-state
  block this plan adds to; every plan in this run edits the README
  requirements index and bumps the same `plugin.json` version. Whichever
  lands second rebases on the other's lines; none changes the behaviour this
  plan relies on. Its only `turn.complete` edit is one `safe` write after `writeLogs`
  inside `if (ready) {`; it leaves the `agent.list` read itself alone.

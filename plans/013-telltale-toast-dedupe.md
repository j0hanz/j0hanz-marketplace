# Plan 013: Toast each failing tool once until the user opens the pane

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report, do not improvise. When done, add a row for this plan to the table
> in `plans/README.md` (it lists only 001–005 at planning time), shaped
> `| 013 | [Toast each failing tool once until the pane opens](013-telltale-toast-dedupe.md) | P3 | S | 005 | DONE |`,
> unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat f3e7fb0..HEAD -- plugins/telltale/`
> This plan depends on plan 005 (and therefore 004). The excerpts below
> marked "post-005" assume 005 has landed: `maybeToast` holds large-result
> toasts in a `deferredToast` atom and `turn.complete` fires the held toast.
> If `grep -n "deferredToast" plugins/telltale/hooks/register.tsx` finds
> nothing, 005 has not landed; execute 004 and 005 first. Expected drift
> from sibling plans, which is not a STOP condition by itself: 002 (regex
> respellings and lint fixes), 003 (list entries in `lib.ts`), 011 (the
> Inventory reload in the same `turn.complete` tail), and 012 (the
> `command.run` `telltale` handler, which this plan also edits by one line;
> step 4 gives the line for both shapes of that handler). Plans 007, 010
> and 008 (if present in `plans/`) may add atoms next to `toastedTurn` and
> keys to the `PluginState` interface; add yours beside theirs. Any other
> drift in the excerpts below is a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW, only whether a toast fires changes; calls, totals, the
  status entry's `✗` count, logs and the pane are untouched
- **Depends on**: plans/005-telltale-error-toast-priority.md (hard: this
  plan edits the `maybeToast` body and the turn-end firing block that 005
  writes), and therefore plans/004-telltale-write-between-turn-records.md
- **Category**: direction
- **Planned at**: commit `f3e7fb0`, 2026-10-09

## Why this matters

R28 raises at most one toast per main-thread turn for an MCP call that
failed or returned 40,000 characters or more. A flaky MCP server that fails
every turn therefore toasts `db.run_query failed · /telltale` every turn,
which trains the person to ignore telltale's toasts, including the one that
matters later. A global backoff (fewer toasts the more are shown) was
considered and rejected: it would also suppress a different tool's first
failure, which is exactly the new information a toast exists for.

After this plan: each `<server>.<tool>` toasts once per kind (`failed` or
`large`) until the person opens `/telltale` or runs `/clear`, which resets
the memory. A tool that fails every turn toasts once; a different tool's
first failure still toasts at once. A skipped repeat does not use up the
turn's one toast, so another tool's toast can still take it. Nothing is
lost: the status entry still counts every error (`1✗`, `2✗`, …) and every
call is still listed and logged.

## Current state

- `plugins/telltale/hooks/register.tsx`, the module's single hooks file.
  The atoms block (lines 55–76 at `f3e7fb0`, `calls` to `message`). The R47 comment and the
  toast atom:

  ```ts
  // R47: what a hot reload keeps beyond the rows: totals, the turn counter, the turn's toast.
  const NO_TOTALS: Totals = { calls: 0, errors: 0, tokens: 0, skills: [], ctx: null, tools: {} };
  const totals = atom({ plugin: 'telltale', key: 'totals' } as const, NO_TOTALS);
  …
  const toastedTurn = atom({ plugin: 'telltale', key: 'toastedTurn' } as const, -1);
  ```

  Plan 005 adds, right after `toastedTurn`:

  ```ts
  const deferredToast = atom({ plugin: 'telltale', key: 'deferred' } as const, null);
  ```

  `atom`, `read` and `update` are imported from `'claude-code'` (line 4).

- `maybeToast`, post-005 shape (at `f3e7fb0` it sits at lines 428–445 and
  still has the pre-005 body). Plan 005 step 2 makes it:

  ```ts
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
  ```

  `serverTool` turns `mcp__db__run_query` into `db.run_query`; that string
  is the tool's identity in the toast text and is the identity this plan
  dedupes on.

- `maybeToast` runs from the serial `later` queue in `tool.call` (lines
  913–918 at `f3e7fb0`), one completed call at a time:

  ```ts
  void later(async () => {
    await listCall($, call);
    await addTotals($, call);
    await showStatus($);
    await maybeToast($, call);
  });
  ```

  `later` (lines 147–151) chains every job onto one promise, so two
  `maybeToast` runs never interleave; a read-then-update inside it is safe.

- The turn-end firing block that plan 005 step 3 adds to `turn.complete`,
  after `await showStatus($);` and before
  `if (!interactive || line === null) return r;`:

  ```ts
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
  ```

  Note the two `update` calls in it are not wrapped in `safe`, although
  this runs after `next(e)` in a handler with no `.catch`; every other
  write in that tail is (`await safe(() => update($, totals, …))` a few
  lines above). The file header states the rule: "its own work runs inside
  `safe`, so a fault here never changes or blocks a call" (R3). Step 3
  fixes this while it edits the block. `safe` (line 98) returns
  `undefined` on a throw; `later` (lines 147–151) already runs each job
  through `safe`, so `maybeToast` and the `session.end` cleanup are
  covered.

- The `/telltale` command handler (lines 1152–1175 at `f3e7fb0`). Opening
  the pane is the "the person looked" signal:

  ```ts
  // R9, R23, delta R6: `/telltale [calls|inventory]`.
  on('command.run', { command: 'telltale' }, async ($, e) => {
    await settled;
    if (!interactive) return { text: 'the pane needs an interactive session' };
    const raw = (e.args ?? '').trim();
    …
    await update($, selected, () => newest);
    await openView($, next);
    await $.ui.open({
      …
    });
    if (next === 'calls') await focusRow($, newest);
    return { text: known ? 'opened' : `unknown view "${raw}"; views: calls, inventory` };
  });
  ```

  Plan 012 rewrites the part from `await $.ui.open({` on. After 012 the
  open reads `let opened: UiOpenResult; try { opened = await $.ui.open({ … }); } catch (error) { … }`,
  where the `catch` returns a "pane not opened: …" text, followed by `if (opened.isPlaced && next === 'calls') await focusRow($, newest);`.
  Step 4 places the reset for either shape. The test kit's `ui.open` stub
  (`tests/register.test.ts:108–111`) answers `{ isPlaced: true }` today;
  plan 012 makes it settable through `world.openAnswer`.

- The `session.end` `clear` branch (lines 966–984 at `f3e7fb0`; plan 004
  wraps it in an if/else and plan 005 adds a `deferredToast` reset). Its
  `later`-queued cleanup ends:

  ```ts
        await update($, totals, () => NO_TOTALS); // the old context's share goes too (R27)
        await showStatus($);
      });
  ```

- `plugins/telltale/types/index.d.ts`, the `PluginState['telltale']`
  interface (lines 49–69). Every atom key must appear there or the plugin's
  `tsc` run in `npm run validate` fails. The neighbour line:

  ```ts
  toastedTurn: number; // R28: the turn that already had its toast
  ```

  Plan 005 adds `deferred: { turn: number; text: string } | null;` after it.

- The engine's toast API (`plugins/telltale/.claude-plugin/types/claude-code/index.d.ts:2437`):
  `toast: (text: string, options?: ToastOptions) => void;`. It is
  fire-and-forget and reports no click or dismissal, so "the person saw
  it" cannot be detected; opening `/telltale` is the only signal available.

- The tests, `plugins/telltale/tests/register.test.ts`, the R28 block
  (lines 1330–1382 at `f3e7fb0`, plus plan 005's three new tests). Helpers:
  `callOne($, world, id, tool, text, isError)` (line 1268) drives one
  counted call; `endTurn($, world)` (line 1284) ends a turn; `stateOf(on)`
  (line 160) records the last value written to each state key;
  `run($, args)` (line 635) runs `/telltale`; `world.toasts` collects
  every toast (the `on('ui.toast')` stub at lines 92–95 pushes every
  call; nothing in the kit holds toasts). The existing test this plan's
  tests pattern after:

  ```ts
  test('R28: one toast per turn, and an errored call gets the error text', async ($, on) => {
    const world = worldOf(on);
    const kept = stateOf(on);
    await $.session.start(SESSION);
    await callOne($ as never, world, 'a', 'mcp__db__run_query', 'boom', true);
    await callOne($ as never, world, 'b', 'mcp__github__search', 'x'.repeat(60_000));
    await endTurn($ as never, world);
    expect(world.toasts).toEqual(['db.run_query failed · /telltale']);
  ```

  That test keeps passing unchanged: turn 2's large `github.search` is a
  different key from turn 1's failed `db.run_query`.

- `plugins/telltale/README.md`: the "Toast" bullet (line 44), **R28**
  (line 193), **R47** (line 212), as of `f3e7fb0`. Plan 005 rewrites the
  Toast bullet and R28 and changes R47's "the turn's toast" to "the turn's
  toast, fired or held". Line 193 today:

  ```
  - **R28** In an interactive session, at most one toast per main-thread turn, for a counted call that errored (`<server>.<tool> failed · /telltale`) or returned 40,000 characters or more (`<server>.<tool> returned ~<t> tok`); the error text wins; the R16 notice does not count toward the limit.
  ```

- `plugins/telltale/.claude-plugin/plugin.json`, `"version": "0.3.1"` at
  `f3e7fb0` (005 and other plans bump it; bump from whatever it holds).

## Commands you will need

| Purpose      | Command            | Expected on success                                       |
| ------------ | ------------------ | --------------------------------------------------------- |
| Plugin tests | `npm run validate` | exit 0, runs `claude plugin test` including the new tests |
| Full gate    | `npm run check`    | exit 0                                                    |

Run them from the repo root, `C:/j0hanz-marketplace`. Until plan 002
lands, the gate has two gaps for telltale: `npm run lint` does not reach
`plugins/` at all, and `npm run validate` skips the plugin's `tsc` run
with a `⚠` line (and still exits 0) when
`plugins/telltale/.claude-plugin/types/` is missing. Before step 1, confirm
that folder exists (`ls plugins/telltale/.claude-plugin/types/claude-code/index.d.ts`);
if it does not, load the plugin once with `claude --plugin-dir plugins/telltale`
so the typecheck in the verify steps is real. `npm run check` chains
`site:data`, which may rewrite README regions and
`site/src/data/marketplace.json`; that regen is expected.

## Scope

**In scope** (the only files you should modify):

- `plugins/telltale/hooks/register.tsx`: the atoms block, `maybeToast`, the
  turn-end firing block in `turn.complete`, one line in the `command.run`
  `telltale` handler, one line in the `session.end` clear branch
- `plugins/telltale/types/index.d.ts`: the `PluginState` interface
- `plugins/telltale/tests/register.test.ts`: the R28 block
- `plugins/telltale/README.md`: the Toast bullet, R28 and R47 lines
- `plugins/telltale/.claude-plugin/plugin.json`: the version
- `plans/README.md`: one new row for this plan in the status table

**Out of scope** (do NOT touch):

- The status entry (`showStatus`), `addTotals`, `listCall`, `writeLogs`:
  they must keep counting every error, which is why the dedupe is safe.
- The R16 write-failure notice (`$.ui.toast(notice)`, line 166): it is not
  an R28 toast and keeps its own once-per-session rule.
- A backoff, a counter, or a time-based expiry: rejected (see "Why this
  matters" and "Maintenance notes").
- The `ui.open` options in the `/telltale` handler (R45 `holdToasts`), and
  anything else plan 012 changes in that handler.

## Git workflow

- Branch: `telltale/plan-013-toast-dedupe` (repo style is
  `<plugin>/<topic>`, e.g. `telltale/v0.3-ui` in `git log`)
- Conventional subject, matching `git log` (e.g.
  `fix(telltale): redact secret fields in any spelling`). For this plan:
  `feat(telltale): toast each failing tool once until the pane opens`
- Do NOT push or open a PR unless the operator instructed it

## Steps

### Step 1: The toasted-names atom

In `plugins/telltale/types/index.d.ts`, add to the `PluginState` telltale
interface, next to `toastedTurn` and plan 005's `deferred`:

```ts
      toastedNames: string[]; // R28: `<server>.<tool>:failed|large` already toasted since /telltale or /clear
```

and widen plan 005's `deferred` entry so the held toast carries its key:

```ts
      deferred: { turn: number; text: string; key: string } | null; // R28: a large-result toast held for its turn's end
```

In `plugins/telltale/hooks/register.tsx`, after the `deferredToast` atom:

```ts
// R28: a tool toasts once per kind until the person opens /telltale or runs /clear, so a
// flaky tool stops toasting every turn while another tool's first failure still does.
const toastedNames = atom({ plugin: 'telltale', key: 'toastedNames' } as const, []);
```

Also change the R47 comment above `NO_TOTALS` to end
"…the turn counter, the turn's toast and the tools already toasted."

**Verify**: `npm run validate` → fails only on the object literal in
`maybeToast`'s `deferredToast` update missing `key` (reported by
`claude plugin test` and/or `tsc`; `validate.mjs` runs both and counts
failures without stopping at the first). That is step 2's work. Any other
error: STOP.

### Step 2: Skip a repeat in `maybeToast`

Rewrite the post-005 `maybeToast` body so a repeat is skipped before it can
claim the turn's slot or be held:

```ts
/** R28: one toast per main-thread turn, for a counted call that failed or read 40,000+ chars. */
async function maybeToast($: EngineInterface, call: Captured) {
  if (!interactive || call.server === null) return;
  const large = call.text.length >= 40_000;
  if (!call.isError && !large) return;
  const name = serverTool(call.tool);
  const key = `${name}:${call.isError ? 'failed' : 'large'}`;
  // R28: a repeat stays quiet and leaves the turn's toast to another tool.
  if ((await read($, toastedNames)).includes(key)) return;
  if (!call.isError) {
    // R28: the error text wins, so the large-result toast is held for the turn's end.
    await update($, deferredToast, (held) =>
      held?.turn === call.turn
        ? held
        : {
            turn: call.turn,
            text: `${name} returned ~${formatTokens(estTokens(call.text.length))} tok`,
            key,
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
  await update($, toastedNames, (keys) => [...keys, key]);
  $.ui.toast(`${name} failed · /telltale`);
}
```

The key is added only when the toast actually shows. A failure that lost
the turn's slot to an earlier failure is not recorded, so it can still
toast in a later turn.

**Verify**: `npm run validate` → exit 0, every existing test green (no
existing test toasts the same tool and kind twice).

### Step 3: Record the held toast's key when it fires

Replace plan 005's turn-end block in `turn.complete` (the whole excerpt
from "Current state", comment line included) with this, which also puts
005's two unguarded `update` calls inside `safe` (R3):

```ts
// R28: the turn's held large-result toast, when no error took the turn's toast.
const held = await safe(() => read($, deferredToast));
if (held && held.turn === n) {
  await safe(async () => {
    await update($, deferredToast, () => null);
    let took = false;
    await update($, toastedTurn, (turn) => {
      took = turn !== n;
      return n;
    });
    if (!took || !interactive) return;
    $.ui.toast(held.text);
    // A toast held before a hot reload has no key (the pre-013 shape); skip recording it.
    if (held.key) await update($, toastedNames, (keys) => [...keys, held.key]);
  });
}
```

A held toast that an error displaced is not recorded, matching step 2.

**Verify**: `npm run validate` → exit 0.

### Step 4: Forget on `/telltale` and on `/clear`

In the `command.run` `telltale` handler, reset the memory once the pane
has actually opened. Which line depends on whether plan 012 has landed
(`grep -n "opened.isPlaced" plugins/telltale/hooks/register.tsx`):

- **012 has landed** (the grep finds lines): right after 012's
  `try { … } catch (error) { … }` and before
  `if (opened.isPlaced && next === 'calls') await focusRow($, newest);`, add

  ```ts
  // R28: the person looked; every tool may toast again. A pane left undrawn was not seen.
  if (opened.isPlaced) await safe(() => update($, toastedNames, () => []));
  ```

  A refused open already returned from the `catch`, so it resets nothing.

- **012 has not landed** (no match): right after the closing `});` of
  `await $.ui.open({ … });` and before
  `if (next === 'calls') await focusRow($, newest);`, add

  ```ts
  await safe(() => update($, toastedNames, () => [])); // R28: the person looked; every tool may toast again
  ```

  Plan 012, landing later, then wraps the open in its `try` and should
  turn this line into the `opened.isPlaced` form above.

The reset goes through `safe` so a failed state write can never stop
`/telltale` from answering.

In the `session.end` clear branch, inside the `later`-queued cleanup, next
to plan 005's `await update($, deferredToast, () => null);`, add:

```ts
await update($, toastedNames, () => []);
```

**Verify**: `npm run validate` → exit 0, and
`grep -n "toastedNames" plugins/telltale/hooks/register.tsx` → 6 lines: the
atom, the read and the add in `maybeToast`, the add in `turn.complete`, the
reset in `command.run`, the reset in `session.end`.

### Step 5: New tests

In the R28 block of `plugins/telltale/tests/register.test.ts`, after plan
005's tests, add:

```ts
test('R28: a tool that fails every turn toasts once, another tool still toasts', async ($, on) => {
  const world = worldOf(on);
  const kept = stateOf(on);
  await $.session.start(SESSION);
  for (const id of ['a', 'b', 'c']) {
    await callOne($ as never, world, id, 'mcp__db__run_query', 'boom', true);
    await endTurn($ as never, world);
  }
  expect(world.toasts).toEqual(['db.run_query failed · /telltale']);
  await callOne($ as never, world, 'd', 'mcp__github__search', 'nope', true);
  await endTurn($ as never, world);
  expect(world.toasts).toEqual([
    'db.run_query failed · /telltale',
    'github.search failed · /telltale',
  ]);
  expect(kept.get('toastedNames')).toEqual(['db.run_query:failed', 'github.search:failed']);
});

test('R28: a skipped repeat leaves the turn toast to a large result', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callOne($ as never, world, 'a', 'mcp__db__run_query', 'boom', true);
  await endTurn($ as never, world);
  await callOne($ as never, world, 'b', 'mcp__db__run_query', 'boom', true);
  await callOne($ as never, world, 'c', 'mcp__github__search', 'x'.repeat(60_000));
  await endTurn($ as never, world);
  expect(world.toasts).toEqual([
    'db.run_query failed · /telltale',
    'github.search returned ~15.0k tok',
  ]);
});

test('R28: opening /telltale lets a tool toast again', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callOne($ as never, world, 'a', 'mcp__db__run_query', 'boom', true);
  await endTurn($ as never, world);
  await run($ as never);
  await callOne($ as never, world, 'b', 'mcp__db__run_query', 'boom', true);
  await endTurn($ as never, world);
  expect(world.toasts).toEqual([
    'db.run_query failed · /telltale',
    'db.run_query failed · /telltale',
  ]);
});

test('R28: /clear lets a tool toast again', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callOne($ as never, world, 'a', 'mcp__db__run_query', 'boom', true);
  await endTurn($ as never, world);
  await $.session.end({ reason: 'clear', sessionId: 's1' } as never);
  await world.clock.settle();
  await callOne($ as never, world, 'b', 'mcp__db__run_query', 'boom', true);
  await endTurn($ as never, world);
  expect(world.toasts).toEqual([
    'db.run_query failed · /telltale',
    'db.run_query failed · /telltale',
  ]);
});
```

Then add these four, which pin the recording rules in steps 2 and 3 (that
a key is recorded only when its toast shows, and that the kind is part of
the key):

```ts
test('R28: a tool that returns a large result every turn toasts once', async ($, on) => {
  const world = worldOf(on);
  const kept = stateOf(on);
  await $.session.start(SESSION);
  for (const id of ['a', 'b']) {
    await callOne($ as never, world, id, 'mcp__github__search', 'x'.repeat(60_000));
    await endTurn($ as never, world);
  }
  expect(world.toasts).toEqual(['github.search returned ~15.0k tok']);
  expect(kept.get('toastedNames')).toEqual(['github.search:large']);
});

test('R28: a failure and a large result from one tool each toast', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callOne($ as never, world, 'a', 'mcp__github__search', 'nope', true);
  await endTurn($ as never, world);
  await callOne($ as never, world, 'b', 'mcp__github__search', 'x'.repeat(60_000));
  await endTurn($ as never, world);
  expect(world.toasts).toEqual([
    'github.search failed · /telltale',
    'github.search returned ~15.0k tok',
  ]);
});

test('R28: a failure that lost the turn toast is not remembered', async ($, on) => {
  const world = worldOf(on);
  const kept = stateOf(on);
  await $.session.start(SESSION);
  await callOne($ as never, world, 'a', 'mcp__db__run_query', 'boom', true);
  await callOne($ as never, world, 'b', 'mcp__github__search', 'nope', true);
  await endTurn($ as never, world);
  expect(kept.get('toastedNames')).toEqual(['db.run_query:failed']);
  await callOne($ as never, world, 'c', 'mcp__github__search', 'nope', true);
  await endTurn($ as never, world);
  expect(world.toasts).toEqual([
    'db.run_query failed · /telltale',
    'github.search failed · /telltale',
  ]);
});

test('R28: a held large result an error displaced is not remembered', async ($, on) => {
  const world = worldOf(on);
  const kept = stateOf(on);
  await $.session.start(SESSION);
  await callOne($ as never, world, 'a', 'mcp__github__search', 'x'.repeat(60_000));
  await callOne($ as never, world, 'b', 'mcp__db__run_query', 'boom', true);
  await endTurn($ as never, world);
  expect(kept.get('toastedNames')).toEqual(['db.run_query:failed']);
  await callOne($ as never, world, 'c', 'mcp__github__search', 'x'.repeat(60_000));
  await endTurn($ as never, world);
  expect(world.toasts).toEqual([
    'db.run_query failed · /telltale',
    'github.search returned ~15.0k tok',
  ]);
});
```

**Only if plan 012 has landed** (the `World` type in the test file has an
`openAnswer` field), also add the undrawn-open case:

```ts
test('R28: a /telltale pane left undrawn does not reset the toast memory', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callOne($ as never, world, 'a', 'mcp__db__run_query', 'boom', true);
  await endTurn($ as never, world);
  world.openAnswer = { value: { isPlaced: false, reason: 'narrow' } };
  await run($ as never);
  await callOne($ as never, world, 'b', 'mcp__db__run_query', 'boom', true);
  await endTurn($ as never, world);
  expect(world.toasts).toEqual(['db.run_query failed · /telltale']);
});
```

The kit's `ui.toast` stub records every call and nothing in the kit holds
toasts, so in "opening /telltale lets a tool toast again" the second
toast is recorded even though `run` opens
the pane with `holdToasts: true`.

**Verify**: `npm run validate` → exit 0 with the eight new tests (nine
after 012) passing and every existing test green.

### Step 6: README and version

- README "Toast" bullet (line 44, as rewritten by plan 005): append
  "Each tool toasts once for a failure and once for a large result; it
  toasts again after you open `/telltale` or run `/clear`. The status
  entry's `✗` count still counts every failure."
- **R28** (line 193, as rewritten by plan 005): before "the R16 notice does
  not count toward the limit", insert: "a `<server>.<tool>` that already
  toasted with the same text kind (failed or large) raises no toast until
  the next `/telltale` or `/clear`, and leaves the turn's toast to another
  call;". No new R-ID: this is part of
  the R28 toast rule.
- **R47** (line 212): change "the turn's toast, fired or held" to "the
  turn's toast, fired or held, the tools that already toasted".
- Bump `"version"` in `plugins/telltale/.claude-plugin/plugin.json` by one
  patch step from whatever it holds.

**Verify**: `npm run check` → exit 0.

## Test plan

- New tests: the eight in step 5 (nine once plan 012 has landed). The
  first is the behaviour this plan exists for (one tool failing three
  turns gives one toast; a second tool's first failure still toasts). The
  second pins the rule that a skipped repeat does not consume the turn's
  slot. The third and fourth pin the two resets. The next four pin the
  recording rules: a repeated large result (step 3's record), the kind as
  part of the key, a failure that lost the slot, and a displaced held
  toast. The ninth pins that an undrawn pane does not reset.
- Structural pattern: the existing R28 tests at
  `tests/register.test.ts:1330–1382` (`worldOf`, `stateOf`, `callOne`,
  `endTurn`, `world.toasts`), and plan 005's `/clear` test for the
  `session.end` call shape.
- Verification: `npm run validate` → exit 0; `npm run check` → exit 0.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run validate` → exit 0, the eight new tests (nine after 012)
      present and passing,
      and its output shows no `⚠` line skipping telltale's typecheck
- [ ] `npm run check` → exit 0
- [ ] `grep -n "toastedNames" plugins/telltale/hooks/register.tsx` → 6
      lines (atom, read, two adds, two resets)
- [ ] `grep -n "toastedNames" plugins/telltale/types/index.d.ts` → 1 line
- [ ] `grep -n "key: string" plugins/telltale/types/index.d.ts` finds the
      widened `deferred` entry
- [ ] `grep -n "toasts again after you open" plugins/telltale/README.md` → 1 line;
      R28 and R47 carry the new wording
- [ ] `git status` shows only in-scope files, plus the `site:data` regen
      and any plan files under `plans/` that were already untracked or
      modified before you started
- [ ] `plans/README.md` has a row for 013 with status `DONE`

## STOP conditions

Stop and report back (do not improvise) if:

- `deferredToast` is absent from `register.tsx` (plan 005 has not landed).
- `maybeToast` or the turn-end firing block differs from the post-005
  excerpts in a way beyond plan 011's Inventory edit nearby.
- After step 2, any existing test fails. No existing test repeats a tool
  and kind across turns; a failure means the dedupe is catching something
  it should not, not that the test is wrong.
- The `/telltale` handler matches neither shape step 4 describes (today's
  bare `await $.ui.open({ … });`, or plan 012's `try`/`catch` with
  `opened.isPlaced`).
- The "lost the turn toast" or "displaced" test fails because
  `toastedNames` holds `github.search:failed` or `github.search:large`
  after the first turn: the add has slipped before the `fresh`/`took`
  check. Fix the order in production code, not the test.

## Maintenance notes

- Overlaps: plan 005 owns the `maybeToast` body and the turn-end block this
  plan edits (hard dependency); step 3 also wraps 005's two state writes
  in `safe`. Plan 012 edits the same `/telltale` handler; step 4 covers
  both orders, and the rule is to reset only when `opened.isPlaced` (a
  refused or undrawn pane was not seen). Plan 011 edits the Inventory
  reload a few lines above the turn-end block. Plans 007, 010 and 008 (if
  present) may add atoms and `PluginState` keys in the same blocks as
  step 1.
- The memory lives in an atom, so a hot reload keeps it (R47). It grows by
  at most two entries per distinct MCP tool, and `/telltale` or `/clear`
  empties it.
- In the fullscreen layout the pane docks beside the transcript (R45) and
  stays open; after the person opens it once, a repeat failure stays quiet
  while the docked pane shows it live. That is intended.
- Deferred, deliberately: a time-based expiry (a tool that failed an hour
  ago toasting again). Add it only if someone reports missing a renewed
  outage; the status entry's `✗` count already moves on every failure.
- The earlier idea of an exponential global backoff (from a bundled
  "tips" pattern) was rejected: it backs off optional tips, while R28
  toasts are failure alerts, and a global counter would hide a new tool's
  first failure.
- What a reviewer should scrutinize: that the dedupe check sits before the
  `toastedTurn` claim and before the hold (so a repeat never eats the
  turn's slot), and that a key is recorded only next to an actual
  `$.ui.toast` call.

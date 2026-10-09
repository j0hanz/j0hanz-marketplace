# Plan 011: Reload the Inventory at turn end only while the pane is open

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report, do not improvise. When done, set this plan's status row in
> `plans/README.md` (add a row for 011 if the index has none yet), unless a
> reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat f3e7fb0..HEAD -- plugins/telltale/hooks/register.tsx plugins/telltale/tests/register.test.ts plugins/telltale/README.md plugins/telltale/.claude-plugin/plugin.json`
> Other plans touch these files and are expected drift: 002 (lint
> respellings), 004 (`session.end` else branch, which shifts every later line
> of `register.tsx` by about 25), 005 (a held-toast block inserted right
> after `await showStatus($);` in the same `turn.complete` tail, below the
> R43 block, which it does not change), 006 (one `safe` write after `writeLogs` inside
> `if (ready) {` in `turn.complete`), 007 and 010 (`turn.step`, `callResponse`), 012 (the
> `/telltale` command, and the `ui.open` stub in `worldOf`, which it changes
> to `return world.openAnswer as never;` while keeping the
> `world.opened.push(…)` line), and 013 (toast logic). Locate code by the
> excerpts, not by line numbers. If the R43 block itself or `openView` no
> longer match the excerpts below, or the `ui.open` stub in `worldOf` no
> longer contains the `world.opened.push(…)` line, treat it as a STOP
> condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW, the change only skips a local, read-only estimate when no
  pane can show it; a failed pane lookup keeps today's behavior
- **Depends on**: none (soft: 005 inserts lines next to the R43 block in the
  `turn.complete` tail but does not change it; either order works)
- **Category**: bug
- **Planned at**: commit `f3e7fb0`, 2026-10-09

## Why this matters

R43 in the README says "An open Inventory reloads Claude Code's estimate at
each main-thread turn end", and the design spec it came from
(`docs/plan/2026-10-08-telltale-ui/telltale-ui.delta.md:158`, gitignored and
out of scope, do not edit it) says "While the pane shows the Inventory
view". The code checks only the `view` atom, and that
atom outlives the pane: when the person presses Esc while the Inventory is
showing, `view` stays `'inventory'`, so every later main-thread turn end still
calls `$.session.usage({ breakdown: 'summary' })` and rewrites the `inventory`
atom for a pane nobody can see.

The cost is small and honest to state: one local estimate (no network
request) and one state write per turn, inside the `turn.complete` hook's time
budget. A closed pane gets no `ui.render`, so there are no wasted redraws. The
real gain is that the code does what R43 says again. Nothing is lost by
skipping the reload: every way back into the Inventory (`/telltale inventory`
and the `2` key) goes through `openView`, which loads fresh figures, and plain
`/telltale` resets the view to Calls.

Feasibility: confirmed. `$.ui.panes()` exists in the mod API and is the
engine's own record of the plugin's open panes, so it survives a hot reload
and also covers a pane dropped on unload, which a `ui.close` hook would miss.

## Current state

- `plugins/telltale/hooks/register.tsx`, the main module.
  - `const PANE = 'telltale';` (line 47) is the pane id.
  - `safe` (lines 98–104) runs work and returns `undefined` on any throw:

    ```ts
    const safe = async <T>(work: () => Promise<T> | T): Promise<T | undefined> => {
      try {
        return await work();
      } catch {
        return undefined;
      }
    };
    ```

  - `openView` (lines 274–279) is the only writer that sets `view` to
    `'inventory'` (the other writers, `register.tsx:756` and the `/clear`
    branch at `register.tsx:977`, set `'detail'` and `'calls'`), and it loads
    the Inventory itself whenever it is opened:

    ```ts
    /** Opens a view; the Inventory loads Claude Code's own estimate, which sends no request. */
    async function openView($: EngineInterface, next: View) {
      await update($, message, () => null); // R39: a message lasts until the view changes
      await update($, view, () => next);
      if (next === 'inventory') await loadInventory($);
    }
    ```

  - The `/telltale` command (lines 1152–1175) calls `openView` and then
    `$.ui.open({ id: PANE, …, closeOnEscape: true, … })`. Esc closes the pane
    in the engine; telltale has no `ui.close` hook and nothing resets `view`.
  - The R43 block in the `turn.complete` handler (handler starts at line
    995; block at lines 1078–1082). This is the only code this plan changes
    in `register.tsx`:

    ```ts
    // R43: an open Inventory reloads its estimate at each main-thread turn end, keeping its
    // figures when the reload fails (R22 as modified).
    if ((await safe(() => read($, view))) === 'inventory') {
      await safe(() => loadInventory($, 'keep'));
    }
    // R26, R27: the context share Claude Code reports now, or none; the plain call is free.
    const usage = await safe(() => $.session.usage());
    ```

    The `$.session.usage()` call right after it (no breakdown) runs every
    turn regardless and is out of scope.

- The mod API, `plugins/telltale/.claude-plugin/types/claude-code/index.d.ts`
  (generated and gitignored; it exists once the plugin has been loaded with
  `--plugin-dir`):
  - `panes: () => Promise<readonly UiPane[]>;` at line 2499. Its doc
    (lines 2488–2498): "Lists this plugin's own open panes (UiPane) … The
    engine's record, not the module's: a module reloaded while its pane
    stayed up finds it here. Another plugin's panes are not listed." Example
    from the doc: `const isUp = (await $.ui.panes()).some(pane => pane.id === "clock")`.
  - The op name for a test stub is `'ui.panes': NoArgs` (line 6979).
  - `UiPane` (line 14011) has five fields: `id: string`, `title: string`,
    `isShown: boolean`, `isFocused: boolean` and `isPlaced: boolean`.
  - `PaneCloseOrigin` (line 7315), whose doc says an `unload` close "is gone
    before the hooks hear of it, and its opener's hooks do not run". This is
    why the plan asks the engine at turn end instead of adding a `ui.close`
    hook.

- `plugins/telltale/tests/register.test.ts`, run by `claude plugin test`.
  - The `World` type (lines 8–29) and `worldOf` (lines 42–150) build an
    in-memory engine. The `ui.open` stub answers the open itself, without
    `next`, so the kit's own pane record never sees it (lines 108–111):

    ```ts
    on('ui.open', ($, e) => {
      world.opened.push({ id: e.id, focus: e.focus === true, holdToasts: e.holdToasts === true });
      return { value: { isPlaced: true } } as never;
    });
    ```

    There is no `ui.panes` stub today. Without one, `$.ui.panes()` would
    answer from the kit (probably an empty list), and the two existing R43
    tests would start failing. Step 1 adds the stub before the code changes.

  - The `session.usage` stub (lines 128–133) logs every call's breakdown in
    `world.usageCalls` (`'summary'`, `'full'`, or `'none'` for the plain
    per-turn call) and answers `{ deny }` when `world.usage` is an `Error`. A
    `deny` makes the `$` call reject, which is how the fail-open test in step
    3 simulates an unreadable pane list.
  - Helpers: `run($, args)` (line 635) runs `/telltale <args>`; `endTurn`
    (line 1284) drives an empty response plus `turn.complete` and settles the
    clock; `githubDb()` (line 1849) is a ready usage answer; the R21 test at
    line 934 shows the `world.usageCalls` assertion idiom
    (`expect(world.usageCalls).toEqual(['summary'])` right after
    `run($, 'inventory')`).
  - The existing R43 tests that must keep passing unchanged: "R43: the open
    Inventory reloads at turn end and shows a new server" (line 1908) and
    "R43, R22: a failed turn-end reload keeps the figures shown" (line 1922).

- `plugins/telltale/README.md`, the requirements index. Line 208:

  ```
  - **R43** An open Inventory reloads Claude Code's estimate at each main-thread turn end; measured rows keep their figures; a failed reload keeps the figures shown.
  ```

  R22 (line 187) cross-references R43 and needs no change. Source comments
  and test names cite R-IDs (`// R43: …`, `test('R43: …')`); keep doing so.

- `plugins/telltale/.claude-plugin/plugin.json`, `"version": "0.3.1"` at
  `f3e7fb0` (earlier plans bump it; bump from whatever it holds).

## Commands you will need

| Purpose      | Command                       | Expected on success                                       |
| ------------ | ----------------------------- | --------------------------------------------------------- |
| Plugin tests | `npm run validate`            | exit 0, runs `claude plugin test` including the new tests |
| Lint plugin  | `npx eslint plugins/telltale` | 0 problems once plan 002 has landed (see note)            |
| Full gate    | `npm run check`               | exit 0                                                    |

Note on the gate (from plan 002): until plan 002 lands, `npm run lint` does
not reach `plugins/**`, and `npm run validate` skips the telltale `tsc` with a
`⚠ … no generated types` line when `plugins/telltale/.claude-plugin/types/`
is missing. Before trusting a green validate, confirm that folder exists and
that the output has no `⚠` line for telltale; if it is missing, load the
plugin once with `claude --plugin-dir plugins/telltale` (CLAUDE.md, "Mods").
If plan 002 has not landed, skip the lint row.

Code snippets in this plan are shown at their own indentation; indent them to
match the code around them, then run `npx prettier --write` on the files you
edited. `npm run check` runs `prettier --check .`, which also covers `plans/`;
if it flags only other plan files, that is not this plan's fault, so report it
rather than reformatting them.

## Scope

**In scope** (the only files you should modify):

- `plugins/telltale/hooks/register.tsx`, the R43 block in `turn.complete`
  only
- `plugins/telltale/tests/register.test.ts`, the `World` type, `worldOf`
  (one field, one added line in the `ui.open` stub, one new `ui.panes`
  stub), and two new tests
  after the existing R43 tests
- `plugins/telltale/README.md`, the R43 index line
- `plugins/telltale/.claude-plugin/plugin.json`, the version

**Out of scope** (do NOT touch, even though they look related):

- A `ui.close` hook, or any new atom or module flag tracking whether the pane
  is open. The engine already keeps that record; a hook misses `unload`
  closes and a module flag is lost on a hot reload (R47).
- Resetting `view` when the pane closes. Reopening already goes through
  `openView`, and `/telltale` with no argument resets to Calls (R23).
- The plain `$.session.usage()` call after the R43 block (R26, R27 need it
  every turn).
- `openView`, `loadInventory`, `fetchRows`, `storeRows`,
  `measureInventory`.
- The `/telltale` command handler and its `isPlaced` handling (plan 012's
  scope).
- Toast logic (plans 005 and 013).
- `plugins/telltale/types/index.d.ts`: no new state, so no new type.

## Git workflow

- Branch: `telltale/plan-011-inventory-reload-when-open`
- One commit is enough. Conventional subject, matching `git log` (for
  example `fix(telltale): redact secret fields in any spelling`):
  `fix(telltale): reload the Inventory at turn end only while the pane is open`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Teach the test world about open panes

In `plugins/telltale/tests/register.test.ts`:

1. In the `World` type (lines 8–29), add after `opened`:

   ```ts
     panes: string[] | null; // the engine's open-pane ids; null makes $.ui.panes() fail
   ```

2. In `worldOf`'s initial object, add after `opened: [],`:

   ```ts
       panes: [],
   ```

3. Do not replace the `ui.open` stub. Add one line to it, directly after its
   `world.opened.push(…)` line, that records the pane once per id (reopening
   reuses the pane, so `/telltale` twice must not list it twice). Leave the
   stub's `return` line exactly as you find it.

   If plan 012 has not landed (the stub still ends with
   `return { value: { isPlaced: true } } as never;`), add:

   ```ts
   if (world.panes !== null && !world.panes.includes(e.id)) world.panes.push(e.id);
   ```

   If plan 012 has landed (the stub ends with
   `return world.openAnswer as never;` and `World` has an `openAnswer`
   field), a `{ deny }` answer means the pane was refused and is not open, so
   add this instead:

   ```ts
   const refused = (world.openAnswer as { deny?: unknown } | null)?.deny !== undefined;
   if (!refused && world.panes !== null && !world.panes.includes(e.id)) world.panes.push(e.id);
   ```

   A `{ value: { isPlaced: false } }` answer still counts as open: the pane
   exists in the engine, it just was not drawn.

   Then add a new `ui.panes` stub directly after the `ui.open` stub:

   ```ts
   on('ui.panes', () =>
     world.panes === null
       ? { deny: 'no pane list' }
       : ({
           value: world.panes.map((id) => ({
             id,
             title: id,
             isShown: true,
             isFocused: true,
             isPlaced: true,
           })),
         } as never),
   );
   ```

   No `ui.close` stub: a test closes the pane by emptying `world.panes`,
   which is exactly what the engine's record does on Esc, and telltale never
   calls `$.ui.close` itself.

If another plan landed first and already added a pane list or a `ui.panes`
stub to `worldOf`, reuse it instead of adding a second one, and adapt the
step 3 tests to its field name. If it cannot express "the lookup fails", add
only the `null` case to it. (At planning time no sibling plan adds one: 012
changes only the `ui.open` answer and 013 uses no pane state.)

**Verify**: `npm run validate` → exit 0, every existing test still passes
(nothing in `register.tsx` calls `$.ui.panes()` yet, so this step changes
only the test world).

### Step 2: Gate the reload on the engine's pane record

In `plugins/telltale/hooks/register.tsx`, replace the R43 block in the
`turn.complete` handler (the excerpt in "Current state") with:

```ts
// R43: an Inventory shown in the open pane reloads its estimate at each main-thread turn
// end, keeping its figures when the reload fails (R22 as modified). The `view` atom outlives
// a closed pane, so the engine's own pane record decides, which also survives a hot reload
// (R47); a record that cannot be read counts as open, so a lookup fault never skips a reload.
if (
  (await safe(() => read($, view))) === 'inventory' &&
  ((await safe(() => $.ui.panes()))?.some((pane) => pane.id === PANE) ?? true)
) {
  await safe(() => loadInventory($, 'keep'));
}
```

Notes:

- The `view` read comes first so a session on the Calls view pays no extra
  engine call.
- `?? true` is deliberate (fail open). `safe` returns `undefined` when
  `$.ui.panes()` throws, and the reload then runs as it does today. Do not
  change it to fail closed.
- Match on `id` only, not `isShown` or `isPlaced`: a pane behind another tab
  is still open, and R43 says "open".

**Verify**: `npm run validate` → exit 0; the two existing R43 tests (lines
1908 and 1922) pass unchanged, because step 1's stub lists the pane that
`run($, 'inventory')` opened.

### Step 3: Add the tests

In `plugins/telltale/tests/register.test.ts`, directly after the test
"R43, R22: a failed turn-end reload keeps the figures shown" (line 1922),
add:

```ts
test('R43: a closed Inventory does not reload at turn end', async ($, on) => {
  const world = worldOf(on);
  world.usage = githubDb();
  await $.session.start(SESSION);
  await run($ as never, 'inventory');
  expect(world.usageCalls).toEqual(['summary']);
  world.panes = []; // Esc: the engine drops the pane, the view atom stays 'inventory'
  await endTurn($ as never, world);
  expect(world.usageCalls.filter((call) => call === 'summary')).toHaveLength(1);
  await run($ as never, 'inventory'); // reopening loads fresh figures through openView
  expect(world.usageCalls.filter((call) => call === 'summary')).toHaveLength(2);
});

test('R43: an unreadable pane list still reloads the Inventory', async ($, on) => {
  const world = worldOf(on);
  world.usage = githubDb();
  await $.session.start(SESSION);
  await run($ as never, 'inventory');
  world.panes = null;
  await endTurn($ as never, world);
  expect(world.usageCalls.filter((call) => call === 'summary')).toHaveLength(2);
});
```

The first test is the regression this plan exists for; it fails if the gate
is removed (the turn end would add a second `'summary'`). The second pins the
fail-open choice; it fails if `?? true` becomes `?? false`. The plain
per-turn usage call logs `'none'`, which is why both filter for `'summary'`.

**Verify**: `npm run validate` → exit 0 with both new tests passing. Then,
as a one-off check that the first test bites, temporarily revert step 2's
condition to the original `=== 'inventory'` only, run `npm run validate`,
and confirm "R43: a closed Inventory does not reload at turn end" fails;
restore step 2 and rerun → exit 0.

### Step 4: README and version

- `plugins/telltale/README.md`, R43 index line (line 208 at `f3e7fb0`),
  replace with:

  ```
  - **R43** An Inventory shown in the open pane reloads Claude Code's estimate at each main-thread turn end; once the pane is closed, turn ends reload nothing until the Inventory is opened again, which loads it (R22); measured rows keep their figures; a failed reload keeps the figures shown.
  ```

- Bump `"version"` in `plugins/telltale/.claude-plugin/plugin.json` by one
  patch step from whatever it holds.

**Verify**: `grep -n "once the pane is closed" plugins/telltale/README.md` →
one match on the R43 line; `npm run check` → exit 0 (it may rewrite README's
generated regions through `site:data`; that is expected).

## Test plan

- New tests (step 3): a closed pane skips the turn-end reload and a reopen
  loads again; an unreadable pane list still reloads.
- Existing tests that must stay green unchanged: the two R43 tests at lines
  1908 and 1922, the R9 reopen test at line 667 (`world.opened` length 2;
  `world.panes` deduplicates, `world.opened` does not), and the R21 test at
  line 934 (`world.usageCalls` exact list). If plan 012 has landed, its R9
  tests (which set `world.openAnswer`, including a `{ deny }`) must stay
  green too.
- Structural pattern: model the new tests after "R43: the open Inventory
  reloads at turn end and shows a new server" (`tests/register.test.ts:1908`)
  for the setup and the R21 test at line 934 for the `world.usageCalls`
  assertions.
- Verification: `npm run validate` → exit 0, including 2 new tests.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run validate` → exit 0, with no `⚠` line for `plugins/telltale`,
      and the two new R43 tests present and passing
- [ ] `npm run check` → exit 0
- [ ] `grep -n "ui.panes()" plugins/telltale/hooks/register.tsx` → exactly
      one match, inside the R43 block of `turn.complete`
- [ ] `grep -n "on('ui.close'" plugins/telltale/hooks/register.tsx` → no
      match (no close hook was added)
- [ ] `grep -n "on('ui.panes'" plugins/telltale/tests/register.test.ts` →
      exactly one match
- [ ] `grep -n "once the pane is closed" plugins/telltale/README.md` → one
      match on the R43 line
- [ ] `git status` shows only in-scope files modified (plus any README
      generated-region rewrite from `site:data`)
- [ ] `plans/README.md` has a row for 011 (added if it was missing) with
      its status set

## STOP conditions

Stop and report back (do not improvise) if:

- The R43 block or `openView` do not match the excerpts in "Current state"
  beyond the line shifts listed in the drift check, or the `ui.open` stub in
  `worldOf` no longer contains the `world.opened.push(…)` line. (Its
  `return` line may differ: plan 012 changes it, and step 1 handles both
  forms.)
- `$.ui.panes` is missing from `plugins/telltale/.claude-plugin/types/claude-code/index.d.ts`,
  or `tsc` rejects `on('ui.panes', …)` in the tests (the API this plan rests
  on has changed).
- After step 1 any existing test fails (the stub must be invisible until
  step 2 uses it).
- After step 2 either existing R43 test fails: the kit is not routing
  `$.ui.panes()` to the `worldOf` stub. Report what `$.ui.panes()` returns
  in the kit rather than changing the fail-open default to make it pass.
- Another plan has already changed the turn-end reload condition (for
  example to add its own pane check), so this plan's edit would duplicate
  it.

## Maintenance notes

- Overlaps with sibling plans: 005 inserts its held-toast block just below
  this one in the same `turn.complete` tail (adjacent lines only, so no hard
  ordering); 006 adds one `safe` write after `writeLogs` inside `if (ready) {`
  earlier in the same handler;
  012 changes the `ui.open` stub's answer to `world.openAnswer`, which is why
  step 1 adds a line to that stub rather than replacing it; 013 resets its
  toast memory in `command.run` and uses no pane state. Any later plan that
  needs pane state should share this plan's `world.panes` stub rather than
  add another, and any production pane check should use `$.ui.panes()` the
  same way, not a module flag.
- The gate matches the pane by id only. If telltale ever opens more than one
  pane, or someone wants "visible" rather than "open" (`isShown`), revisit
  the predicate and R43's wording together.
- What a reviewer should scrutinize: that the fallback is `?? true` (a
  lookup fault must not skip a reload while the pane is up), and that no
  `ui.close` hook or new atom crept in.
- Deferred: resetting `view` on close. It would make the gate unnecessary
  for Esc, but not for an `unload` close (no hooks run) or for a hot reload,
  and reopening already reloads; not worth a second mechanism.

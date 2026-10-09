# Plan 005: Let a late error outrank the turn's large-result toast

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report, do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f3e7fb0..HEAD -- plugins/telltale/`
> This plan depends on plan 004, which restructures the `session.end`
> handler into an if/else. The excerpts below assume 004 has landed: the
> `clear` branch sits inside `if (e.reason === 'clear') { … } else { … }`.
> If the handler still matches the pre-004 shape (no `else` branch), plan
> 004 has not landed; execute it first. Other drift in in-scope files
> beyond plan 002's regex respellings and plan 003's list additions is a
> STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW, only which toast text fires changes; calls, logs and pane
  state are untouched
- **Depends on**: plans/004-telltale-write-between-turn-records.md (its
  `session.end` restructure is the shape this plan edits)
- **Category**: bug
- **Planned at**: commit `f3e7fb0`, 2026-10-09

## Why this matters

R28 allows at most one toast per main-thread turn and says "the error text
wins". Today that priority is enforced only within a single call
(`call.isError ? … : …`): across calls, the first qualifying call wins the
turn's toast slot. A large result (40,000 characters or more) that
completes before a slower failing call takes the slot, and the person is
never told the tool failed; the toast says `X returned ~15.0k tok` instead
of `Y failed · /telltale`. The only test happens to run the error call
first, so it passes by ordering, not by logic.

After this plan: an error toast fires as the call completes, as now; a
large-result toast is held until the turn ends and fires only when no error
toast fired that turn. An error can therefore never be hidden by a large
result, in either completion order.

## Current state

- `plugins/telltale/hooks/register.tsx`, the toast helper (lines 428–445).
  `toastedTurn` (atom declared at line 75) remembers which turn already had
  its toast; the first qualifying call claims it:

  ```ts
  /** R28: one toast per main-thread turn, for a counted call that failed or read 40,000+ chars. */
  async function maybeToast($: EngineInterface, call: Captured) {
    if (!interactive || call.server === null) return;
    const large = call.text.length >= 40_000;
    if (!call.isError && !large) return;
    let fresh = false;
    await update($, toastedTurn, (turn) => {
      fresh = turn !== call.turn;
      return call.turn;
    });
    if (!fresh) return;
    const name = serverTool(call.tool);
    $.ui.toast(
      call.isError
        ? `${name} failed · /telltale`
        : `${name} returned ~${formatTokens(estTokens(call.text.length))} tok`,
    );
  }
  ```

  It runs per completed call from the `later` queue in `tool.call`
  (lines 913–918), in result-arrival order.

- The turn number each call carries: `turn: turnNo + 1` at capture
  (line 909), which equals the `n` that `turn.complete` computes for that
  turn (`++turnNo` with the buffer swap, line 1003). So a call's `call.turn`
  and the completing turn's `n` are the same number.

- Where the turn ends: the `turn.complete` handler returns early for
  subagents (`if (e.agentId !== undefined) return r;`, line 997); the held
  toast must fire on the main thread only, after the pane updates, near the
  tail of the handler (lines 1078–1090):

  ```ts
  // R43: an open Inventory reloads its estimate at each main-thread turn end …
  if ((await safe(() => read($, view))) === 'inventory') {
    await safe(() => loadInventory($, 'keep'));
  }
  // R26, R27: the context share Claude Code reports now, or none; the plain call is free.
  const usage = await safe(() => $.session.usage());
  await safe(() => update($, totals, (t) => ({ ...t, ctx: usage?.context?.percent ?? null })));
  await showStatus($);
  // delta R6: a headless run shows nothing of its own. A line another hook set stays first.
  if (!interactive || line === null) return r;
  return { ...r, text: r.text === e.answer ? line : `${r.text}\n${line}` };
  ```

- The `session.end` `clear` branch (post-plan-004 shape): the `later`-queued
  cleanup that empties the pane on `/clear`. A held toast must be cleared
  there too, or a toast held for pre-clear turn `N` could fire after the
  clear when the new conversation reaches the same number `N` (turn
  numbering continues across `/clear`).

- State typing: `plugins/telltale/types/index.d.ts` declares the
  `PluginState['telltale']` interface (lines 49–69); every atom key must
  appear there or `npm run validate`'s `tsc` fails.

- The tests, `plugins/telltale/tests/register.test.ts` around lines
  1330–1382. The ordering-accident test:

  ```ts
  test('R28: one toast per turn, and an errored call gets the error text', async ($, on) => {
    const world = worldOf(on);
    const kept = stateOf(on);
    await $.session.start(SESSION);
    await callOne($ as never, world, 'a', 'mcp__db__run_query', 'boom', true);
    await callOne($ as never, world, 'b', 'mcp__github__search', 'x'.repeat(60_000));
    await endTurn($ as never, world);
    expect(world.toasts).toEqual(['db.run_query failed · /telltale']);
    expect(kept.get('toastedTurn')).toBe(1);
    await callOne($ as never, world, 'c', 'mcp__github__search', 'x'.repeat(60_000));
    await endTurn($ as never, world);
    expect(world.toasts).toEqual([
      'db.run_query failed · /telltale',
      'github.search returned ~15.0k tok',
    ]);
  });
  ```

  The helpers `callOne` (line 1268) and `endTurn` (line 1284) drive one
  counted call and one turn end; `stateOf(on)` (line 160) captures atom
  values by key. The `world.toasts` array collects every toast.

- README: the "Toast" bullet (line 44) and the **R28** index line
  (line 193) both state the rule; **R47** (line 212) lists what a hot
  reload keeps, including "the turn's toast".

## Commands you will need

| Purpose      | Command            | Expected on success                                       |
| ------------ | ------------------ | --------------------------------------------------------- |
| Plugin tests | `npm run validate` | exit 0, runs `claude plugin test` including the new tests |
| Full gate    | `npm run check`    | exit 0                                                    |

## Scope

**In scope** (the only files you should modify):

- `plugins/telltale/hooks/register.tsx`, `maybeToast`, the atoms block, the
  `turn.complete` tail, one line in the `session.end` clear branch
- `plugins/telltale/types/index.d.ts`, the `PluginState` interface
- `plugins/telltale/tests/register.test.ts`, the R28 block
- `plugins/telltale/README.md`, the Toast bullet, R28 and R47 lines
- `plugins/telltale/.claude-plugin/plugin.json`, the version

**Out of scope** (do NOT touch):

- `addTotals`, `showStatus`, `listCall`, the `later` queue, `writeLogs`
- The band, transcript-line and status-entry behavior
- The R16 write-failure notice (it is not a turn toast and must stay
  immediate)

## Git workflow

- Branch: `telltale/plan-005-toast-priority`
- Conventional subject, e.g. `fix(telltale): let a late error outrank the
turn's large-result toast`
- Do NOT push or open a PR unless the operator instructed it

## Steps

### Step 1: A held-toast atom

In `plugins/telltale/types/index.d.ts`, add to the `PluginState` telltale
interface (next to `toastedTurn`, line 65):

```ts
      deferred: { turn: number; text: string } | null; // R28: a large-result toast held for its turn's end
```

In `plugins/telltale/hooks/register.tsx`, after the `toastedTurn` atom
(line 75):

```ts
// R28: a large result's toast waits for its turn to end, so an error that lands
// later in the turn still takes the turn's one toast.
const deferredToast = atom({ plugin: 'telltale', key: 'deferred' } as const, null);
```

**Verify**: `npm run validate` → exit 0 (the interface and the atom must
agree before anything uses them).

### Step 2: Hold large-result toasts, fire error toasts

Replace the body of `maybeToast` so an error still claims the turn
immediately, while a large result is stored for the turn's end (first large
call of a turn wins the slot among large results):

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

**Verify**: `npm run validate` → the existing R28 tests now FAIL in one
spot: the second half of the test at line 1339 (a large call alone across
two turns) expects the toast right after `callOne`, and it now appears only
after `endTurn`. Do not weaken it; proceed to step 3, which makes the held
toast fire, then rerun. If any OTHER test fails here, STOP.

### Step 3: Fire the held toast at turn end

In the `turn.complete` handler, after the `showStatus($)` call and before
the `if (!interactive || line === null) return r;` line (see the tail
excerpt in "Current state"), add:

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

Notes: the `n` here is the same number the turn's calls carry (see "Current
state"), so `held.turn === n` matches exactly the calls of the turn that
just ended. Clearing `deferredToast` before the `toastedTurn` update keeps
the two atoms consistent if a redraw races the handler.

**Verify**: `npm run validate` → exit 0, all existing R28 tests pass again
(the large-alone case now fires at `endTurn`, which the test already awaits
before asserting).

### Step 4: Clear the held toast on `/clear`

In the `session.end` handler's `clear` branch, inside the `later`-queued
cleanup (next to `await update($, totals, () => NO_TOTALS);`), add:

```ts
await update($, deferredToast, () => null);
```

Without it, a toast held for pre-clear turn `N` fires when the new
conversation reaches turn `N` again, since numbering continues across
`/clear`.

**Verify**: `npm run validate` → exit 0.

### Step 5: New tests

In the R28 block of `plugins/telltale/tests/register.test.ts`, add:

```ts
test('R28: a large result that lands first never hides a later error', async ($, on) => {
  const world = worldOf(on);
  const kept = stateOf(on);
  await $.session.start(SESSION);
  await callOne($ as never, world, 'a', 'mcp__github__search', 'x'.repeat(60_000));
  await callOne($ as never, world, 'b', 'mcp__db__run_query', 'boom', true);
  await endTurn($ as never, world);
  expect(world.toasts).toEqual(['db.run_query failed · /telltale']);
  expect(kept.get('deferred')).toEqual(null);
});

test('R28: two large results in one turn raise one toast, the first', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callOne($ as never, world, 'a', 'mcp__github__search', 'x'.repeat(60_000));
  await callOne($ as never, world, 'b', 'mcp__db__run_query', 'y'.repeat(60_000));
  await endTurn($ as never, world);
  expect(world.toasts).toEqual(['github.search returned ~15.0k tok']);
});

test('R28: /clear drops a held toast with the turn it belonged to', async ($, on) => {
  const world = worldOf(on);
  const kept = stateOf(on);
  await $.session.start(SESSION);
  await callOne($ as never, world, 'a', 'mcp__github__search', 'x'.repeat(60_000)); // between turns
  await $.session.end({ reason: 'clear', sessionId: 's1' } as never);
  await world.clock.settle();
  await callOne($ as never, world, 'b', 'mcp__db__run_query', 'boom', true);
  await endTurn($ as never, world);
  expect(world.toasts).toEqual(['db.run_query failed · /telltale']);
  expect(kept.get('deferred')).toEqual(null);
});
```

The existing tests that must keep passing unchanged: the whole R28 block
(lines 1330–1382), including the headless test at 1375 (the held toast
never fires headless because `maybeToast` returns before setting it).

**Verify**: `npm run validate` → exit 0 with the three new tests passing
and every existing one green.

### Step 6: README and version

- README "Toast" bullet (line 44), after its first sentence add: "A failure
  toast shows as the call completes; a large-result toast waits for the
  turn to end, and shows only when no call failed that turn."
- **R28** index line (line 193), rewrite the middle to: "at most one toast
  per main-thread turn: a failed counted call's toast
  (`<server>.<tool> failed · /telltale`) shows when the call completes, and
  a call that returned 40,000 characters or more holds its toast
  (`<server>.<tool> returned ~<t> tok`) until the turn ends and shows only
  when no error toast showed that turn; the R16 notice does not count
  toward the limit."
- **R47** index line (line 212): change "the turn's toast" to "the turn's
  toast, fired or held".
- Bump `"version"` in `plugins/telltale/.claude-plugin/plugin.json` by one
  patch step from whatever it holds.

**Verify**: `npm run check` → exit 0.

## Test plan

- New tests: the three in step 5. The first is the regression this plan
  exists for (the exact order the old test accidentally avoided: large
  first, error second). The second pins the first-wins rule among large
  results. The third pins the `/clear` clearing added in step 4.
- Structural pattern: the existing R28 tests at
  `tests/register.test.ts:1330–1382` (`worldOf`, `stateOf`, `callOne`,
  `endTurn`, `world.toasts`).
- Verification: `npm run validate` → exit 0; `npm run check` → exit 0.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run validate` → exit 0, the three new tests present and passing
- [ ] `npm run check` → exit 0
- [ ] `grep -n "deferredToast" plugins/telltale/hooks/register.tsx` finds
      the atom, the hold in `maybeToast`, the fire in `turn.complete`, and
      the clear in `session.end`
- [ ] `grep -n "deferred" plugins/telltale/types/index.d.ts` finds the
      interface entry
- [ ] The README Toast bullet and the R28 and R47 lines carry the new
      wording
- [ ] `git status` shows only in-scope files (plus the `site:data` regen)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- After step 3, any existing test other than the one named in step 2's
  verify fails.
- The held toast fires in a headless test (the `interactive` guard in both
  `maybeToast` and the turn-end firing must prevent it).
- `held.turn === n` never matches in the kit (the numbers should coincide
  by construction; if they do not, print both in a scratch run and report
  rather than "fixing" the comparison).
- The `session.end` handler does not have the if/else shape from plan 004
  (plan 004 has not landed; execute it first).

## Maintenance notes

- A reload mid-turn keeps the held toast (it lives in an atom), which is
  why R47's line changes to "fired or held".
- A session that ends with a held toast never fires it; plan 004's exit
  write does not need to touch it, the session is over.
- If someone later wants the held toast to fire at `session.end`'s exit
  path, the `held.turn` there would be `turnNo + 1` (the number the
  between-turn calls carried), not the exit's `n`; do not reuse this code
  blindly.
- What a reviewer should scrutinize: that the error path still claims the
  turn immediately (an error must never wait), and that the `deferredToast`
  clear in the `/clear` branch is inside the `later` queue so work queued
  before the clear lands first.

# Plan 004: Write between-turn records when the session ends

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report, do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f3e7fb0..HEAD -- plugins/telltale/`
> Plans 002 and 003 may have landed first; 002 only rewrites regex character
> classes and 003 only adds list entries in `lib.ts`, neither touches the
> `session.end` handler this plan edits. If `plugins/telltale/hooks/register.tsx`
> lines 966–984 no longer match the excerpt below beyond that, treat it as a
> STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED, the change writes a turn file on a new code path; a wrong
  turn number would corrupt the numbering a resumed session continues from,
  which is why the step copies `turn.complete`'s number logic exactly
- **Depends on**: none (005 depends on this plan)
- **Category**: bug
- **Planned at**: commit `f3e7fb0`, 2026-10-09

## Why this matters

Telltale captures every counted call into a module-level `buffer` and writes
that buffer to `turn-<N>.jsonl` only when a main-thread `turn.complete`
fires. A call made after the last answer of a session, typically a
background subagent's call, belongs to a turn that never completes: when the
process exits, the buffer is dropped and the records are lost, even though
the pane showed the calls and the README calls the logs "the durable output".
R2 even promises such a call "counts in the next main turn that ends", but
at session end there is no next turn.

After this plan: `session.end` with any reason except `clear` writes the
buffer the same way `turn.complete` would have, under the turn number those
calls were captured for, so a resumed session continues numbering from
where these records left off.

## Current state

- `plugins/telltale/hooks/register.tsx`, the `session.end` handler (lines
  966–984). Today only `/clear` does anything; every other exit falls
  through to `return next(e)` and the module dies with the buffer unwritten:

  ```ts
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      pendingReason = 'clear';
      pending.clear(); // the cleared rows can never be relabelled
      stale.clear();
      // R26: work queued before the clear lands first, so nothing from before it counts after.
      await later(async () => {
        details.clear();
        await savePending($);
        await update($, calls, () => []);
        await update($, dropped, () => 0);
        await update($, view, () => 'calls');
        await update($, selected, () => null);
        await update($, totals, () => NO_TOTALS); // the old context's share goes too (R27)
        await showStatus($);
      });
    }
    return next(e);
  });
  ```

  The `clear` branch itself does not touch `buffer`, which is correct for
  `/clear` (the pane is emptied and no file should appear) and is why the
  fix is an `else` branch rather than a change to the shared path.

- The number logic to copy, from `turn.complete` (lines 998–1004). The
  number is taken with the buffer swap, before any await, and a failed write
  still consumes its number through the persisted `turnCount` atom (R34 as
  amended, and the comment at line 822: "a failed write uses up its number,
  which only the kept counter remembers"):

  ```ts
  const turn = buffer;
  buffer = { calls: [], skills: [], context: null };
  // R34: the number is taken with the swap, before any await, so a call that lands while this
  // turn ends is captured with the next number, matching the file it goes to.
  const hasRecords = turn.calls.length + turn.skills.length > 0;
  const n = hasRecords ? ++turnNo : turnNo;
  if (hasRecords) await safe(() => update($, turnCount, () => n)); // R47: kept across a reload
  ```

- The write path to reuse, `writeLogs` (lines 172–210): it takes
  `($, turn, done, n)`, writes `turn-<n>.jsonl` (or parts), and writes
  `context-<N>.json` when `turn.context` is non-null. `done` maps each call
  id to `{ next, used }`. It is already `safe`-wrapped at its call site.

- The labeling helper, `labelCalls` in `hooks/lib.ts` (lines 135–160), and
  its `LabelCall` shape `{ id, tool, agent, response }`:
  `response` is the index of the model response that issued the call within
  its agent's `responses` list, or null when no response streamed it. With
  `isRunning` returning false for every agent, a call whose agent produced
  a later complete response gets that response's real label, and one with
  no later response gets `aborted`, which is truthful at session end: every
  agent has stopped.

- `usedInAnswer` (R13, `lib.ts:169–173`): with no answer it returns an
  empty list, so `used: []` is the correct value at exit; no need to call it.

- Why `await settled` first: `settled` is the queue of pane bookkeeping
  queued by `tool.call` (lines 147–151). The capture itself
  (`buffer.calls.push(call)`) happens synchronously in `tool.call` before
  any queueing, so the buffer is already complete when `session.end` fires;
  awaiting `settled` keeps the ordering promise the rest of the file makes
  (the pane never sees a row missing) and costs nothing here.

- The engine's own contract (types at
  `.claude-plugin/types/claude-code/index.d.ts` around line 4388): the
  `session.end` hook runs inside "one short wall-clock bound"
  (`next.budget`). `turn.complete` already does the same writes inside its
  hook budget, and `write`'s catch (lines 160–168) turns a refused write
  into the one-per-session R16 notice (or a debug log, headless), so a
  budget overrun degrades exactly like a failed write.

- Test idioms in `plugins/telltale/tests/register.test.ts` (the harness
  builds an in-memory world; see lines 42–157):

  ```ts
  const callOne = async ($, world, id, tool, text, isError = false) => { … };  // one counted call, line 1268
  const endTurn = async ($, world) => {                                          // empty response + turn.complete
    await respond($, world, []);
    await complete($);
    await world.clock.settle();
  };
  // session.end is driven directly, e.g. line 1315:
  await $.session.end({ reason: 'clear', sessionId: 's1' } as never);
  // turn files and their lines, lines 198–206:
  const lines = (world, path) => …JSON.parse each line…;
  const turnFiles = (world) =>
    [...world.files.keys()].filter((path) => /\/turn-\d+(-part\d+)?\.jsonl$/.test(path)).sort();
  ```

  `endTurn` exists because a turn needs a complete model response before
  `turn.complete`; a between-turn call is exactly a `callOne` with no
  `endTurn` after it.

- README, "Logs" section (line 82) describes turn files and numbering; R5
  (line 170) promises only "a main-thread turn … writes that turn's
  records". Neither mentions what happens to records captured after the
  last turn; the loss was never documented, which is the gap this plan
  closes in both code and doc.

- `SessionEndReason` (engine types, around line 11012):
  `prompt_input_exit`, `clear`, `resume`, `logout`, `other`. Every reason
  except `clear` ends the conversation for good or swaps in a new one, so
  "not clear" is the right predicate; after a `resume` the new conversation
  continues numbering through the same persisted `turnCount`.

## Commands you will need

| Purpose      | Command            | Expected on success                                       |
| ------------ | ------------------ | --------------------------------------------------------- |
| Plugin tests | `npm run validate` | exit 0, runs `claude plugin test` including the new tests |
| Full gate    | `npm run check`    | exit 0                                                    |

## Scope

**In scope** (the only files you should modify):

- `plugins/telltale/hooks/register.tsx`, the `session.end` handler only
- `plugins/telltale/tests/register.test.ts`, new tests near the R5 block
- `plugins/telltale/README.md`, the Logs bullet on turn files, and the R5
  index line
- `plugins/telltale/.claude-plugin/plugin.json`, the version (bump the patch
  from whatever it holds at execution time)

**Out of scope** (do NOT touch):

- `writeLogs`, `labelCalls`, `toParts`, the `write` helper: they are reused
  as-is
- The `turn.complete` handler (plan 005 edits a different part of it)
- The `clear` branch's pane cleanup: `/clear` must keep writing nothing
- The `later`/`settled` queue mechanics

## Git workflow

- Branch: `telltale/plan-004-exit-records`
- Conventional subject, e.g. `fix(telltale): write between-turn records at
session end`
- Do NOT push or open a PR unless the operator instructed it

## Steps

### Step 1: Add the exit write to `session.end`

In `plugins/telltale/hooks/register.tsx`, extend the handler to:

```ts
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      … unchanged …
    } else {
      // A call made after the last turn's end belongs to a turn that never completes;
      // write its records here or they are lost with the process (README, Logs).
      await settled;
      const turn = buffer;
      buffer = { calls: [], skills: [], context: null };
      const hasRecords = turn.calls.length + turn.skills.length > 0;
      const n = hasRecords ? ++turnNo : turnNo; // R34: taken with the swap, like turn.complete
      if (hasRecords) await safe(() => update($, turnCount, () => n));
      if (!hasRecords) return next(e);
      const labels = labelCalls(
        responses,
        turn.calls.map((call) => ({
          id: call.id,
          tool: call.tool,
          agent: call.agentId ?? 'main',
          response: call.response,
        })),
        () => false, // the session is over: no agent is still running
      );
      const done = new Map(
        turn.calls.map((call) => [call.id, { next: labels[call.id] ?? 'aborted', used: [] }]),
      );
      await safe(() => writeLogs($, turn, done, n));
    }
    return next(e);
  });
```

Notes on the shape:

- `labelCalls` is already imported at the top of the file (line 27).
- `hasRecords` gates the write so a `/clear`-adjacent empty exit writes
  nothing (R5: a turn with no record writes nothing; R8 keeps writing
  context files only at turn ends).
- No pane updates: the session is over, there is nothing to relabel or
  show. The `pending` map dies with the process; nothing needs `forget`.

**Verify**: `npx eslint plugins/telltale` → 0 problems;
`npm run validate` → exit 0 (existing tests; new ones come next).

### Step 2: Add the tests

In `plugins/telltale/tests/register.test.ts`, next to the existing R5
tests (the pane-refused-write test is around line 451), add:

```ts
test('R5: a call made after the last turn is written when the session ends', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callOne($ as never, world, 'a', 'mcp__db__run_query', 'late');
  await $.session.end({ reason: 'other', sessionId: 's1' } as never);
  await world.clock.settle();
  expect(turnFiles(world)).toEqual([`${DIR}/turn-1.jsonl`]);
  expect(lines(world, `${DIR}/turn-1.jsonl`)[0]).toMatchObject({
    tool: 'mcp__db__run_query',
    next: 'aborted',
  });
});

test('R5: a between-turn call keeps the label of the response that followed it', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callOne($ as never, world, 'a', 'mcp__db__run_query', 'late');
  await respond($ as never, world, []); // a complete response names no tool
  await $.session.end({ reason: 'other', sessionId: 's1' } as never);
  await world.clock.settle();
  expect(lines(world, `${DIR}/turn-1.jsonl`)[0]).toMatchObject({ next: 'answered' });
});

test('R5: /clear still writes no turn file', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callOne($ as never, world, 'a', 'mcp__db__run_query', 'late');
  await $.session.end({ reason: 'clear', sessionId: 's1' } as never);
  await world.clock.settle();
  expect(turnFiles(world)).toEqual([]);
});
```

If the second test's `respond` call needs the `world.steps` plumbing exactly
as `callOne` sets it, mirror what `callOne` does (it pushes the tools then
drives the stream); `respond` is defined at line 173 and is what `callOne`
itself uses, so the call above is the established idiom.

**Verify**: `npm run validate` → exit 0 with the three new tests passing.

### Step 3: Document it in the README

- "Logs" section, after the `turn-<N>.jsonl` bullet (line 82), append one
  sentence to that bullet: "Records captured after the last turn of a
  session, such as a subagent's call after the final answer, are written to
  that turn's file when the session ends."
- Requirements index, **R5** (line 170), append: "; records that belong to
  a turn still in flight when the session ends are written at session end,
  under the number they were captured for".

**Verify**: read both lines back; they must not contradict R2 ("counts in
the next main turn that ends", which governs sessions that go on) or the
Known limits paragraph (line 135, reload losses, unchanged).

### Step 4: Version and gate

Bump `"version"` in `plugins/telltale/.claude-plugin/plugin.json` by one
patch step from whatever it holds (0.3.2 if plan 003 landed first).

**Verify**: `npm run check` → exit 0.

## Test plan

- The three tests in step 2: the exit write itself, the label of a call
  whose agent did respond (the `answered` case, which proves the `labelCalls`
  reuse is real and not a hardcoded `aborted`), and the `/clear` negative.
- Structural pattern: the existing R5 test at
  `tests/register.test.ts:451` (turn file written even when a pane-state
  write is refused) uses `worldOf`, `callOne`-style driving, `turnFiles` and
  `lines` exactly as above.
- Verification: `npm run validate` → exit 0; `npm run check` → exit 0.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run validate` → exit 0, with the three new tests present and
      passing
- [ ] `npm run check` → exit 0
- [ ] The `session.end` handler's `else` branch contains
      `++turnNo`, the `turnCount` update, and the `writeLogs` call, and the
      `clear` branch is byte-identical to before
- [ ] `grep -n "Records captured after the last turn" plugins/telltale/README.md`
      finds the new Logs sentence; the R5 line names session end
- [ ] `git status` shows only in-scope files (plus the `site:data` regen)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `session.end` excerpt above does not match the live handler (drift).
- Any existing test fails, especially the R17 tests (files already written
  stay) and the R16 write-failure tests: the new `else` branch must not
  change what `/clear` does.
- The test kit rejects `reason: 'other'` on `$.session.end` (it is in the
  engine's `SessionEndReason` union, but if the stub narrows it, try
  `'prompt_exit_exit'`'s actual spelling `'prompt_input_exit'` or
  `'resume'`, and report which worked).
- `writeLogs`'s signature has changed so the `done` map shape no longer
  fits (it would mean `turn.complete` drifted too; both callers must stay
  in sync).

## Maintenance notes

- Plan 005 (error toast priority) adds one line to the `clear` branch of
  this same handler (clearing a held toast); it depends on this plan and
  its excerpt shows the post-004 shape.
- The exit path reuses `labelCalls` with `isRunning: () => false`, so a
  subagent call pending at exit is written `aborted`, never `pending`. R12
  says "the written file keeps pending" for a turn whose agent list cannot
  be read; at session end that rule does not apply, because nothing can
  ever relabel the row again. If a reviewer prefers `pending` at exit,
  that is a one-line change in the `isRunning` argument, but `aborted` is
  the truthful label.
- A session that ends between turns after a `resume`-reason end writes
  nothing extra (the buffer belongs to the old conversation only when
  records were captured in it); the numbering still continues correctly
  through the persisted `turnCount`.
- What a reviewer should scrutinize: that the number logic (`++turnNo` and
  the `turnCount` update) is copied exactly, since a resumed session reads
  both the folder's file numbers and this counter at `session.start`
  (lines 816–823).

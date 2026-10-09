# Plan 012: /telltale reports a pane that was opened but not drawn

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report, do not improvise. When done, update this plan's status row in
> `plans/README.md` (add a row for 012 in the same format if the table has
> none yet), unless a reviewer dispatched you and told you they maintain the
> index.
>
> **Drift check (run first)**: `git diff --stat f3e7fb0 -- plugins/telltale/hooks/register.tsx plugins/telltale/tests/register.test.ts plugins/telltale/README.md plugins/telltale/.claude-plugin/plugin.json`
> (no `..HEAD`, so uncommitted edits from sibling plans show too).
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. Expected
> drift from sibling plans that touch the same files elsewhere is fine: plan
> 005 (`maybeToast`, `turn.complete` tail, `session.end`), plan 006 (one
> `safe` write after `writeLogs` in `turn.complete`, and `detailHeader`), plan 007 (`turn.step`,
> `callResponse`), plan 008 (`tool.check`, `tool.call`, the detail view),
> plan 011 (`turn.complete`) and plan 013 (toast logic, which adds one
> `toastedNames` reset line to the `command.run` handler between the
> `$.ui.open` call and the `focusRow` line; see Maintenance notes). Any
> other change to the `command.run` handler's `$.ui.open` / `focusRow` /
> `return` lines, or to the `ui.open` stub in `worldOf`, that does not match
> the excerpts below is a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW, only the reply text of `/telltale` changes, and only on two
  paths that today either lie (`opened`) or crash the hook
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `f3e7fb0`, 2026-10-09

## Why this matters

The reply to `/telltale` is the only signal the person gets that the pane
command worked. Today the handler throws away the result of `$.ui.open` and
always replies `opened`. The Claude Code API says an open can come back
`{ isPlaced: false, reason }`: the pane is open but waits undrawn, for
example in a session whose attached surface places no panes (an older
desktop). In that case the person reads `opened`, sees nothing, and
concludes telltale is broken. Separately, another plugin's `ui.open` hook may
refuse the pane with `{ deny }`, which rejects `$.ui.open`; the handler does
not catch that, so the hook throws, the engine skips it and reports a hook
failure instead of saying the pane was refused.

After this plan: a pane that was placed still replies `opened`; one that is
open but undrawn replies `pane opened but not drawn: <reason>`; one refused
by a hook replies `pane not opened: <error message>` (the engine's message,
which carries the hook's reason). Both cases are rare, so this
is a cheap honesty fix, not a feature.

Note on the source idea: the research lead assumed a refusing hook produces
`isPlaced: false`. The API types say otherwise (a refusal is `{ deny }`,
which rejects the call; see "Current state"), so this plan handles the two
cases separately. The idea's "Blast Radius band fallback" is deliberately
left out.

## Current state

- `plugins/telltale/hooks/register.tsx`, the main module. The `command.run`
  handler for `/telltale` (lines 1152–1175):

  ```ts
  // R9, R23, delta R6: `/telltale [calls|inventory]`.
  on('command.run', { command: 'telltale' }, async ($, e) => {
    await settled;
    if (!interactive) return { text: 'the pane needs an interactive session' };
    const raw = (e.args ?? '').trim();
    const wanted = raw.toLowerCase();
    const known = wanted === '' || wanted === 'calls' || wanted === 'inventory';
    const next: View = wanted === 'inventory' ? 'inventory' : 'calls';
    const list = (await $.state.get({ plugin: 'telltale', key: 'calls' })).value ?? [];
    const newest = list.at(-1)?.id ?? null;
    await update($, selected, () => newest);
    await openView($, next);
    await $.ui.open({
      id: PANE,
      title: 'telltale',
      focus: true,
      closeOnEscape: true,
      // R45: docked beside the transcript in the fullscreen layout, the pane stays open while
      // the person works, so toasts show; on the main screen it is a dialog and holds them.
      ...(e.presentation?.isFullscreen ? {} : { holdToasts: true as const }),
    });
    if (next === 'calls') await focusRow($, newest);
    return { text: known ? 'opened' : `unknown view "${raw}"; views: calls, inventory` };
  });
  ```

  The type imports from `'claude-code'` are at lines 5–12 (`EngineInterface`,
  `Register`, `RenderElement`, `RenderInput`, `RenderSurface`,
  `SessionUsage`); `UiOpenResult` is not imported yet.

- `focusRow` (register.tsx lines 238–241) already swallows errors:

  ```ts
  /** Puts the focus ring on a row; a pane without the keys answers `{ deny }`, which is fine. */
  async function focusRow($: EngineInterface, id: string | null) {
    if (id !== null) await $.ui.focus({ requestId: PANE, key: `row:${id}` }).catch(() => {});
  }
  ```

  Skipping it for an undrawn pane matters because `$.ui.focus` waits
  (bounded) for the site's next drawing before it denies (`UiFocusArgs.key`,
  api:13728-13732), so calling it on a pane that is not drawn only delays the
  reply. The selected row is still set by `update($, selected, …)` above, and
  the pane draws its focus from that when it is eventually seated.

- The API, in `plugins/telltale/.claude-plugin/types/claude-code/index.d.ts`
  (cited as api:N; this folder is gitignored and laid by loading the plugin
  once with `--plugin-dir`):
  - `$.ui.open` (doc comment api:2450-2471, signature
    `open: (pane: PaneOpenArgs) => Promise<UiOpenResult>` at api:2472): "One per id (an open id retitles; a
    `ui.open` hook may refuse)"; "@returns `{ isPlaced: true }` once drawn
    (or retitled), else `{ isPlaced: false, reason }` (UiOpenResult)"; and
    the example `if (!opened.isPlaced) $.ui.toast(...)`.
  - `'ui.open': PaneOpenArgs` (api:6966-6970): "a hook above the opener may
    retitle it or refuse it with `{ deny }`, never rename it."
  - `ValueOrDeny` (doc comment api:14514-14517, type from api:14518):
    "`{ deny }`, the reason the caller's promise rejects." In the test kit
    the rejection's message carries an engine prefix: a `{ deny:
'refused-by-test' }` answer reaches the handler as
    `telltale: $.ui.open: refused-by-test`.
  - `UiOpenResult` (api:13978-14001): `{ isPlaced: true } | { isPlaced:
false; reason: string }`. For `false`: "the pane is open but waits
    undrawn: opened unasked on a narrow terminal, or in a session whose
    attached surfaces place no panes." `reason` is a required string; "With
    no terminal measured and no surface attached (a bare `-p` run) this arm
    never comes back." (Telltale's `-p` path returns earlier anyway, at the
    `interactive` guard.)
  - A `command.run` hook that throws is skipped and the failure reported by
    name (api:3908-3910).

- `plugins/telltale/tests/register.test.ts`, the tests. The `World` type
  (lines 8–30) holds what the stubs beneath the plugin record or answer;
  `copyResult: unknown` (line 27, default `{ isCopied: true }` at line 62) is
  the precedent for a test-settable answer. The stubs in `worldOf`
  (lines 108–114):

  ```ts
  on('ui.open', ($, e) => {
    world.opened.push({ id: e.id, focus: e.focus === true, holdToasts: e.holdToasts === true });
    return { value: { isPlaced: true } } as never;
  });
  on('ui.focus', ($, e) => {
    return {};
  });
  ```

  The `ui.focus` stub is out of scope: the testing kit never routes
  `focusRow`'s `$.ui.focus` call to it (a reviewer's mutation check found it
  records nothing on any path), so it cannot prove the focus skip. The R9
  test to pattern after (lines 657–664):

  ```ts
  test('R9: /telltale opens a focused pane at 100 columns on the newest call', async ($, on) => {
    const world = worldOf(on);
    await $.session.start(SESSION);
    await callThrough($ as never, world, 'a');
    await callThrough($ as never, world, 'b');
    expect((await run($ as never)).text).toBe('opened');
    expect(world.opened).toEqual([{ id: 'telltale', focus: true, holdToasts: true }]);
    expect(focusOf((await draw($ as never)).buttons)).toBe('row:b');
  });
  ```

  `run` (line 635) invokes `/telltale` with optional args; `callThrough`
  (line 645) drives one counted call. The `agent.list` stub (lines 115–117)
  shows the `{ deny: '...' }` answer shape the kit accepts.

- `plugins/telltale/README.md`: the **R9** index line (line 174) reads
  "`/telltale` opens the pane at any width, or reuses and focuses it, showing
  the view R23 picks, with the newest row selected in Calls." The prose
  paragraph on the command's argument is line 52. No new requirement ID is
  needed; R9 is amended.

- `plugins/telltale/.claude-plugin/plugin.json`: `"version": "0.3.1"`
  (line 5) at the planned-at commit.

## Commands you will need

| Purpose      | Command            | Expected on success                                       |
| ------------ | ------------------ | --------------------------------------------------------- |
| Plugin tests | `npm run validate` | exit 0, runs `claude plugin test` including the new tests |
| Full gate    | `npm run check`    | exit 0                                                    |

Run both from the repo root, `C:/j0hanz-marketplace`. Until plan 002 lands,
the gate does not fully cover telltale: `eslint.config.js` ignores
`plugins/**`, so `npm run lint` never sees `register.tsx`, and
`scripts/validate.mjs` (lines 79–80) prints `⚠ … no generated types; load it
once with --plugin-dir to typecheck` and skips the plugin's `tsc` when
`plugins/telltale/.claude-plugin/types/` is absent. If you see that warning,
STOP (see STOP conditions): the type change in step 1 must be typechecked.

## Scope

**In scope** (the only files you should modify):

- `plugins/telltale/hooks/register.tsx`, the `'claude-code'` type import and
  the `command.run` handler only
- `plugins/telltale/tests/register.test.ts`, the `World` type, `worldOf`'s
  defaults and its `ui.open` stub, and new tests after the R9 tests
- `plugins/telltale/README.md`, the R9 line and the line-52 paragraph
- `plugins/telltale/.claude-plugin/plugin.json`, the version

**Out of scope** (do NOT touch):

- `focusRow`, `openView` and the `ui.focus` hook in `register.tsx`, and the
  `ui.focus` stub in `worldOf`
- Any toast or band fallback when the pane is not drawn (the reply is the
  signal; a toast would need its own R28 accounting)
- `plugins/telltale/hooks/lib.ts`, `plugins/telltale/types/index.d.ts`
  (no new state)
- `plans/README.md` beyond this plan's status row

## Git workflow

- Branch: `telltale/plan-012-pane-not-placed`
- Conventional subject, matching `git log` (for example `fix(telltale):
redact secret fields in any spelling`), e.g. `fix(telltale): say when the
pane opened but was not drawn`
- Do NOT push or open a PR unless the operator instructed it

## Steps

### Step 1: Keep the open result and reply honestly

In `plugins/telltale/hooks/register.tsx`:

1. Add `UiOpenResult` to the `import type { … } from 'claude-code'` list
   (lines 5–12), keeping the list alphabetical (after `SessionUsage`).
2. In the `command.run` handler, replace the `await $.ui.open({ … });` call,
   the `focusRow` line and the final `return` with this shape (the object
   passed to `$.ui.open` is unchanged, including the R45 comment):

   ```ts
   let opened: UiOpenResult;
   try {
     opened = await $.ui.open({
       id: PANE,
       title: 'telltale',
       focus: true,
       closeOnEscape: true,
       // R45: docked beside the transcript in the fullscreen layout, the pane stays open while
       // the person works, so toasts show; on the main screen it is a dialog and holds them.
       ...(e.presentation?.isFullscreen ? {} : { holdToasts: true as const }),
     });
   } catch (error) {
     // R9: a `ui.open` hook above telltale refused the pane with `{ deny }`.
     return { text: `pane not opened: ${error instanceof Error ? error.message : String(error)}` };
   }
   // R9: an undrawn pane has no rows to focus; the selection set above shows once it is seated.
   if (opened.isPlaced && next === 'calls') await focusRow($, newest);
   if (!known) return { text: `unknown view "${raw}"; views: calls, inventory` };
   // R9: open but waiting undrawn, e.g. no attached surface places panes; it is not gone.
   return { text: opened.isPlaced ? 'opened' : `pane opened but not drawn: ${opened.reason}` };
   ```

   Wording rules: the not-placed reply must not say "refused" or "not
   shown", because the pane stays open and is seated later (api:13987-13996).
   `reason` is a required string, so do not add `?? 'unknown'`. The unknown
   view text keeps priority over the not-placed text, as the more useful
   error. The refused reply keeps the error message whole, engine prefix
   included (`pane not opened: telltale: $.ui.open: <reason>`); do not strip
   it.

**Verify**: `npm run validate` → exit 0 with no `⚠ … no generated types`
line for telltale; every existing test passes unchanged (the stub still
answers `isPlaced: true`, so `R9` still gets `opened` and `R23` still gets
the unknown-view text).

### Step 2: Make the `ui.open` stub settable

In `plugins/telltale/tests/register.test.ts`:

1. In the `World` type (lines 8–30), add one field next to `copyResult`:

   ```ts
   openAnswer: unknown; // what the ui.open stub answers: `{ value }` or `{ deny }`
   ```

2. In `worldOf`'s defaults (next to `copyResult` at line 62), add
   `openAnswer: { value: { isPlaced: true } },`.
3. Change the `ui.open` stub to `return world.openAnswer as never;` (keep the
   `world.opened.push(…)` line). Leave the `ui.focus` stub alone.

**Verify**: `npm run validate` → exit 0, every existing test still passes
(the defaults reproduce today's answers exactly).

### Step 3: New tests

After the R9 tests (after the test ending at line 679), add:

```ts
test('R9: a pane opened but not drawn says so with the reason', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callThrough($ as never, world, 'a');
  world.openAnswer = { value: { isPlaced: false, reason: 'no attached surface places panes' } };
  expect((await run($ as never)).text).toBe(
    'pane opened but not drawn: no attached surface places panes',
  );
  expect(world.opened).toHaveLength(1);
});

test('R9: an unknown view still names the views when the pane is not drawn', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  world.openAnswer = { value: { isPlaced: false, reason: 'narrow' } };
  expect((await run($ as never, 'foo')).text).toBe('unknown view "foo"; views: calls, inventory');
});

test('R9: a pane a ui.open hook refuses is reported, not thrown', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  world.openAnswer = { deny: 'refused-by-test' };
  const text = (await run($ as never)).text ?? '';
  expect(text.startsWith('pane not opened: ')).toBe(true);
  expect(text).toContain('refused-by-test');
});
```

None of these tests can observe the skipped `focusRow` call: the kit does
not route `$.ui.focus` to the `ui.focus` stub. The Done criteria grep for
`opened.isPlaced && next === 'calls'` is the only guard on that line.

**Verify**: `npm run validate` → exit 0 with the three new tests passing.
If only the last assertion of the third test fails (the kit's rejection
message does not carry the deny text), see STOP conditions.

### Step 4: README and version

- **R9** index line (`plugins/telltale/README.md` line 174), append before
  the final full stop: "; if the pane opens but is not drawn (no attached
  surface places panes) the reply is `pane opened but not drawn: <reason>`,
  and if a `ui.open` hook refuses it the reply is `pane not opened: `
  followed by the engine's error message, which carries the hook's reason".
  Keep it one line.
- Line 52 paragraph (`/telltale [calls|inventory]` picks the view …), add
  one sentence at its end: "If the pane cannot be drawn, for example on a
  surface that places no panes, the reply says so and gives the reason."
- Bump `"version"` in `plugins/telltale/.claude-plugin/plugin.json` by one
  patch step from whatever it holds (0.3.1 → 0.3.2 if no sibling plan has
  bumped it yet).

**Verify**: `npm run check` → exit 0. It chains `site:data`, which may
rewrite the repo README's generated regions and `site/src/data`; those
changes are expected and belong in the commit.

## Test plan

- New tests: the three in step 3. The first is the case this plan exists
  for (placed `false` → honest reply). The second pins that the
  unknown-view error keeps priority. The third pins the `{ deny }` path,
  which today throws out of the hook.
- Not testable in the kit: that `focusRow` is skipped for an undrawn pane.
  The kit never delivers `$.ui.focus` to the `ui.focus` stub, so a recording
  stub stays empty whether or not the guard is there. The Done criteria
  grep is its only check; a reviewer should read that line.
- Structural pattern: the R9 test at `tests/register.test.ts:657-664`
  (`worldOf`, `callThrough`, `run`, `world.opened`), and the
  `world.copyResult` override used at line 1786 for a test-set stub answer.
- Verification: `npm run validate` → exit 0; `npm run check` → exit 0.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run validate` → exit 0, no `no generated types` warning for
      telltale, the three new tests present and passing
- [ ] `npm run check` → exit 0
- [ ] `grep -n "pane opened but not drawn" plugins/telltale/hooks/register.tsx plugins/telltale/README.md plugins/telltale/tests/register.test.ts`
      finds a match in each file
- [ ] `grep -n "pane not opened" plugins/telltale/hooks/register.tsx plugins/telltale/README.md`
      finds a match in each file
- [ ] `grep -n "opened.isPlaced && next === 'calls'" plugins/telltale/hooks/register.tsx`
      finds one match
- [ ] `git status` shows only in-scope files (plus the `site:data` regen)
- [ ] `plans/README.md` has a row for 012 showing its new status

## STOP conditions

Stop and report back (do not improvise) if:

- `npm run validate` prints `⚠ … no generated types` for telltale: the
  `UiOpenResult` import is then not typechecked. Report it; the operator
  loads the plugin once with `--plugin-dir plugins/telltale` (or lands plan
  002 first).
- `UiOpenResult` is not exported from `'claude-code'` in the laid types, or
  its shape differs from `{ isPlaced: true } | { isPlaced: false; reason:
string }`.
- After step 2, any existing test fails (the defaults must reproduce today's
  stub answers exactly).
- In step 3, a `{ deny }` answer from the `ui.open` stub does not reject
  `$.ui.open` in the kit (the third test gets `opened`), or the rejection
  message does not contain the deny text. Report what `error` holds; do not
  rewrite the reply to hide it.
- The `command.run` handler has gained lines between `$.ui.open` and the
  final `return` other than plan 013's single `toastedNames` reset (see
  Maintenance notes), and you cannot tell whether they should run for an
  undrawn or refused pane.

## Maintenance notes

- File overlaps with sibling plans: every telltale plan in this batch edits
  `register.tsx`, `tests/register.test.ts`, `README.md` and bumps
  `plugin.json`; resolve the version bump by taking the next patch step at
  merge time. Plan 013 (toast dedupe) resets its toast memory in this
  handler, and its Step 4 owns where that line goes. If 013 landed first,
  the handler has `await safe(() => update($, toastedNames, () => []));`
  right after the `$.ui.open({ … });` call. When you wrap the open in the
  `try`, put that line right after the `catch` block and before the
  `focusRow` line, as
  `if (opened.isPlaced) await safe(() => update($, toastedNames, () => []));`
  with 013's comment: exactly the form 013's Step 4 gives for "012 has
  landed". A refused open returns from the `catch` and resets nothing; an
  undrawn pane was not seen and resets nothing. If 013 lands after this
  plan, it adds that line itself. Do not move the reset above the open.
- An undrawn pane is still open: `$.ui.panes()` lists it with `isPlaced`
  false, and the engine seats it later. Nothing here re-focuses the row then;
  the draw's `autoFocus` on the `selected` row covers it.
- A reviewer should check that the `opened` reply is unchanged for the
  normal path (the R9 test proves it) and that no "refused" or "not shown"
  wording leaked into the not-placed reply.
- Deferred: a toast or band fallback when the pane is not drawn (as the
  Blast Radius sample does). Asked opens are placed at any width, so the
  only not-placed case is a surface that places no panes, where a toast may
  not show either; the command reply is enough.

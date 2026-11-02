# Plan 017: Telltale test fixes for the 2.1.299 plugin-test harness

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `claude plugin test plugins/telltale` and the `npm run check` gate green again under Claude Code 2.1.316, whose plugin-test harness changed two behaviors at 2.1.299.

**Architecture:** Three tasks, all in test code plus one README clause. Task 1 teaches the six exact-tree assertions the `part` tag the harness now adds to `ui.render` roots. Task 2 follows the engine's own `tool.check` answer where tests assumed no verdict: two expectations and one R50 spec clause. Task 3 is the full gate and the plans ledger. No production file changes.

**Tech Stack:** `claude plugin test` (mods harness, `claude-code/testing`), TypeScript test files, the repo's `npm run check` gate (lint + format:check + validate + typecheck + test). Branch `telltale/plan-017-harness-299`, worktree per `superpowers:using-git-worktrees` at execution start.

**Spec:** this file's "Diagnosis" section; there is no separate spec. Every task derives from it.

## Diagnosis (the spec)

`claude plugin test plugins/telltale` fails 8 of 225 tests at `main` (`2d3907d`) and at the pre-refactor `6aa8e8f` alike (both run under CLI 2.1.316 in clean worktrees), so the cause is the harness, not telltale's source. Two harness changes, one per failure family:

1. **`part` tag (6 tests, 7 assertions).** Claude Code 2.1.299 changed `ui.render` trees in `claude plugin test`: "each mod's Box or Text root now carries `part: { plugin }` naming the mod", and "exact-tree assertions must include it" (CHANGELOG.md, 2.1.299). The engine row the tests stub at `register.test.ts:179` comes back from `next(e)` as the test plugin's own root: `{ type: 'Text', children: [''], part: { plugin: 'test' } }`. Every exact `toEqual` against the bare `ENGINE_ROW` (`register.test.ts:2388`) fails: lines 2407, 2426-2428, 2471, 2483, 2486, 2488-2489, 2491, 2500, 2535.

2. **Engine-default `tool.check` verdict (2 tests).** `$.tool.call` now raises the `tool.check` chain with the call's `tool_use_id`, and with no handler beneath, the engine's own tier answers `{ decision: 'allow' }` where it once gave no verdict (confirmed by probe: a recording `on('tool.check')` stub saw the id arrive from a bare `$.tool.call`). Telltale's pass-through `tool.check` hook (`register.tsx:930-935`) records it, and the capture reads it back (`register.tsx:957-959`, written at line 982), so:
   - **R11** (`register.test.ts:916`): a verdict-less call's detail note now reads `no permission dialog or classifier in this time`, not `duration includes any permission prompt`.
   - **R50** (`register.test.ts:2715-2721`): the turn record logs `permission: "allow"`, not `null`.

   A call of a current engine always carries a verdict; `null` is only for an engine that raises no `tool.check` at all. The unknown-verdict branches stay in production code, unit-pinned by `lib.test.ts:501` (`permissionNote()`); the harness can no longer reach them.

Production code (`register.tsx`, `lib.ts`) is correct as written and untouched by this plan. The changelog documents family 1; family 2 is undocumented in any changelog entry through 2.1.316.

## Global Constraints

- Gate: `npm run check` green before the branch lands (no CI).
- No production changes: `register.tsx` and `lib.ts` untouched; `plugin.json` stays `0.4.0`, since no new requirement ID is claimed.
- Keep exact `toEqual` on trees; do not loosen to `toMatchObject`, because the suite's style pins whole trees.
- Never hand-edit README's generated regions (`install`/`copilot`/`antigravity`/`plugins`); R50 at `plugins/telltale/README.md:240` is outside them.
- Conventional subjects, scoped `telltale` for code commits.
- Worktree note: `plugins/telltale/.claude-plugin/types/` is gitignored; copy it from the main checkout into the worktree (the bisect run needed this) or re-lay it with `--plugin-dir`.

## Review Focus

1. The tag names the mod whose answer the element is: the stub's owner, `test`, not `telltale`. A wrong name in `ENGINE_ROW` fails all 12 assertions; Task 1 Step 2 catches it.
2. Engine-default allow must record no rule. Task 2 asserts `permissionRule` absent (mirrors `register.test.ts:2709`).
3. R11's fix must not weaken its navigation pin: only the note expectation at line 916 changes; `b returns with the same call selected` stays. Task 2 Step 4 re-proves the whole test.
4. The unknown-verdict branches (`permissionNote(undefined)`, `permission: null`) must not get deleted as "unreachable": they are unit-pinned by `lib.test.ts:501` and this plan forbids production edits.
5. A truncated output window hid the 8th failure for two full runs. Verify with complete fail lists (`Select-String '^\(fail\)'`), never head/tail windows. Task 3 Step 1.

---

### Task 1: Expect the `part` tag on `ui.render` roots

**Files:**

- Modify: `plugins/telltale/tests/register.test.ts:2386-2388`

**Interfaces:**

- Consumes: nothing from other tasks.
- Produces: `ENGINE_ROW = { type: 'Text', children: [''], part: { plugin: 'test' } }`, consumed by the 12 assertions at lines 2407, 2426-2428, 2471, 2483, 2486, 2488-2489, 2491, 2500, 2535 (line numbers from the pre-edit file).

- [ ] **Step 1: Update the const at `register.test.ts:2388`**

Keep the comment line above it (2387, `// v0.3: the transcript line, the docked pane and drawing faults (R44, R45, R46).`), change the const to:

```ts
// 2.1.299 tags each ui.render tree root in claude plugin test with part: { plugin }
// naming the mod whose answer it is; the stub's engine row is the test plugin's root.
const ENGINE_ROW = { type: 'Text', children: [''], part: { plugin: 'test' } };
```

- [ ] **Step 2: Run the suite and verify the fail list shrank to exactly two**

```powershell
claude plugin test plugins/telltale 2>&1 | Select-String -Pattern '^\(fail\)'
```

Expected: exit 1, exactly two lines: `R11: a row opens its detail, and b returns with the same call selected` and `R50: a call with no verdict logs permission null`. Any `R44`/`R46` line remaining means the tag name or shape is wrong.

- [ ] **Step 3: Commit**

```powershell
git add plugins/telltale/tests/register.test.ts
git commit -m "test(telltale): expect the part tag on ui.render roots in plugin tests"
```

### Task 2: Follow the engine's own `tool.check` verdict

**Files:**

- Modify: `plugins/telltale/tests/register.test.ts:916`
- Modify: `plugins/telltale/tests/register.test.ts:2715-2721`
- Modify: `plugins/telltale/README.md:240` (R50, first sentence's parenthetical)

**Interfaces:**

- Consumes: `lines(world, path)` returning parsed records (used as `const [record] = lines(...)` at line 2707), `callThrough($, world, id)`, `endTurn($, world)`, `worldOf(on)`, `SESSION`, all unchanged.
- Produces: nothing downstream.

- [ ] **Step 1: Fix the R11 note expectation at line 916**

```ts
expect(detail.text).toContain('no permission dialog or classifier in this time');
```

The note strings are `lib.ts:434-436`; copy them exactly.

- [ ] **Step 2: Rewrite the R50 test at lines 2715-2721**

```ts
// 2.1.299+: $.tool.call raises tool.check and the engine's own tier answers allow
// where it once gave no verdict, so a call of a current engine always carries one;
// null is only for an engine that raises no tool.check at all (R50).
test('R50: a call nothing beneath answers is allowed by the engine and logs no rule', async ($, on) => {
  const world = worldOf(on);
  await $.session.start(SESSION);
  await callThrough($ as never, world, 'a');
  await endTurn($ as never, world);
  const [record] = lines(world, `${DIR}/turn-1.jsonl`);
  expect(record!.permission).toBe('allow');
  expect(Object.keys(record!)).not.toContain('permissionRule');
});
```

- [ ] **Step 3: Amend the R50 parenthetical at `plugins/telltale/README.md:240`**

Replace `(`allow`, `ask`or`deny`, null when none was seen)` with `(`allow`, `ask`or`deny`; null when none was seen: a current Claude Code's own tier answers every call, so `null`is only for an engine that raises no`tool.check`)`. Change nothing else on the line.

- [ ] **Step 4: Run the suite and verify it is fully green**

```powershell
claude plugin test plugins/telltale 2>&1 | Select-String -Pattern '^\(fail\)|pass$|fail$'
```

Expected: exit 0, `225 pass`, `0 fail`, no `(fail)` line.

- [ ] **Step 5: Commit**

```powershell
git add plugins/telltale/tests/register.test.ts plugins/telltale/README.md
git commit -m "test(telltale): follow the engine's own tool.check verdict"
```

### Task 3: Full gate and plans ledger

**Files:**

- Modify: `plans/README.md` (add row 017 to the table)
- Add: this plan file to the branch's ledger commit

**Interfaces:**

- Consumes: Tasks 1 and 2 landed on the branch.
- Produces: a green `npm run check` at the branch head; ledger row 017.

- [ ] **Step 1: Run the gate and inspect the complete failure output if red**

```powershell
npm run check
```

Expected: exit 0. If red, list every failure: the earlier steps proved the telltale suite green, so anything red here is fallout from these edits (lint, format, validate, typecheck); fix that fallout only, never paper over it. If `format:check` is red on the touched files, run `npx prettier --write` on them and re-run the gate.

- [ ] **Step 2: Add row 017 to the table in `plans/README.md`**

After the 016 row, add (fill the branch commit when known):

```markdown
| 017 | [Telltale test fixes for the 2.1.299 plugin-test harness](017-telltale-harness-299-tests.md) | P1 | S | none | DONE (branch `telltale/plan-017-harness-299`; clears the 8 red `claude plugin test` failures rows 015 and 016 carried; `npm run check` green) |
```

- [ ] **Step 3: Commit the ledger**

```powershell
git add plans/README.md plans/017-telltale-harness-299-tests.md
git commit -m "docs: record plan 017 and clear the telltale test gate"
```

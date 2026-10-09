# Plan 002: Make `npm run check` actually check the telltale plugin

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report, do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f3e7fb0..HEAD -- eslint.config.js scripts/validate.mjs plugins/telltale/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S to M (the M is only if lint fixes turn out non-mechanical)
- **Risk**: MED, the lint fixes touch live regexes in the redaction engine; every fix must keep the matched character set exactly equivalent, and the existing tests are the proof
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `f3e7fb0`, 2026-10-09

## Why this matters

The repo has no CI; `npm run check` is the only pre-merge gate. Today that
gate silently skips the telltale plugin in two of its legs:

1. **Lint never reaches it.** `eslint.config.js` globally ignores `plugins/**`,
   so the 1,247-line `hooks/register.tsx` and the redaction engine in
   `hooks/lib.ts` are never linted, for the author or any contributor. A
   `debugger` or a JSX `key` lapse passes `npm run check` forever.
2. **Typecheck is skipped with a warning.** When
   `plugins/telltale/.claude-plugin/types/` is absent (any fresh clone; the
   folder is gitignored and laid by Claude Code on first load, see
   `CLAUDE.md`, "Mods"), `scripts/validate.mjs` prints a `⚠` line and skips
   `tsc -p` entirely, then exits 0. Nothing else typechecks the plugin: the
   root `tsconfig.json` includes only `site/src` and `vite.config.mts`.

A third, smaller gap: when the `claude` CLI is missing, validate fails with
raw shell noise (`'claude' is not recognized…`) once per catalog target
instead of one clear message.

After this plan: `npm run lint` covers telltale, a missing types folder fails
`npm run validate` with an actionable message, and a missing `claude` fails
with one line saying what to install.

## Current state

- `eslint.config.js`, lint config. Global ignores (lines 28–37):

  ```js
  export default [
    {
      ignores: [
        'node_modules',
        'dist',
        'site/src/data',
        'plugins/**',
        'scripts/build-site-data.mjs',
        'scripts/validate.mjs',
      ],
    },
  ```

  The shared rules block (lines 38–63) already parses `.ts`/`.tsx` via babel
  presets, with `react`, `react-hooks`, `regexp` (recommended configs at
  lines 71–72) and `de-morgan` plugged in. No other change is needed for the
  plugin to be lintable. `scripts/validate.mjs` and
  `scripts/build-site-data.mjs` stay ignored, out of scope.

  Note: prettier is NOT part of the gap. `.prettierignore` covers only
  `node_modules`, `package-lock.json`, `site/src/data`, `dist`, so
  `npm run format:check` already formats plugin files.

- `scripts/validate.mjs`, the gate's validate leg. Relevant regions:

  Lines 20–28 (the `claude` invocations, no `onPath` guard):

  ```js
  // shell: true — `claude` and `copilot` are .cmd shims on Windows.
  const run = (bin, args, env) =>
    spawnSync(bin, args, { stdio: 'inherit', shell: true, env: { ...process.env, ...env } });
  const onPath = (bin) =>
    spawnSync(bin, ['--version'], { stdio: 'ignore', shell: true }).status === 0;

  for (const target of ['.', ...sources]) {
    if (run('claude', ['plugin', 'validate', target, '--strict']).status !== 0) failed++;
  }
  ```

  Lines 73–82 (the mod leg; the `console.warn` is the typecheck hole):

  ```js
  // A plugin whose hooks.json names a hooks module (a mod) ships `*.test.ts` files that only
  // `claude plugin test` can run, and a typecheck that needs the types the engine lays on load.
  for (const source of sources) {
    const hooks = join(source, 'hooks', 'hooks.json');
    if (!existsSync(hooks) || !JSON.parse(readFileSync(hooks, 'utf8')).modules) continue;
    if (run('claude', ['plugin', 'test', source]).status !== 0)
      fail(`${source}: claude plugin test`);
    if (!existsSync(join(source, '.claude-plugin', 'types'))) {
      console.warn(`⚠ ${source}: no generated types; load it once with --plugin-dir to typecheck`);
    } else if (run('npx', ['tsc', '-p', source]).status !== 0) fail(`${source}: tsc`);
  }
  ```

  The Copilot leg already shows the right pattern for a missing binary
  (lines 86 and 104–106): `if (onPath('copilot')) { … } else { console.log('copilot not on PATH: …') }`.

- `tsconfig.json` (repo root), `"include": ["site/src", "vite.config.mts"]`
  (line 28). The plugin's own `plugins/telltale/tsconfig.json` extends the
  generated `.claude-plugin/types/tsconfig.json`, which includes
  `../../hooks`, `../../types`, `../../tests`. That `tsc -p` run inside
  validate is the only typecheck telltale ever gets.

- **Lint fallout, measured on 2026-10-09** with
  `npx eslint plugins/telltale --no-ignore`: exactly 15 errors, 0 warnings,
  12 auto-fixable. The complete list (keep it as the expected inventory):

  ```text
  hooks/lib.ts
    67:11  regexp/prefer-w           [A-Za-z0-9_] → \w
    68:7   regexp/prefer-w           [A-Za-z0-9_] → \w
    70:15  regexp/prefer-w           [A-Za-z0-9_] → \w
    73:8   regexp/prefer-w           [0-9A-Za-z_] → \w
    74:7   regexp/prefer-w           [A-Za-z0-9_] → \w
    74:26  regexp/prefer-w           [A-Za-z0-9_] → \w
    74:42  regexp/prefer-w           [A-Za-z0-9_] → \w
    76:27  regexp/prefer-w           [A-Za-z0-9_] → \w (twice on one line)
   164:13  regexp/prefer-w           [A-Za-z0-9_.:/-] → \w form
   164:31  regexp/use-ignore-case    [^A-Za-z0-9_.:/-] simplify
   456:66  regexp/use-ignore-case   [A-Za-z] in isAbsolute simplify
  hooks/register.tsx
   989:66  de-morgan/no-negated-conjunction  !('skip' in r && r.skip)
  tests/register.test.ts
   206:55  regexp/no-unused-capturing-group
   504:36  regexp/use-ignore-case    [A-Za-z] simplify
  ```

  These lines are the secret-pattern regexes in `hooks/lib.ts` (lines 66–76:
  `SECRET_PATTERNS`, `BEARER`), the value-extraction regexes at `lib.ts:164`
  (inside `values`, used by `usedInAnswer`), `isAbsolute` at `lib.ts:456`,
  the compaction guard at `hooks/register.tsx:989`, and two regexes in the
  test file. All are character-class simplifications or one boolean
  rewrite, no logic change. **Do not** let any fix change what a regex
  matches: `[A-Za-z0-9_]` → `\w` is exact; a `use-ignore-case` fix must keep
  the matched set identical (the `i`-flag form of a class holding both
  cases).

## Commands you will need

| Purpose          | Command                       | Expected on success                   |
| ---------------- | ----------------------------- | ------------------------------------- |
| Lint (gate leg)  | `npm run lint`                | exit 0 (after step 4)                 |
| Lint plugin only | `npx eslint plugins/telltale` | 15 problems (step 1), then 0 (step 4) |
| Validate + tests | `npm run validate`            | exit 0                                |
| Full gate        | `npm run check`               | exit 0                                |

`npm run check` chains `site:data` (through `typecheck`), which rewrites the
generated regions of the root `README.md` and `site/src/data/marketplace.json`.
Commit whatever it regenerates; that is expected, not a stray change.

## Scope

**In scope** (the only files you should modify):

- `eslint.config.js`, the ignores array only
- `scripts/validate.mjs`, the `claude` guard and the types check
- `plugins/telltale/hooks/lib.ts`, `plugins/telltale/hooks/register.tsx`,
  `plugins/telltale/tests/register.test.ts`, lint fixes at the exact lines
  listed above, nothing else
- Root `README.md`, `site/src/data/marketplace.json`, only as regenerated by
  `npm run check`'s `site:data` step

**Out of scope** (do NOT touch):

- Every other plugin's lint status. `'plugins/**'` stays ignored for them;
  extending coverage to `workbench`, `writeup` and the rest is a separate
  decision (their fallout is ~64 more errors, measured 2026-10-09)
- `scripts/validate.mjs`'s and `scripts/build-site-data.mjs`'s own lint status
- The redaction engine's behavior (no new patterns here; that is plan 003)
- `plugins/telltale/.claude-plugin/types/**`, generated, stays lint-ignored

## Git workflow

- Branch: `telltale/plan-002-check-gate` (repo style is `<plugin>/<topic>`,
  e.g. `telltale/v0.3-ui` in `git log`)
- One commit per logical unit, conventional subjects scoped like the repo's
  own: `chore(eslint): lint the telltale plugin`, `fix(scripts): fail
validate without generated plugin types`
- Do NOT push or open a PR unless the operator instructed it

## Steps

### Step 1: Un-ignore the telltale plugin in eslint

In `eslint.config.js`, replace the `ignores` array of the first config object
with (note the order: later patterns override earlier ones, so the
re-exclusion of the generated types must come after the negation):

```js
    ignores: [
      'node_modules',
      'dist',
      'site/src/data',
      'plugins/**',
      '!plugins',
      '!plugins/telltale/**',
      'plugins/telltale/.claude-plugin/types/**',
      'scripts/build-site-data.mjs',
      'scripts/validate.mjs',
    ],
```

Amended 2026-10-09 after the first executor run: the original array had no
`'!plugins'` line and ESLint 9.39 (`@eslint/config-array`) then reports
"You are linting … all of the files matching the glob pattern are ignored"
and 0 problems — `plugins/**` matches the directory form `plugins/` too, and
an ignored ancestor directory cannot have descendants unignored
(`isDirectoryIgnored`, dist/cjs/index.cjs:1473–1531), so `!plugins/telltale/**`
alone can never un-ignore anything. `'!plugins'` matches `plugins/` under the
negation matching and rescues the ancestor chain; every other plugin then
stays ignored through `plugins/**` still matching their subtrees, and the
generated types stay ignored through their explicit re-exclusion. Both were
re-verified live under the rescue shape: exactly the 15 problems below,
`npx eslint plugins/workbench` → all ignored, types folder ignored.

**Verify**: `npx eslint plugins/telltale` → prints exactly the 15 problems
listed in "Current state". Any count other than 15 means the negation or the
types re-exclusion is wrong. `npm run lint` must also still pass for the rest
of the repo except these same 15 (it FAILS on them; that is the point).

### Step 2: Auto-fix the mechanical errors

**Verify**: `npx eslint plugins/telltale --fix`, then
`npx eslint plugins/telltale` → 0 to 3 errors remain, every one from this
list: `lib.ts:164:31` (use-ignore-case), `register.tsx:989:66`
(de-morgan), `tests/register.test.ts:206:55` (unused capturing group). Any
error NOT on the 15-item list → STOP.

### Step 3: Fix the remainder by hand, sets kept identical

- `register.tsx:989`: rewrite `!('skip' in r && r.skip)` exactly as the rule
  message suggests: `!('skip' in r) || !r.skip`.
- Any remaining `regexp` error: apply the fix the rule message names, keeping
  the matched set byte-equivalent. For `lib.ts:164` the character class
  `[^A-Za-z0-9_.:/-]` equals `[^\w.:/-]` (since `\w` = `[A-Za-z0-9_]`); for
  `isAbsolute`'s `[A-Za-z]` use the `i`-flag form only if the rule's
  suggestion keeps the match identical.
- `tests/register.test.ts:206`: turn the unused capturing group into a
  non-capturing one.

**Verify**: `npx eslint plugins/telltale` → 0 problems, AND
`npm run validate` → exit 0. The plugin's own tests are the behavioral proof
that the regex rewrites changed nothing; the redaction tests in
`plugins/telltale/tests/lib.test.ts` are the ones that would catch a
character-set drift.

### Step 4: Make a missing types folder fail validate

In `scripts/validate.mjs`, change the mod leg (lines 79–81) from
`console.warn` to `fail`:

```js
if (!existsSync(join(source, '.claude-plugin', 'types'))) {
  fail(
    `${source}: no generated types; load it once with --plugin-dir so validate can typecheck it (CLAUDE.md, "Mods")`,
  );
} else if (run('npx', ['tsc', '-p', source]).status !== 0) fail(`${source}: tsc`);
```

**Verify** (in your working tree, safe to do and undo): rename
`plugins/telltale/.claude-plugin/types` to `types-away`, run
`npm run validate` → exit 1 printing the new message, rename it back, run
`npm run validate` → exit 0.

### Step 5: Fail with one clear line when `claude` is missing

In `scripts/validate.mjs`, directly after the `onPath` definition (line 24),
add:

```js
const hasClaude = onPath('claude');
if (!hasClaude) {
  fail(
    'claude not on PATH: npm run check needs Claude Code to validate and test plugins (CLAUDE.md)',
  );
}
```

Guard the catalog loop (lines 26–28) with `if (hasClaude) { … }`, and guard
the `claude plugin test` line in the mod leg the same way
(`if (hasClaude && run(…) …)`) so a missing binary produces the one clear
failure above, not shell noise per target. Leave the types check unguarded:
it should still run and fail with its own message.

**Verify**: `npm run validate` → exit 0 with `claude` present (nothing
changed for the normal path). You cannot easily remove `claude` from PATH;
instead confirm by reading the diff that the guard skips only the two
`run('claude', …)` call sites.

### Step 6: Full gate

**Verify**: `npm run check` → exit 0 (lint + format:check + validate +
typecheck + test, with `site:data` regenerating the root README regions and
`site/src/data/marketplace.json`).

## Test plan

No new tests. This plan changes gate configuration, and the plugin's
existing suites are the behavioral guard for the lint fixes. What must hold:

- All existing tests in `plugins/telltale/tests/lib.test.ts` still pass,
  especially the R14 redaction block (lines 80–176), the proof the regex
  rewrites are set-equivalent.
- The missing-types failure path is exercised once by hand in step 4.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx eslint plugins/telltale` → 0 problems
- [ ] `npm run lint` → exit 0
- [ ] `npm run validate` → exit 0; with the types folder temporarily renamed
      → exit 1 printing the new "no generated types" message
- [ ] `npm run check` → exit 0
- [ ] `git status` shows changes only in the in-scope files (plus the
      `site:data` regen: root `README.md`, `site/src/data/marketplace.json`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1's `npx eslint plugins/telltale` reports anything other than the 15
  listed problems (the codebase has drifted, or the negation is wrong).
- Step 2's `--fix` or step 3's manual fix causes any test failure. A regex
  rewrite changed the matched set; do not "adjust the test to match".
- A lint error appears that is not in the 15-item inventory.
- The eslint negation does not un-ignore the plugin (step 1 verify shows 0
  problems or "all of the files … are ignored"). This fired on the original
  array (see the amendment note in step 1); with `'!plugins'` present it
  should not. Report your eslint version's behavior instead of inventing a
  different config shape.
- `npm run check` fails on the `site:data` regen with unrelated diffs.

## Maintenance notes

- The other plugins remain lint-exempt. Extending coverage later is one line
  (`!plugins/<name>/**`) plus that plugin's fallout; measured 2026-10-09 the
  rest of `plugins/` holds ~64 more errors across `workbench`, `writeup`
  and others.
- Plan 003 (widen redaction) adds regexes to the same `lib.ts` lines this
  plan lint-fixes; 003 must land AFTER this plan so its new patterns are
  written lint-clean from the start.
- A reviewer should scrutinize: the ignores array order (the types
  re-exclusion must follow the negation), and that every regex fix kept its
  matched set identical (the test run is the proof, not the diff).
- Deferred out of this plan: making `npm run typecheck` (root `tsc`) cover
  the plugin. Validate's per-plugin `tsc -p` is the typecheck that matters,
  and wiring the plugin into the root tsconfig would couple it to the
  gitignored types forever.

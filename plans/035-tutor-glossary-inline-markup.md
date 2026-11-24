# Plan 035: Glossary definitions with snake_case names render as valid HTML

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 352884d..HEAD -- plugins/tutor/skills/teach/course.mjs plugins/tutor/test/course.test.mjs`
> If either file changed, compare the "Current state" excerpts against the
> live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `352884d`, 2026-11-24

## Why this matters

The `tutor` plugin's `/teach` skill keeps a course glossary in `GLOSSARY.md`. A Node helper,
`course.mjs`, renders it into the course home page `index.html`. The helper turns light
Markdown in each definition into HTML, and its italics rule (`_x_` to `<em>x</em>`) fires
inside words and inside inline code. Any definition that mentions two snake_case names, such
as `` `list_roots` and `search_text` ``, renders as mis-nested HTML:
`<code>list<em>roots</code> and <code>search</em>text</code>`. Programming courses name
snake_case identifiers constantly, so their glossaries render broken. After this plan, code
spans are left alone and italics only match whole words.

## Current state

- `plugins/tutor/skills/teach/course.mjs`: the course helper (`node course.mjs state|index`).
  It imports nothing outside Node built-ins and must keep working on Node 18+.
- `plugins/tutor/test/course.test.mjs`: `node:test` tests for the helper.

The bug, `course.mjs:144-148`:

```js
const inline = (s) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/_(.+?)_/g, '<em>$1</em>');
```

`esc` (defined near the top of the file) escapes `&`, `<`, `>` and `"`. It does not touch
backticks, asterisks or underscores. `inline` is not exported; its only caller is
`renderIndex`, which uses it for each glossary definition:

```js
out.push(`<dt>${esc(t.term)}</dt>`, `<dd>${inline(t.definition)}${avoid}</dd>`);
```

`renderIndex(c)` takes a plain object. A test can call it with a hand-built course, no files
needed: `{ topic, why, lessons: [], references: [], glossary: [{ group, term, definition, avoid }] }`.

Test style to match (`course.test.mjs`, existing test):

```js
test('renderIndex on an empty folder', () => {
  const html = renderIndex(readCourse(empty));
  assert.ok(html.includes('No lessons yet.'));
  assert.ok(!html.includes('class="continue"'));
});
```

Repo conventions: ESM, single quotes, Prettier `printWidth: 100`, conventional commits scoped
to the plugin (example from `git log`: `feat(tutor): restyle lessons, quizzes and course home`).

## Commands you will need

| Purpose         | Command (from repo root)                                                                        | Expected on success                          |
| --------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Tutor tests     | `node --test plugins/tutor/test/`                                                               | all pass                                     |
| Format one file | `npx prettier --check plugins/tutor/skills/teach/course.mjs plugins/tutor/test/course.test.mjs` | "All matched files use Prettier code style!" |
| Full gate       | `npm run check`                                                                                 | exit 0                                       |

## Scope

**In scope** (the only files you should modify):

- `plugins/tutor/skills/teach/course.mjs` (the `inline` function only)
- `plugins/tutor/test/course.test.mjs` (add one test)
- `plans/README.md` (your status row)

**Out of scope**:

- `esc`, `parseGlossary`, `meta` and every other function in `course.mjs`.
- The existing test fixture in `course.test.mjs` (the `before` block). Adding glossary terms
  there breaks other tests' counts (`glossary: 2 terms`).
- `GLOSSARY-FORMAT.md` and `SKILL.md`: the glossary format does not change.
- Plugin versions in `plugin.json` files: releases are a separate step.

## Git workflow

- Branch: `tutor/plan-035-glossary-inline`
- One commit, for example: `fix(tutor): keep code spans and snake_case intact in the glossary`
- Do NOT push or open a PR.

## Steps

### Step 1: Write the failing test

Append to `plugins/tutor/test/course.test.mjs`:

```js
test('renderIndex keeps code spans and snake_case words intact in the glossary', () => {
  const def = (definition) => ({ group: null, term: 'T', definition, avoid: null });
  const html = renderIndex({
    topic: 'T',
    why: null,
    lessons: [],
    references: [],
    glossary: [
      def('Listed by `list_roots` and `search_text`.'),
      def('Field read_file and write_file share.'),
      def('An _important_ rule.'),
      def('Use `a < b` with **care**.'),
    ],
  });
  assert.ok(
    html.includes('<dd>Listed by <code>list_roots</code> and <code>search_text</code>.</dd>'),
  );
  assert.ok(html.includes('<dd>Field read_file and write_file share.</dd>'));
  assert.ok(html.includes('<dd>An <em>important</em> rule.</dd>'));
  assert.ok(html.includes('<dd>Use <code>a &lt; b</code> with <strong>care</strong>.</dd>'));
});
```

**Verify**: `node --test plugins/tutor/test/course.test.mjs` → the new test FAILS (the first
assertion), every other test passes.

### Step 2: Fix `inline`

Replace the `inline` function in `course.mjs` with this shape: split on code spans first, keep
code spans verbatim, and only apply bold and italics to the text between them. Italics need a
non-word character (or the string edge) on both sides.

```js
const inline = (s) =>
  esc(s)
    .split(/(`[^`]+`)/)
    .map((part, i) =>
      i % 2
        ? `<code>${part.slice(1, -1)}</code>`
        : part
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/(?<!\w)_([^_]+?)_(?!\w)/g, '<em>$1</em>'),
    )
    .join('');
```

`split` with a capturing group puts the code spans at odd indexes. A lone backtick with no
partner is left as plain text. This exact function was proven against these cases before the
plan was written, plus `(_see_ above)` → `(<em>see</em> above)` and `__init__` left unchanged.

**Verify**: `node --test plugins/tutor/test/` → all pass, including the new test and the
existing `renderIndex builds the course home` test (it asserts
`Transfer of <strong>ownership</strong> to a new binding.`).

### Step 3: Format and gate

**Verify**: `npx prettier --check plugins/tutor/skills/teach/course.mjs plugins/tutor/test/course.test.mjs`
→ clean (run `npx prettier --write` on the same two files if not). Then `npm run check` → exit 0.

## Test plan

- One new test in `plugins/tutor/test/course.test.mjs`, modeled on the existing
  `renderIndex` tests, covering: snake_case inside code spans, snake_case in plain text,
  real italics, escaping inside a code span together with bold.
- `node --test plugins/tutor/test/` → all pass (9 tests in `course.test.mjs` + `assets.test.mjs`
  combined, up from 8).

## Done criteria

- [ ] `node --test plugins/tutor/test/` exits 0 with the new test present
- [ ] `grep -n "replace(/_(.+?)_/g" plugins/tutor/skills/teach/course.mjs` returns nothing
- [ ] `npm run check` exits 0
- [ ] `git status --short` lists only the two in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` row for 035 updated

## STOP conditions

- `inline` in `course.mjs` does not match the excerpt above.
- The new test passes before Step 2 (the bug is already fixed some other way).
- Any existing test fails after Step 2. Do not edit an existing assertion to make it pass.
- `npm run check` fails on something outside `plugins/tutor/`: report it, do not fix it.

## Maintenance notes

- `inline` is a deliberately tiny Markdown subset: bold, italics, code. If definitions ever
  need links, add them inside the non-code branch, after `esc`, and test that a link inside a
  code span stays literal.
- Plan 037 also edits `course.mjs` and `course.test.mjs` (a new `review:` line in
  `formatState`). The two plans touch different functions; run 035 first to keep diffs clean.

# Plan 032: A Node helper reports a course's state and builds its home page

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7cd4659..HEAD -- plugins/tutor`
> Expected: the import of `skills/teach/*.md`, plan 031's manifest edits, and possibly plan
> 033's `skills/teach/assets/`. `skills/teach/course.mjs` and `plugins/tutor/test/` must not
> exist yet. If either does, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: `plans/031-tutor-baseline.md` (hard: the gate must be green)
- **Category**: direction
- **Planned at**: commit `7cd4659` plus the maintainer's import of the new skill, 2026-11-24

## Why this matters

The `tutor` plugin's `/teach` skill keeps one learning topic in a **course**: a folder holding
`MISSION.md`, `GLOSSARY.md`, `lessons/NNNN-slug.html`, `learning-records/NNNN-slug.md`,
`reference/*.html` and `assets/`. The maintainer's top pain is that a course is hard to
navigate and reuse. Lessons pile up with no index, and resuming means the model rereads
every file by hand. This plan adds one dependency-free Node script with two subcommands.
`state` prints a resume report in one block. `index` writes `index.html`, the **course home**:
mission line, a "continue" card, numbered lessons, reference sheets and the rendered glossary.
Plan 034 teaches the skill to call it. Teaching must still work without Node, so the helper
holds no teaching logic, only reads and renders.

## Current state

- `plugins/tutor/skills/teach/SKILL.md`: the prose skill (plan 034 rewrites it). The helper
  lives next to it so all three clients ship it, because all of them load `skills/`.
- `plugins/tutor/skills/teach/GLOSSARY-FORMAT.md` fixes the glossary shape this plan parses:

```md
# {Topic} Glossary

{One or two sentence description of the topic this glossary covers.}

## Terms

**Hypertrophy**:
Muscle growth driven by mechanical tension and metabolic stress over repeated training sessions.
_Avoid_: Bulking, getting big
```

The format also allows grouping terms under extra `## <Group>` subheadings.

- `plugins/tutor/skills/teach/MISSION-FORMAT.md` fixes `MISSION.md`: the first line is
  `# Mission: {Topic}`, followed by `## Why` and a 1–3 sentence paragraph.
- Learning records: `learning-records/0001-slug.md`, title on the first `# ` line, optional
  frontmatter `status: superseded by LR-NNNN`.
- Repo conventions: ESM `.mjs`, Prettier (`singleQuote`, `printWidth: 100`, trailing commas),
  ESLint over all `.mjs`. Tests use `node:test` + `node:assert/strict` and live in
  `plugins/<name>/test/*.test.mjs`. Root `npm test` runs
  `node --test "scripts/*.test.mjs" "plugins/*/test/**/*.test.mjs"`, so new tests there run
  with no config change.
- Learners run this on their own Node, which may be older than the repo's `>=24`. Use only
  `node:fs`, `node:path`, `node:url` and `node:process` APIs that exist in Node 18.

## Settled decisions (maintainer, 2026-11-24)

- The helper owns `state` and `index` only. No scheduling, due dates or spacing math.
- When Node is missing, the skill degrades: it reads the files directly. Nothing in the helper
  may be required for teaching.
- The course home shows: mission line, a "continue" card for the latest lesson, the numbered
  lessons with one-line summaries, reference sheets, and the glossary rendered from
  `GLOSSARY.md`.
- A review quiz is a normal lesson whose slug starts with `review-`
  (`lessons/0009-review-ownership.html`). The home page tags it "Review".
- Lesson and reference metadata comes from the page's `<title>` and
  `<meta name="description" content="...">`, with `name` written before `content`.
- No compatibility with courses from the old Python tutor. `index` overwrites `index.html`.

## Interfaces

**Produces** (plan 034's skill text depends on these exact names and outputs):

- File `plugins/tutor/skills/teach/course.mjs`, run as
  `node course.mjs <state|index> [dir]`. `dir` defaults to `process.cwd()`.
  - `state` prints the report below to stdout and exits 0.
  - `index` writes `<dir>/index.html`, prints `wrote <absolute path>` and exits 0.
  - Anything else prints `usage: node course.mjs <state|index> [dir]` to stderr and exits 2.
  - An unreadable `dir` (missing, or not a folder) prints `not a folder: <dir>` to stderr and exits 1.
- Named exports, for tests:
  - `readCourse(dir: string): Course`
  - `formatState(course: Course): string`
  - `renderIndex(course: Course): string` (full HTML document)
- `Course` object shape:

```js
{
  dir: string,                 // absolute, forward slashes
  topic: string,               // from '# Mission: X'; else the folder's basename
  why: string | null,          // first paragraph under '## Why', lines joined by one space
  lessons: [{ file, number, slug, title, summary, review }],   // sorted by number
  references: [{ file, title, summary }],                      // sorted by file name
  records: [{ file, number, slug, title, superseded }],        // sorted by number
  glossary: [{ group, term, definition, avoid }] | null,       // null when GLOSSARY.md is absent
  has: { mission, resources, glossary, notes },                // booleans: file exists
  assets: string[],            // file names in <dir>/assets/, sorted; [] when absent
}
```

`file` is relative and `/`-separated (`lessons/0001-intro.html`). `title` falls back to the
slug and `summary` to `''`. `review` is `slug.startsWith('review-')`. `group` is `null` for
terms under `## Terms` and the group heading text otherwise.

**State report**: exact lines in this order. `<…>` marks a value:

```text
course: <dir>
mission: <topic>: <why>              | mission: missing
lessons: <n>, last <NNNN-slug> "<title>", next <NNNN>   | lessons: 0, next 0001
records: <n>, last <NNNN-slug> "<title>", next <NNNN>   | records: 0, next 0001
superseded: <NNNN-slug>, <NNNN-slug>   (line omitted when none)
references: <n> (<file>, <file>)     | references: 0
glossary: <n> terms                  | glossary: missing
resources: present | missing
notes: present | missing
assets: <name>, <name>               | assets: missing; starters in <absolute path of skills/teach/assets>
```

The `starters in` path is computed from the helper's own location
(`fileURLToPath(new URL('./assets/', import.meta.url))`, forward slashes, no trailing slash).
It lets the skill copy the starter kit without resolving the plugin root.

**Course home structure**: class names come from plan 033's stylesheet, so keep them exactly:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{topic}</title>
    <link rel="stylesheet" href="assets/style.css" />
  </head>
  <body class="home">
    <main>
      <header>
        <h1>{topic}</h1>
        <p class="mission">{why}</p>
      </header>
      <!-- p omitted when why is null -->
      <section class="continue">
        <h2>Continue</h2>
        <a class="card" href="{file}"><span class="num">{NNNN}</span> {title}</a>
        <p>{summary}</p>
      </section>
      <section>
        <h2>Lessons</h2>
        <ol class="lessons">
          <li>
            <a href="{file}"><span class="num">{NNNN}</span> {title}</a>
            <span class="tag">Review</span>
            <p>{summary}</p>
          </li>
        </ol>
      </section>
      <section>
        <h2>Reference</h2>
        <ul class="references">
          <li>
            <a href="{file}">{title}</a>
            <p>{summary}</p>
          </li>
        </ul>
      </section>
      <section id="glossary">
        <h2>Glossary</h2>
        <h3>{group}</h3>
        <dl class="glossary">
          <dt>{term}</dt>
          <dd>{definition}<span class="avoid">Avoid: {avoid}</span></dd>
        </dl>
      </section>
    </main>
  </body>
</html>
```

Rules:

- The continue card shows the highest-numbered lesson.
- With no lessons, the continue section is omitted and Lessons holds `<p>No lessons yet.</p>`.
- Reference and Glossary sections are omitted when empty.
- The tag span appears only on review lessons. `<p>{summary}</p>` is omitted when the summary is empty.
- A `.avoid` span appears only when `avoid` is set. Glossary terms keep file order; each new
  `group` opens an `<h3>` and a new `<dl>`, and ungrouped terms come first with no `<h3>`.
- Whitespace and indentation are free. Tests check substrings, not layout.

## Algorithm notes (decisions the tests do not fully pin)

- Normalize CRLF to LF before parsing any file.
- Lesson and record file names must match `/^(\d{4})-([a-z0-9]+(?:-[a-z0-9]+)*)\.(html|md)$/`
  (html for lessons, md for records). Ignore every other file. References: every `*.html` in
  `reference/`, slug-free.
- `<title>`: first `/<title>([\s\S]*?)<\/title>/i`, trimmed. Description:
  `/<meta\s+name="description"\s+content="([^"]*)"/i`. Decode only `&amp; &lt; &gt; &quot; &#39;`.
- HTML-escape every text value on output (`& < > "`). Escape exactly once, after decoding.
- Glossary definition text supports three inline marks, applied after escaping:
  `**x**` becomes `<strong>x</strong>`, `` `x` `` becomes `<code>x</code>` and `_x_` becomes `<em>x</em>`.
- Glossary parse: a line `## Terms` means no group, and any other `## X` sets group `X`.
  A line `/^\*\*(.+?)\*\*:\s*$/` starts a term. Following non-blank lines until a blank line or
  the next term: a line `/^_Avoid_:\s*(.*)$/` sets `avoid`; other lines join `definition` with
  one space.
- Record `superseded`: frontmatter line `/^status:\s*superseded/im` inside the leading `---` block.
- Write `index.html` with one `writeFileSync`. No temp files.
- CLI guard: run `main()` only when
  `import.meta.url === pathToFileURL(process.argv[1]).href`, so tests can import the module.

## Commands you will need

| Purpose     | Command                                                                         | Expected on success |
| ----------- | ------------------------------------------------------------------------------- | ------------------- |
| Tutor tests | `node --test plugins/tutor/test/`                                               | all pass            |
| Lint        | `npx eslint plugins/tutor`                                                      | exit 0              |
| Format      | `npx prettier --write plugins/tutor/skills/teach/course.mjs plugins/tutor/test` | exit 0              |
| Full gate   | `npm run check`                                                                 | exit 0              |

## Scope

**In scope**:

- `plugins/tutor/skills/teach/course.mjs` (create)
- `plugins/tutor/test/course.test.mjs` (create)

**Out of scope**:

- `SKILL.md` and the `*-FORMAT.md` files. Plan 034 wires the helper into the skill.
- `skills/teach/assets/`, which plan 033 owns. The helper only links `assets/style.css` and
  reports the starters path.
- Any other plugin. Do not copy another plugin's script as a template.
- Any npm dependency. The helper uses Node built-ins only.

## Git workflow

- Branch: `tutor/plan-032-course-helper`
- Commit after the tests pass. Example subject: `feat(tutor): course helper for state report and course home`
- Do NOT push or open a PR.

## Steps

### Step 1: Write the failing tests

Create `plugins/tutor/test/course.test.mjs`. Each test builds a course in
`mkdtempSync(join(tmpdir(), 'tutor-'))` with a space in a subfolder name
(`join(tmp, 'my course')`), and removes it in `after`. Import from
`../skills/teach/course.mjs`.

Fixture `full`: write these files, using CRLF line endings for `MISSION.md` and `GLOSSARY.md`:

- `MISSION.md`: `# Mission: Rust ownership`, blank, `## Why`, `Stop fighting the borrow`, `checker at work.`, blank, `## Success looks like`, `- x`
- `GLOSSARY.md`: `# Rust Glossary`, blank, `## Terms`, blank, `**Move**:`, `Transfer of **ownership** to a new binding.`, `_Avoid_: Copy`, blank, `## Borrowing`, blank, `**Borrow**:`, `A reference that uses a value without owning it.`
- `NOTES.md`, `RESOURCES.md`: any text
- `lessons/0001-moves.html`: `<title>Moves &amp; copies</title><meta name="description" content="Who owns a value after let b = a">`
- `lessons/0002-review-moves.html`: `<title>Review: moves</title>` (no description)
- `lessons/0003-borrowing.html`: `<title>Borrowing <rules></title>`. The raw `<` is deliberate.
- `lessons/draft.html`, `lessons/0004-x.HTML`: must be ignored
- `learning-records/0001-moves.md`: `---`, `status: superseded by LR-0002`, `---`, `# Moves transfer ownership`
- `learning-records/0002-moves-deeper.md`: `# Moves include function arguments`
- `reference/cheatsheet.html`: `<title>Ownership cheat sheet</title>`
- `assets/style.css`, `assets/quiz.js`: empty files

Tests and their assertions:

```js
test('readCourse parses the full fixture', () => {
  const c = readCourse(full);
  assert.equal(c.topic, 'Rust ownership');
  assert.equal(c.why, 'Stop fighting the borrow checker at work.');
  assert.deepEqual(
    c.lessons.map((l) => l.file),
    ['lessons/0001-moves.html', 'lessons/0002-review-moves.html', 'lessons/0003-borrowing.html'],
  );
  assert.equal(c.lessons[0].title, 'Moves & copies');
  assert.equal(c.lessons[0].summary, 'Who owns a value after let b = a');
  assert.equal(c.lessons[1].review, true);
  assert.equal(c.lessons[1].summary, '');
  assert.deepEqual(
    c.records.map((r) => r.superseded),
    [true, false],
  );
  assert.deepEqual(c.glossary, [
    {
      group: null,
      term: 'Move',
      definition: 'Transfer of **ownership** to a new binding.',
      avoid: 'Copy',
    },
    {
      group: 'Borrowing',
      term: 'Borrow',
      definition: 'A reference that uses a value without owning it.',
      avoid: null,
    },
  ]);
  assert.deepEqual(c.assets, ['quiz.js', 'style.css']);
});

test('formatState reports the full fixture', () => {
  const lines = formatState(readCourse(full)).split('\n');
  assert.ok(lines.includes('mission: Rust ownership: Stop fighting the borrow checker at work.'));
  assert.ok(lines.includes('lessons: 3, last 0003-borrowing "Borrowing <rules>", next 0004'));
  assert.ok(
    lines.includes(
      'records: 2, last 0002-moves-deeper "Moves include function arguments", next 0003',
    ),
  );
  assert.ok(lines.includes('superseded: 0001-moves'));
  assert.ok(lines.includes('references: 1 (reference/cheatsheet.html)'));
  assert.ok(lines.includes('glossary: 2 terms'));
  assert.ok(lines.includes('assets: quiz.js, style.css'));
});

test('formatState on an empty folder', () => {
  const text = formatState(readCourse(empty));
  for (const line of [
    'mission: missing',
    'lessons: 0, next 0001',
    'records: 0, next 0001',
    'references: 0',
    'glossary: missing',
    'resources: missing',
    'notes: missing',
  ]) {
    assert.ok(text.split('\n').includes(line), line);
  }
  assert.match(text, /^assets: missing; starters in .+\/skills\/teach\/assets$/m);
  assert.doesNotMatch(text, /superseded:/);
});

test('renderIndex builds the course home', () => {
  const html = renderIndex(readCourse(full));
  assert.match(html, /<link rel="stylesheet" href="assets\/style.css"/);
  assert.match(html, /<p class="mission">Stop fighting the borrow checker at work.<\/p>/);
  assert.match(html, /class="continue"[\s\S]*href="lessons\/0003-borrowing.html"/);
  assert.ok(html.includes('Borrowing &lt;rules&gt;'));
  assert.ok(html.includes('Moves &amp; copies'));
  assert.ok(!html.includes('&amp;amp;'));
  assert.equal((html.match(/class="tag"/g) ?? []).length, 1);
  assert.ok(html.includes('Transfer of <strong>ownership</strong> to a new binding.'));
  assert.ok(html.includes('<span class="avoid">Avoid: Copy</span>'));
  assert.ok(html.includes('<h3>Borrowing</h3>'));
  assert.ok(html.includes('href="reference/cheatsheet.html"'));
  assert.ok(!html.includes('draft.html'));
});

test('renderIndex on an empty folder', () => {
  const html = renderIndex(readCourse(empty));
  assert.ok(html.includes('No lessons yet.'));
  assert.ok(!html.includes('class="continue"'));
  assert.ok(!html.includes('id="glossary"'));
  assert.ok(!html.includes('class="mission"'));
});

test('CLI: index writes the page, state exits 0, bad input exits non-zero', () => {
  const cli = fileURLToPath(new URL('../skills/teach/course.mjs', import.meta.url));
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  const wrote = run('index', full);
  assert.equal(wrote.status, 0);
  assert.match(wrote.stdout, /^wrote .+index\.html/);
  assert.ok(existsSync(join(full, 'index.html')));
  assert.equal(run('state', full).status, 0);
  assert.equal(run('bogus').status, 2);
  assert.equal(run('state', join(full, 'nope')).status, 1);
});
```

**Verify**: `node --test plugins/tutor/test/` fails with a module-not-found error for `course.mjs`.

### Step 2: Implement `course.mjs`

Write `plugins/tutor/skills/teach/course.mjs` to the Interfaces and Algorithm notes above. Open
with a 2–3 line comment: what the file is, the two subcommands, and that the skill must work
without it. Keep it one file with no dependencies. Expect about 150–200 lines.

**Verify**: `node --test plugins/tutor/test/` shows all 6 tests passing.

### Step 3: Smoke-run the CLI by hand

Run `node plugins/tutor/skills/teach/course.mjs state` from the repo root. The repo root is
not a course.

**Verify**: exit 0. The output starts with `course: ` followed by the repo path with forward
slashes, and contains `mission: missing`.

### Step 4: Lint, format, gate, commit

Run the format command, then `npx eslint plugins/tutor`, then `npm run check`.

**Verify**: all three exit 0. Then commit both files.

## Test plan

The 6 tests in Step 1 cover the full fixture, the empty folder, HTML escaping (raw `<`,
decoded `&amp;`, no double escape), CRLF input, ignored file names, a review lesson, a
superseded record, glossary groups, avoid lines and inline marks, and the CLI exit codes.

## Review Focus

The inputs most likely to bite a learner that the spec implies but the tests pin only partly:

1. **A lesson the model wrote with `content` before `name` in the meta tag** shows an empty
   summary rather than crashing. That is acceptable, and plan 034's skill rule prevents it.
2. **A course folder path with spaces or non-ASCII letters** (`C:/Users/Åsa/my course`): the
   fixture covers spaces. A reviewer should confirm `state` prints non-ASCII unchanged.
3. **A large course (200 lessons)**: everything is read synchronously once. That is fine at
   this size, so do not add caching.
4. **`GLOSSARY.md` edited by hand into a slightly different shape** (missing colon after the
   bold term): the term is skipped silently, never thrown on.
5. **`index` run outside a course** (no `MISSION.md`): it still writes a page titled with the
   folder name. Plan 034's skill only calls it inside a confirmed course.

## Done criteria

- [ ] `node --test plugins/tutor/test/` passes, 6 tests
- [ ] `npm run check` exits 0
- [ ] `grep -n "from '" plugins/tutor/skills/teach/course.mjs` lists only `node:` imports
- [ ] `git status --short` shows only the two in-scope files
- [ ] `plans/README.md` row 032 updated

## STOP conditions

- Any test assertion seems to contradict the Interfaces section. Report it. Do not edit
  the test to pass.
- `npm run validate` flags `course.mjs` through skill-lint (for example `bare-script`). Report
  it, because plan 034 writes the command lines.
- Passing a test seems to need an npm dependency or a Node API newer than 18.

## Maintenance notes

- Plan 034's `SKILL.md` quotes the subcommand names, the `assets: missing; starters in` line
  and the meta-tag order. Renaming any of them means editing `SKILL.md` in the same commit.
- Plan 033's stylesheet styles the class names in "Course home structure". Changing a class
  here means changing it there.
- Deferred on purpose: stale-index detection, progress views and scheduling. The maintainer
  chose none of them.

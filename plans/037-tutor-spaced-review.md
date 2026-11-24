# Plan 037: The resume report says when the last review was, and the tutor offers one when it is due

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 352884d..HEAD -- plugins/tutor/skills/teach/course.mjs plugins/tutor/test/course.test.mjs plugins/tutor/skills/teach/SKILL.md plugins/tutor/README.md`
> Plans 035 and 036 may have changed `course.mjs`, `course.test.mjs` and `SKILL.md` in
> other places; that is expected. Compare only the excerpts quoted below against the live
> files; on a mismatch in those exact places, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none hard. Run after `plans/035-tutor-glossary-inline-markup.md` if both are
  pending (same two files, different functions) to keep diffs clean.
- **Category**: direction (learning quality)
- **Planned at**: commit `352884d`, 2026-11-24

## Why this matters

The `tutor` plugin's `/teach` skill teaches one topic over many sessions. Its own
"How people learn" section says long-term retention comes from retrieval practice and
**spacing** (practice spread over time), and it has a `/teach review` command that builds a
quiz from past lessons. But nothing ever prompts a review: the learner has to remember to ask.
At the start of each session the skill runs a Node helper, `course.mjs state`, and reads its
report. This plan adds one fact to that report (the last review lesson, how many lessons came
after it, how many days ago it was written) and one rule to the skill: offer `/teach review`
first when a review is due. The helper reports facts; the skill decides. That split is the
helper's stated design (`course.mjs:3`: "it only reads and renders, it holds no teaching logic").

## Current state

Files:

- `plugins/tutor/skills/teach/course.mjs`: the helper. Node 18+, Node built-ins only.
  `statSync` is already imported (line 4).
- `plugins/tutor/test/course.test.mjs`: `node:test` tests with a temp-folder fixture.
- `plugins/tutor/skills/teach/SKILL.md`: the skill prose.
- `plugins/tutor/README.md`: user-facing plugin README.

A **review** is a lesson file named `lessons/NNNN-review-<slug>.html`. `readCourse` already
flags it, `course.mjs:78-82`:

```js
const lessons = numbered(root, 'lessons', 'html').map((l) => ({
  ...l,
  ...meta(read(join(root, l.file)), l.slug),
  review: l.slug.startsWith('review-'),
}));
```

Lessons are sorted by number (`numbered` sorts directory entries). No course file carries a
date, so the plan uses the review file's modification time.

`formatState`, `course.mjs:116-128` (start of the function):

```js
export function formatState(c) {
  const next = (items) =>
    String(items.length ? Number(items.at(-1).number) + 1 : 1).padStart(4, '0');
  const tail = (label, items) =>
    items.length
      ? `${label}: ${items.length}, last ${items.at(-1).number}-${items.at(-1).slug} "${items.at(-1).title}", next ${next(items)}`
      : `${label}: 0, next 0001`;
  const gone = c.records.filter((r) => r.superseded).map((r) => `${r.number}-${r.slug}`);
  const lines = [
    `course: ${c.dir}`,
    c.has.mission ? `mission: ${c.topic}: ${c.why ?? ''}` : 'mission: missing',
    tail('lessons', c.lessons),
    tail('records', c.records),
  ];
```

The test fixture (`course.test.mjs`, `before` block) creates `lessons/0001-moves.html`,
`lessons/0002-review-moves.html`, `lessons/0003-borrowing.html` in `full`, and an `empty`
folder. Two existing tests check report lines with `lines.includes(...)`:

```js
test('formatState reports the full fixture', () => {
  const lines = formatState(readCourse(full)).split('\n');
  assert.ok(lines.includes('lessons: 3, last 0003-borrowing "Borrowing <rules>", next 0004'));
  ...
});

test('formatState on an empty folder', () => {
  const text = formatState(readCourse(empty));
  for (const line of [
    'mission: missing',
    'lessons: 0, next 0001',
    ...
  ]) {
    assert.ok(text.split('\n').includes(line), line);
  }
```

`SKILL.md:41` (the helper description):

```md
- Run both from the course folder. `state` prints the resume report, including `next NNNN` lesson numbers. `index` writes `index.html` and prints `wrote <path>`.
```

`SKILL.md:50` (Session flow step 4):

```md
4. **Choose one win.** Take the learner's ask, or the most mission-relevant skill just past what the records show (zone of proximal development: challenged just enough). Done when you can name the one tangible win and why it sits just past the records.
```

`README.md:9`:

```md
- `/teach review` writes a quiz from your learning records and past lessons.
```

## The new report line (exact format)

Inserted directly after the `lessons:` line:

| Course state     | Line                                                         |
| ---------------- | ------------------------------------------------------------ |
| No review lesson | `review: none yet, 3 lessons` (`0 lessons`, `1 lesson`)      |
| Has a review     | `review: last 0002-review-moves, 1 lesson since, 5 days ago` |

`N lessons since` counts lessons numbered after the last review. Days are whole days,
floored, never negative: `Math.max(0, Math.floor((now - modified) / 86_400_000))`, with
`1 day` singular. This logic was proven on a scratch copy before the plan was written:

```js
function reviewLine(lessons, now) {
  const plural = (n) => `${n} lesson${n === 1 ? '' : 's'}`;
  const at = lessons.findLastIndex((l) => l.review);
  if (at === -1) return `review: none yet, ${plural(lessons.length)}`;
  const r = lessons[at];
  const days = Math.max(0, Math.floor((now - r.modified) / 86_400_000));
  return `review: last ${r.number}-${r.slug}, ${plural(lessons.length - at - 1)} since, ${days} day${days === 1 ? '' : 's'} ago`;
}
```

## Commands you will need

| Purpose     | Command (from repo root)                                             | Expected on success     |
| ----------- | -------------------------------------------------------------------- | ----------------------- |
| Tutor tests | `node --test plugins/tutor/test/`                                    | all pass                |
| Live report | `node plugins/tutor/skills/teach/course.mjs state <some course dir>` | prints a `review:` line |
| Format      | `npx prettier --check plugins/tutor`                                 | clean                   |
| Full gate   | `npm run check`                                                      | exit 0                  |

## Scope

**In scope** (the only files you should modify):

- `plugins/tutor/skills/teach/course.mjs` (`readCourse` lessons map, `formatState`)
- `plugins/tutor/test/course.test.mjs`
- `plugins/tutor/skills/teach/SKILL.md` (line 41 and Session flow step 4 only)
- `plugins/tutor/README.md` (line 9 only)
- `plans/README.md` (your status row)

**Out of scope**:

- `renderIndex` and the course home page: showing "review due" there is a separate idea.
- Thresholds in code. The helper must not decide whether a review is due; only `SKILL.md` does.
- The `## Lesson pages` and `## Review` sections of `SKILL.md` (plan 036 edits Lesson pages).
- `inline` in `course.mjs` (plan 035).
- Plugin versions: releases are a separate step.

## Git workflow

- Branch: `tutor/plan-037-spaced-review`
- One or two commits, for example: `feat(tutor): resume report shows the last review and the skill offers one when due`
- Do NOT push or open a PR.

## Steps

### Step 1: Write the failing tests

In `course.test.mjs`:

1. Add `utimesSync` to the `node:fs` import.
2. At the top level, add two constants:

   ```js
   const REVIEWED = new Date('2026-11-19T12:00:00Z');
   const NOW = Date.parse('2026-11-24T12:00:00Z');
   ```

3. At the end of the `before` block, after the fixture files are written, set the review
   lesson's times:

   ```js
   utimesSync(join(full, 'lessons/0002-review-moves.html'), REVIEWED, REVIEWED);
   ```

4. In `formatState reports the full fixture`, change the first line to
   `const lines = formatState(readCourse(full), NOW).split('\n');` and add:

   ```js
   assert.ok(lines.includes('review: last 0002-review-moves, 1 lesson since, 5 days ago'));
   ```

5. In `formatState on an empty folder`, add `'review: none yet, 0 lessons',` to the expected
   lines array.

**Verify**: `node --test plugins/tutor/test/course.test.mjs` → the two `formatState` tests
FAIL on the new `review:` assertions; all other tests pass.

### Step 2: Record each lesson's modification time

In `readCourse`, add one property to each lesson object:

```js
    modified: statSync(join(root, l.file)).mtimeMs,
```

**Verify**: `node --test plugins/tutor/test/course.test.mjs` → same failures as Step 1, no new ones.

### Step 3: Print the line

Change the signature to `export function formatState(c, now = Date.now())`. Add the
`reviewLine` logic above (as an inner function or a module-level helper, your choice; match
the arrow-function style of `next` and `tail`). Insert its result into `lines` directly after
`tail('lessons', c.lessons)`.

**Verify**: `node --test plugins/tutor/test/` → all pass. Then on a scratch course outside the
repo, `node plugins/tutor/skills/teach/course.mjs state <dir>` prints a `review:` line and
exits 0.

### Step 4: Teach the skill to use it

1. `SKILL.md:41`: change "including `next NNNN` lesson numbers" to "including `next NNNN`
   lesson numbers and a `review:` line".
2. `SKILL.md:50`, step 4: insert this sentence before "Done when":
   "First, if the report's `review:` line shows 3 or more lessons since the last review (or
   since the start, when there is none), or a last review 7 or more days old with a lesson
   after it, offer `/teach review` instead. Build the lesson if the learner declines."
3. `README.md:9`: append " The tutor offers one after three lessons or a week without a review."

**Verify**: `grep -c "review:\` line" plugins/tutor/skills/teach/SKILL.md`→`2`or more;`wc -c plugins/tutor/skills/teach/SKILL.md` → under 24000.

### Step 5: Format and gate

**Verify**: `npx prettier --check plugins/tutor` → clean (run `--write` on changed files if
not). `npm run check` → exit 0.

## Test plan

- The two existing `formatState` tests gain one assertion each (Step 1); the fixture gets a
  fixed modification time on the review lesson so the day count is deterministic.
- Cases covered: a review followed by one lesson, 5 days ago (full fixture); no review and no
  lessons (empty fixture). The singular forms (`1 day`, `1 lesson`) and "none yet, N lessons"
  were proven in the scratch check; add a third small test calling `formatState` on a
  hand-built object if you want them pinned (optional).

## Done criteria

- [ ] `node --test plugins/tutor/test/` exits 0
- [ ] `grep -n "now = Date.now()" plugins/tutor/skills/teach/course.mjs` returns one line
- [ ] `grep -c "offer \`/teach review\`" plugins/tutor/skills/teach/SKILL.md`→`1`
- [ ] `npm run check` exits 0
- [ ] `git status --short` lists only in-scope files
- [ ] `plans/README.md` row for 037 updated

## STOP conditions

- The lessons map in `readCourse` or the start of `formatState` does not match the excerpts.
- `formatState` already prints a `review:` line.
- A test outside `formatState` fails after Step 2 or 3 (for example a `deepEqual` on lesson
  objects that the new `modified` field breaks). Report which; do not delete the assertion.
- Node in the environment is older than 18 (`Array.prototype.findLastIndex` needs 18+).

## Maintenance notes

- Modification time is a proxy for "when the review happened". Copying or checking out a
  course resets it, and re-editing a review lesson moves it forward. Both make a review look
  newer, so the tutor offers one later, never wrongly early. If courses ever carry dates (for
  example a `date:` meta in lessons), switch `reviewLine` to that.
- The thresholds (3 lessons, 7 days) live only in `SKILL.md`. Tune them there.
- A natural follow-up is a "Review due" badge on the course home (`renderIndex`), using the
  same facts. Left out to keep this plan small.

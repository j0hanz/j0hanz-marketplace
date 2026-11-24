# Plan 036: Lessons quiz only what they taught and give the learner setup, solutions, a recap and a next step

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 352884d..HEAD -- plugins/tutor/skills/teach/SKILL.md plugins/tutor/skills/teach/assets/style.css plugins/tutor/test/assets.test.mjs`
> If any of these changed, compare the "Current state" excerpts against the
> live files before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (independent of 035; plan 037 edits a different section of `SKILL.md`)
- **Category**: direction (learning quality)
- **Planned at**: commit `352884d`, 2026-11-24

## Why this matters

The `tutor` plugin's `/teach` skill writes HTML lessons by following the "Lesson pages"
contract in its `SKILL.md`. A real lesson built from that contract on 2026-11-24 (course
"Build a TypeScript client for filesystem-mcp", lesson 0001) showed these gaps:

1. **The quiz tested material the page never taught.** One question asked how relative paths
   resolve; the rule appeared only in a code comment and in that question's own feedback.
   Another asked about `isError`, which the page covered only in an optional practice step.
2. **Two questions tested the same fact** (which result field holds a tool's data), and no
   question asked the learner to apply or predict anything.
3. **Options read like telegrams** ("server cwd inside root", "parsed text block"). The
   contract says "Options have the same number of words", which forces clipped phrasing, and
   the clipped correct option stood out.
4. **No time or setup line.** The program needed Node.js 26 to run `.ts` files directly; the
   page never said so.
5. **Practice steps that ask for code had no solution**, so a stuck learner has to stop.
6. **No recap** to recall at the next review, and the next lesson's topic hid in the muted
   `.ask` line.
7. **Code lines of 80+ characters scrolled sideways** inside the 44rem text column.

After this plan the contract fixes 1 to 6 for every future lesson, and the stylesheet styles
the new parts and gives top-level code blocks more width on large screens (7).

## Current state

Files:

- `plugins/tutor/skills/teach/SKILL.md`: the skill (about 9.8 KB; the repo caps a `SKILL.md`
  at 24 KB). Section `## Lesson pages` is lines 67-94.
- `plugins/tutor/skills/teach/assets/style.css`: the starter stylesheet the skill copies into
  each new course (617 lines). Courses never get an updated copy automatically, which is fine.
- `plugins/tutor/test/assets.test.mjs`: asserts the stylesheet contains every contract
  selector, supports dark mode and print, and loads nothing remote.

`SKILL.md:73` today (one line):

```md
- Lessons: a `.win` callout first (the one **win**), then the knowledge (short, littered with citation links), then practice with a tight feedback loop (a quiz, or real-world steps with a check). After that, a `.source` box with the single best primary source, and an `.ask` line inviting follow-up questions to you. Link to other lessons and reference sheets.
```

`SKILL.md:90` today (one line, indented two spaces, inside the quiz bullet after the HTML
example):

```md
Options have the same number of words, the correct position varies across questions, and every `.feedback` explains why. A mouse click grades at once. A keyboard learner moves between options with the arrow keys and confirms with Space or Enter, so tell learners that.
```

`style.css`, the block that ends the "lessons and references" section, lines 416-421:

```css
.ask {
  color: var(--muted);
  font-size: 0.95rem;
}

/* quiz */
```

`style.css` code block rule, lines 146-155 (`main` is `max-width: var(--measure)` = 44rem with
`padding: 2.5rem 1rem 5rem`, line 61):

```css
pre {
  overflow-x: auto;
  margin: 1.25rem 0 1.5rem;
  ...
}
```

Stylesheet conventions: colors only through the tokens on `:root` (`--bg`, `--surface`,
`--fg`, `--muted`, `--rule`, `--accent`, `--accent-soft`, `--card`, `--radius`, `--shadow`);
every token has a dark-mode value already, so new rules that use tokens work in dark mode
with no extra block. No `@import`, no remote `url(...)`. Indentation and wrapping follow
Prettier (`printWidth: 100`).

`assets.test.mjs` selector list starts like this; new selectors are appended to it:

```js
test('stylesheet styles every contract selector and stays offline', () => {
  for (const sel of [
    'body.home',
    '.mission',
    ...
    '.score',
  ]) {
    assert.ok(css.includes(sel), sel);
  }
```

Writing style for `SKILL.md`: short imperative sentences, no filler, terms in `code` when they
are class names or files. Match the surrounding bullets.

## Commands you will need

| Purpose     | Command (from repo root)                                                                                                                  | Expected on success |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Tutor tests | `node --test plugins/tutor/test/`                                                                                                         | all pass            |
| SKILL size  | `wc -c plugins/tutor/skills/teach/SKILL.md`                                                                                               | under 24000         |
| Format      | `npx prettier --check plugins/tutor/skills/teach/SKILL.md plugins/tutor/skills/teach/assets/style.css plugins/tutor/test/assets.test.mjs` | all clean           |
| Full gate   | `npm run check`                                                                                                                           | exit 0              |

## Scope

**In scope** (the only files you should modify):

- `plugins/tutor/skills/teach/SKILL.md` (section `## Lesson pages` only)
- `plugins/tutor/skills/teach/assets/style.css`
- `plugins/tutor/test/assets.test.mjs` (selector list only)
- `plans/README.md` (your status row)

**Out of scope**:

- `## Session flow` and `## Review` in `SKILL.md`: plan 037 edits step 4 of Session flow.
- `quiz.js`: the quiz markup and behavior do not change.
- `course.mjs` and the course home markup.
- Any existing course folder on disk (for example `C:\filesystem-mcp\.course`): courses keep
  their own copy of the stylesheet by design.
- Plugin versions: releases are a separate step.

## Git workflow

- Branch: `tutor/plan-036-lesson-contract`
- Commits, for example: `feat(tutor): lessons get setup, solutions, recap and stricter quiz rules`
- Do NOT push or open a PR.

## Steps

### Step 1: Rewrite the lesson-order bullet (`SKILL.md:73`)

Replace the whole `- Lessons: ...` line with these bullets (keep them in this order, right
where the old line was):

````md
- Lessons, in this order: a `.win` callout (the one **win**); a `<p class="prereq">` line with the time the lesson takes and what must be installed or done first (for example: "About 20 minutes. Needs Node.js 26 and the `practice/` folder from lesson 0001."); the knowledge, one idea per `h2`, short and littered with citation links; practice with a tight feedback loop (real-world steps, each ending in a **Check:** the learner can see, then a quiz); a `.recap`; a `.source` box with the single best primary source; a `<p class="next">` naming what the next lesson covers; and an `.ask` line inviting follow-up questions to you. Link to other lessons and reference sheets.
- Keep code lines at 76 characters or fewer. When a lesson shows a whole program, number its parts in the text and mark the same numbers in code comments (`// 1`), so the learner can map each idea to its lines.
- A practice step that asks the learner to write or change code gets a hidden solution right after its check:

  ```html
  <details class="solution">
    <summary>Solution</summary>
    <pre><code>...the code...</code></pre>
    <p>One line on why it works.</p>
  </details>
  ```

- The `.recap` holds three to five takeaways, each a sentence the learner should be able to say from memory at the next review:

  ```html
  <section class="recap">
    <h2>Recap</h2>
    <ul>
      <li>...</li>
    </ul>
  </section>
  ```
````

**Verify**: `grep -c 'class="prereq"\|details class="solution"\|class="recap"\|class="next"' plugins/tutor/skills/teach/SKILL.md`
→ `4` or more. `grep -c "^- Lessons: a" plugins/tutor/skills/teach/SKILL.md` → `0`.

### Step 2: Replace the quiz-writing rules (`SKILL.md:90`)

Replace the `  Options have the same number of words, ...` line with this block. Indent every
line of it by two spaces so it stays inside the quiz bullet (the fence below shows it unindented):

```md
Write each quiz to these rules:

- Test only what this page taught, or earlier lessons in a review. A fact that appears only in a code comment, an optional step or another question's feedback is not taught.
- One idea per question. No two questions test the same fact.
- At least one question asks the learner to apply or predict (what a program prints, why a call fails, which choice fits a new case), not only to recall.
- Options are plain, full phrases of similar length and tone, so no option stands out by its wording. The correct position varies across questions.
- Every `.feedback` explains why the answer is right and links the source.

A mouse click grades at once. A keyboard learner moves between options with the arrow keys and confirms with Space or Enter, so tell learners that.
```

**Verify**: `grep -c "same number of words" plugins/tutor/skills/teach/SKILL.md` → `0`;
`grep -c "apply or predict" plugins/tutor/skills/teach/SKILL.md` → `1`;
`wc -c plugins/tutor/skills/teach/SKILL.md` → under 24000.

### Step 3: Style the new parts

In `style.css`, insert these rules between the `.ask { ... }` block and the `/* quiz */`
comment:

```css
.prereq {
  margin: -0.75rem 0 2rem;
  color: var(--muted);
  font-size: 0.95rem;
}
details.solution {
  margin: 0.75rem 0 1.25rem;
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: 9px;
}
details.solution > summary {
  padding: 0.55rem 0.9rem;
  color: var(--accent);
  font-weight: 600;
  cursor: pointer;
}
details.solution[open] > summary {
  border-bottom: 1px solid var(--rule);
}
details.solution > :not(summary) {
  margin: 0.75rem 0.9rem;
}
.recap {
  margin: 3rem 0 0;
  padding: 1.1rem 1.25rem 0.25rem;
  background: var(--accent-soft);
  border-radius: var(--radius);
}
.recap h2 {
  margin: 0 0 0.5rem;
  padding: 0;
  border: 0;
  font-size: 1.1rem;
}
.next {
  margin: 2rem 0 0.5rem;
  padding: 0.9rem 1.25rem;
  border: 1px dashed var(--rule);
  border-radius: var(--radius);
  font-weight: 600;
}
```

Then, directly after the `pre code { font-size: 1em; }` rule in the `/* code */` section, add
the wide-screen breakout for top-level code blocks (it widens them from 42rem to 50rem of
content; nested `pre` inside lists stays in the column):

```css
@media (min-width: 62rem) {
  main > pre {
    margin-inline: -4rem;
  }
}
```

**Verify**: `npx prettier --check plugins/tutor/skills/teach/assets/style.css` → clean (run
`--write` if not, then re-check).

### Step 4: Pin the new selectors in the asset test

In `plugins/tutor/test/assets.test.mjs`, append these four entries to the selector array,
after `'.score',`:

```js
    '.prereq',
    'details.solution',
    '.recap',
    '.next',
```

**Verify**: `node --test plugins/tutor/test/` → all pass (8 tests, or 9 if plan 035 landed
first).

### Step 5: Look at it (optional but recommended)

Create a throwaway page OUTSIDE the repo (for example in your OS temp folder) that links the
in-repo stylesheet by absolute `file:///` URL and contains one of each: `.win`, `.prereq`, an
`h2`, a top-level `<pre>` with a 90-character line, a `details.solution`, a `.recap`, `.next`.
Open it in a headless browser or screenshot tool at 1440px and 390px wide, in light and dark
color scheme. Expect: the wide `pre` extends past the text column at 1440 and scrolls inside
itself at 390; nothing else overflows. Delete the throwaway page afterwards.

**Verify**: no file under the repo was created (`git status --short` shows only in-scope files).

### Step 6: Gate

**Verify**: `npm run check` → exit 0.

## Test plan

- `assets.test.mjs` gains four selector assertions (Step 4). It already checks dark mode,
  print and no remote URLs; those must still pass.
- `SKILL.md` has no unit test; Steps 1-2 verify it with `grep` and the size check, and
  `npm run validate` (inside `npm run check`) lints it.

## Done criteria

- [ ] `grep -c "same number of words" plugins/tutor/skills/teach/SKILL.md` → `0`
- [ ] `grep -c "apply or predict" plugins/tutor/skills/teach/SKILL.md` → `1`
- [ ] `grep -c 'details class="solution"' plugins/tutor/skills/teach/SKILL.md` → `1`
- [ ] `grep -c "main > pre" plugins/tutor/skills/teach/assets/style.css` → `1`
- [ ] `wc -c plugins/tutor/skills/teach/SKILL.md` → under 24000
- [ ] `node --test plugins/tutor/test/` exits 0
- [ ] `npm run check` exits 0
- [ ] `git status --short` lists only the in-scope files
- [ ] `plans/README.md` row for 036 updated

## STOP conditions

- `SKILL.md:73` or `SKILL.md:90` does not match the excerpts (the contract changed since this
  plan was written).
- The `.ask` block or the `/* quiz */` comment is missing from `style.css`.
- `npm run validate` rejects `SKILL.md` (for example a YAML or lint rule on the new nested
  list or fenced blocks). Report the exact error; do not restructure the section to dodge it.
- The change seems to need edits to `quiz.js`, `course.mjs` or the `## Session flow` section.

## Maintenance notes

- Existing courses keep their old `assets/style.css`. Lessons built after this plan in an
  old course will use `.prereq`, `.recap`, `.next` and `details.solution` unstyled (they still
  read fine as plain HTML). A learner can copy the new starter over their course's
  `assets/style.css` to get the styles.
- The quiz rules are prose for the model, not checks. If lessons keep breaking them, the next
  step is a lint in `course.mjs state` (for example, warn when two `legend`s share most words);
  that was deliberately left out here.
- The 76-character code rule and the `main > pre` breakout work together: the rule keeps
  phones readable, the breakout catches the lines that slip through on desktop.

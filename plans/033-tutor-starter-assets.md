# Plan 033: Every course starts from one shipped stylesheet and quiz widget

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7cd4659..HEAD -- plugins/tutor`
> `plugins/tutor/skills/teach/assets/` must not exist yet. If it does, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/031-tutor-baseline.md` (hard: green gate). It is independent of 032;
  the class-name contract below is shared with 032 and must match it exactly.
- **Category**: direction
- **Planned at**: commit `7cd4659` plus the maintainer's import of the new skill, 2026-11-24

## Why this matters

The `tutor` plugin's `/teach` skill builds a **course** in a folder: HTML lessons in `lessons/`,
reference sheets in `reference/`, a generated home page `index.html`, and shared components in
`assets/`. Today the model writes the stylesheet and quiz widget from scratch in every new
course. That costs tokens, every course looks different, and the home page has no style to
match. This plan ships a small, readable starter kit inside the plugin. The skill (plan 034)
copies it into a course's `assets/` on the first lesson. Lessons, reference sheets and the
course home then share one look and one quiz behavior, and the learner can edit their copy.

## Current state

- `plugins/tutor/skills/teach/`: holds `SKILL.md` and four `*-FORMAT.md` files. No assets yet.
- The skill's design intent, quoted from `SKILL.md`: lessons are "beautiful, with clean,
  readable typography and layout … Think Tufte". Reference documents "print out well" and are
  "designed for quick reference". Quizzes give feedback "immediately – and ideally
  automatically". Answer options have equal length and the correct answer's position varies.
- Lessons open from `file://`. Chrome blocks ES module scripts there, so `quiz.js` must be a
  classic script (an IIFE, no `import`/`export`, no `type="module"`).
- Lint: ESLint lints all `.js` with browser and node globals. Prettier formats `.css` and
  `.js` (`singleQuote`, `printWidth: 100`).
- The starter kit must work offline. No web fonts, CDNs or remote URLs: use system font stacks.

## Settled decisions (maintainer, 2026-11-24)

- Ship a stylesheet of about 150 lines and a quiz widget of about 100 lines. The skill copies
  them once and never overwrites the learner's copy.
- The course home, lessons, reference sheets and review quizzes all use the same stylesheet.

## Interfaces

**Produces**:

- `plugins/tutor/skills/teach/assets/style.css`
- `plugins/tutor/skills/teach/assets/quiz.js`

Plan 032's helper reports this folder's absolute path as
`assets: missing; starters in <path>`. Plan 034's skill copies both files into the course's
`assets/`.

**Class-name contract** (used by plan 032's course home and plan 034's lesson rules; style
every one of these):

| Selector                          | Where               | Purpose                                         |
| --------------------------------- | ------------------- | ----------------------------------------------- |
| `body.home`                       | `index.html`        | course home layout                              |
| `.mission`                        | home header         | mission line under the `h1`                     |
| `.continue .card`                 | home                | prominent "continue" link block                 |
| `.num`                            | home lists, card    | 4-digit lesson number, monospace, muted         |
| `ol.lessons`, `ul.references`     | home                | list without default markers; summary `p` muted |
| `.tag`                            | home lesson item    | small "Review" pill                             |
| `dl.glossary`, `.avoid`           | home glossary       | term/definition grid; `.avoid` muted, own line  |
| `nav.crumbs`                      | lessons, references | top link back to `../index.html`                |
| `.win`                            | lessons             | the one tangible win, top callout               |
| `.source`                         | lessons             | recommended primary source box                  |
| `.ask`                            | lessons             | "ask your tutor" reminder, quiet                |
| `form.quiz`, `fieldset`, `legend` | lessons             | quiz layout                                     |
| `.feedback`                       | inside a fieldset   | explanation shown after answering               |
| `.correct`, `.wrong`              | on a `fieldset`     | answered state                                  |
| `.answer`, `.picked`              | on a `label`        | the right option; the option the learner chose  |
| `.score`                          | in `form.quiz`      | running and final score line                    |

**Quiz markup contract** (plan 034 copies this into the skill as the one way to write a quiz):

```html
<form class="quiz">
  <fieldset data-answer="b">
    <legend>Question text?</legend>
    <label><input type="radio" name="q1" value="a" /> Option text</label>
    <label><input type="radio" name="q1" value="b" /> Option text</label>
    <label><input type="radio" name="q1" value="c" /> Option text</label>
    <p class="feedback" hidden>Why b is right, with a citation link.</p>
  </fieldset>
  <p class="score" aria-live="polite"></p>
</form>
<script src="../assets/quiz.js" defer></script>
```

**Quiz behavior** (what `quiz.js` must do):

1. On load, find every `form.quiz`. A page may hold several, each scored on its own.
2. On a `change` event from a radio inside a `fieldset[data-answer]`:
   - add `picked` to the chosen label and `answer` to the label whose input `value` equals
     `data-answer`;
   - add `correct` or `wrong` to the fieldset;
   - unhide its `.feedback`;
   - disable every input in that fieldset;
   - set `.score` to `{right} of {total} answered right` while unanswered fieldsets remain.
3. When every fieldset is answered, set `.score` to `Score: {right}/{total}`. Then append one
   `<button type="button">Try again</button>` to the form. Clicking it resets the form: it
   removes the added classes, re-enables the inputs, hides the feedback, empties `.score` and
   removes the button.
4. Prevent form submit (`submit` → `preventDefault`).
5. Native radios give keyboard use for free. Do not replace them with custom controls.

**Stylesheet requirements**:

- Color tokens as custom properties on `:root`: `--bg`, `--fg`, `--muted`, `--accent`, `--rule`,
  `--ok`, `--bad`, `--card`. Redefine them in `@media (prefers-color-scheme: dark)`.
- `body`: explicit `background: var(--bg)`, `color: var(--fg)`, a system serif stack for
  body text, a system sans stack for headings and UI, `line-height: 1.6`.
- `main`: `max-width: 68ch`, centered, `padding: 2rem 1rem`.
- Visible `:focus-visible` outline using `--accent`.
- `.correct` and `.wrong` must signal with more than color. Use a left border plus the
  feedback text.
- `@media print`: hide `nav.crumbs`, `.ask` and quiz buttons; show every `.feedback`; use black
  text on white; avoid breaking inside `fieldset` and `.card`.
- No `@import`, no `url(` pointing to remote hosts.

## Commands you will need

| Purpose | Command                                                  | Expected on success |
| ------- | -------------------------------------------------------- | ------------------- |
| Format  | `npx prettier --write plugins/tutor/skills/teach/assets` | exit 0              |
| Lint    | `npx eslint plugins/tutor/skills/teach/assets`           | exit 0              |
| Syntax  | `node --check plugins/tutor/skills/teach/assets/quiz.js` | exit 0              |
| Gate    | `npm run check`                                          | exit 0              |

## Scope

**In scope**:

- `plugins/tutor/skills/teach/assets/style.css` (create)
- `plugins/tutor/skills/teach/assets/quiz.js` (create)
- `plugins/tutor/test/assets.test.mjs` (create)

**Out of scope**:

- `SKILL.md` and the format files. Plan 034 adds the copy rule and quiz rules.
- `course.mjs`, which plan 032 owns.
- Any other plugin's CSS or JS. Do not use them as templates.

## Git workflow

- Branch: `tutor/plan-033-starter-assets`
- One commit. Example subject: `feat(tutor): ship starter stylesheet and quiz widget`
- Do NOT push or open a PR.

## Steps

### Step 1: Write the failing static test

Create `plugins/tutor/test/assets.test.mjs` with `node:test`. It reads both files from
`../skills/teach/assets/` and asserts:

```js
test('stylesheet styles every contract selector and stays offline', () => {
  for (const sel of [
    'body.home',
    '.mission',
    '.continue .card',
    '.num',
    'ol.lessons',
    'ul.references',
    '.tag',
    'dl.glossary',
    '.avoid',
    'nav.crumbs',
    '.win',
    '.source',
    '.ask',
    'form.quiz',
    '.feedback',
    '.correct',
    '.wrong',
    '.answer',
    '.picked',
    '.score',
  ]) {
    assert.ok(css.includes(sel), sel);
  }
  assert.match(css, /prefers-color-scheme:\s*dark/);
  assert.match(css, /@media print/);
  assert.doesNotMatch(css, /@import|url\(\s*['"]?https?:/);
});

test('quiz widget is a classic script', () => {
  assert.doesNotMatch(js, /^\s*(import|export)\s/m);
  assert.ok(js.includes('data-answer') || js.includes('dataset.answer'));
  assert.ok(js.includes('Try again'));
});
```

**Verify**: `node --test plugins/tutor/test/assets.test.mjs` fails with ENOENT.

### Step 2: Write `style.css`

Follow the Stylesheet requirements and style every selector in the Class-name contract. Group
the file under short comments: tokens, base, course home, lesson parts, quiz, print. Aim for
120–170 lines after Prettier.

**Verify**: the first test passes.

### Step 3: Write `quiz.js`

Write an IIFE that follows the Quiz behavior. Open with a 2-line comment: what the file does,
and that the markup contract lives in the skill's lesson rules. Aim for 70–110 lines after
Prettier.

**Verify**: `node --check` exits 0 and both tests pass.

### Step 4: Check by hand in a browser

Create a scratch file outside the repo (for example in your OS temp folder):
`<tmp>/c/lessons/0001-t.html` with the Quiz markup contract (two fieldsets) and
`<link rel="stylesheet" href="../assets/style.css">`. Copy both assets to `<tmp>/c/assets/` and
open the lesson from `file://`.

**Verify**, by observation:

1. Answering shows the feedback and locks that question.
2. After both answers, the page shows `Score: n/2` and a "Try again" button.
3. "Try again" resets the form.
4. The browser console shows no errors.
5. Dark mode (set it in OS or devtools) changes the colors.

If no browser is available to you, write `manual browser check not run` in the status row.
Do not claim it passed.

### Step 5: Format, lint, gate, commit

**Verify**: format, lint and `npm run check` exit 0. Then commit the three in-scope files.

## Test plan

`assets.test.mjs` pins the selector contract and the offline and classic-script rules. The
quiz behavior has no automated DOM test (the repo has no DOM library, and adding one for
about 100 lines is not worth it). Step 4 is the behavior check.

## Review Focus

1. **Two quizzes on one page** (a lesson quiz plus a cold recall block): each scores on its
   own. A reviewer should read the code for `document`-wide queries that mix them up.
2. **A fieldset without `data-answer`** (the model forgot it): the widget ignores that
   fieldset and does not throw.
3. **Printing a lesson for review**: feedback shows, buttons hide.
4. **Keyboard-only learner**: arrow keys move between radios. Make sure picking with the
   keyboard does not lock the question on the first arrow press. Native `change` fires on
   arrow keys, so this is accepted, but check it is not confusing in the browser step.
5. **Learner edits their course copy of `style.css`**: nothing in the plugin overwrites it.
   Plan 034 says to copy only when missing.

## Done criteria

- [ ] `node --test plugins/tutor/test/assets.test.mjs` passes, 2 tests
- [ ] `node --check plugins/tutor/skills/teach/assets/quiz.js` exits 0
- [ ] `npm run check` exits 0
- [ ] `wc -l` reports `style.css` between 100 and 200 lines and `quiz.js` between 50 and 130 lines
- [ ] Browser check done, or explicitly recorded as not run
- [ ] `git status --short` shows only the in-scope files
- [ ] `plans/README.md` row 033 updated

## STOP conditions

- ESLint rejects the IIFE style under the repo config, and the fix needs an
  `eslint.config.js` change. Report it rather than editing the config.
- The behavior seems to need a quiz type other than single-choice radios. It is out of
  scope, so report it.

## Maintenance notes

- Class names here are a contract with plan 032 (`course.mjs` output) and plan 034
  (`SKILL.md` lesson rules). Rename all three together.
- Existing courses keep their copied assets. Improving the starters later only helps new
  courses, unless the learner deletes their copy.

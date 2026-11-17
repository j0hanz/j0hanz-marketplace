# Plan 020: Rules 17 and 7 of the writeup scan stop flagging correct text

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 08e36e3..HEAD -- plugins/writeup/hooks/scan.mjs plugins/writeup/test/scan.test.mjs plugins/writeup/skills/unslop/SKILL.md`
> Plans 018 and 019 edit other parts of `scan.mjs` (header comment, `TOKEN`, `targets`, `commandKind`); those are expected. A change to the `RULES` array (lines 25-47) is a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `08e36e3`, 2026-11-17

## Why this matters

The writeup scan reports AI writing patterns in Markdown files and commit/PR text, and the agent is expected to rewrite until the scan is clean. Two rules fire on correct text, which costs a rewrite and teaches the agent to ignore the scan:

- **Rule 17 (title-case headings)** counts the heading's first word. A sentence-case heading such as `## Installing Claude Code` has three capitalized 4+-letter words and fires, though the skill only asks for sentence case, where the first word is capitalized.
- **Rule 7 (AI vocabulary)** flags every `landscape`. The skill lists it as "landscape (abstract)", but UI docs use the word literally (`Rotate to landscape orientation.` fires).

## Current state

`plugins/writeup/hooks/scan.mjs:28-35`:

```js
  {
    id: 7,
    pattern:
      /\b(?:additionally|crucial\w*|delv\w*|enduring|enhanc(?:e[sd]?|ing)|foster\w*|garner\w*|interplay\w*|intricate\w*|landscape\w*|pivotal\w*|showcas(?:es|ed|ing)|tapestr\w*|testament\w*|underscor(?:es?\s+(?:the|how|that|why)|ed|ing)|vibrant\w*)\b/gi,
  },
  { id: 13, pattern: /—/g },
  // Title case heading: the heading text when it holds 3+ capitalized words. Case-sensitive.
  { id: 17, pattern: /(?<=^#{1,6} )(?=(?:.*?\b[A-Z][a-z]{3,}){3}).+$/g },
```

`plugins/writeup/skills/unslop/SKILL.md:28` (rule 7 text, the source of truth; the scan is a subset):

```text
7. **AI vocabulary.** Additionally, crucial, delve, enduring, enhance, fostering, garner, interplay, intricate, landscape (abstract), pivotal, showcase, tapestry (abstract), testament, underscore, vibrant. Replace with plain words.
```

`SKILL.md:41`: `17. **Title case headings.** Use sentence case.`

`findSlop` (`scan.mjs:58-68`) applies each pattern per line after stripping code, and reports `m[0]` as the match. Rule 17's match must stay the whole heading text: the existing test at `scan.test.mjs:18-35` expects one hit for `'## Getting Started With Docker'`.

Conventions: rule-7 exceptions are explained in the comment above it (`scan.mjs:26-27`); keep that style. Pattern for tests: `'inflections hit, lookalikes do not'` at `scan.test.mjs:48-57`.

Planning probe for the new rule 17 pattern below:

| Heading                                    | Old   | New                       |
| :----------------------------------------- | :---- | :------------------------ |
| `## Installing Claude Code`                | hit   | clean                     |
| `## Getting Started With Docker`           | hit   | hit                       |
| `## Using GitHub Copilot With Claude Code` | hit   | hit                       |
| `# Getting Started`                        | clean | clean                     |
| `## API reference`                         | clean | clean                     |
| `## Set up Claude Code and Antigravity`    | hit   | hit (accepted, see notes) |

## Commands you will need

| Purpose      | Command                                          | Expected on success |
| :----------- | :----------------------------------------------- | :------------------ |
| Plugin tests | `node --test plugins/writeup/test/scan.test.mjs` | `fail 0`            |
| Full gate    | `npm run check`                                  | exit 0              |

## Scope

**In scope**:

- `plugins/writeup/hooks/scan.mjs`: the rule 7 and rule 17 entries and their comments only
- `plugins/writeup/test/scan.test.mjs`

**Out of scope**:

- `plugins/writeup/skills/unslop/SKILL.md`. Its rule text already says what this plan implements. The model still applies the full rule; only the regex narrows.
- Every other rule in `RULES`, and adding new rules.
- `tapestr\w*`. It is also "(abstract)" in the skill, but no false hit was observed, so leave it.

## Git workflow

- Branch: `writeup/plan-020-rule-false-positives`
- One commit, e.g. `fix(writeup): stop rules 7 and 17 flagging literal landscape and sentence-case headings`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Rule 17 skips the heading's first word

Replace the rule 17 entry and its comment with:

```js
  // Title case heading: the heading text when 3+ words after the first are capitalized; sentence
  // case capitalizes the first. Case-sensitive.
  { id: 17, pattern: /(?<=^#{1,6} )(?=\S+(?:.*?\b[A-Z][a-z]{3,}){3}).+$/g },
```

The only change in the regex is `\S+` at the start of the lookahead. It consumes the first word, and no `\b` exists inside a word, so the first word cannot count.

**Verify**: `node --test plugins/writeup/test/scan.test.mjs` → `fail 0`.

### Step 2: Rule 7 flags only the abstract "landscape of"

In the rule 7 pattern, replace `landscape\w*` with `landscapes?\s+of`. Extend the comment above rule 7 (`scan.mjs:26-27`) with one sentence: `"landscape" only as "landscape of": orientation and layout docs use the literal word.`

**Verify**: `node --test plugins/writeup/test/scan.test.mjs` → `fail 0`.

### Step 3: Tests

See Test plan. Then `npm run check` → exit 0.

## Test plan

Add to `scan.test.mjs`:

1. `'sentence-case headings with proper nouns are not title case'`:
   - `findSlop('## Installing Claude Code')` deep-equals `[]`
   - `findSlop('# Getting Started')` deep-equals `[]`
   - `findSlop('## Using GitHub Copilot With Claude Code').map((h) => h.id)` deep-equals `[17]`
2. `'landscape flags only as "landscape of"'`:
   - `findSlop('Rotate to landscape orientation.')` deep-equals `[]`
   - `findSlop('The landscape of AI tools shifts.').map((h) => h.id)` deep-equals `[7]`

The existing `'each rule flags its sample'` test (rule 17 sample `## Getting Started With Docker`) must keep passing unchanged.

## Done criteria

- [ ] `node --test plugins/writeup/test/scan.test.mjs` reports `fail 0` with 2 new tests
- [ ] `npm run check` exits 0
- [ ] `grep -n "landscape" plugins/writeup/hooks/scan.mjs` shows only `landscapes?\s+of` and the comment line
- [ ] Only `scan.mjs`, `scan.test.mjs` and `plans/README.md` changed
- [ ] `plans/README.md` row 020 updated

## STOP conditions

- The `RULES` excerpts do not match the live file.
- The existing rule 17 sample test fails after step 1.
- You feel the need to edit `SKILL.md` or another rule.

## Maintenance notes

- Rule 17 still fires on a sentence-case heading with three or more capitalized proper nouns after the first word (`## Set up Claude Code and Antigravity`). That was accepted: a whitelist of product names would need upkeep, and such headings are rare. If it becomes common, a narrower test is a capitalized function word mid-heading (`With`, `And`, `For`, `From`).
- Rule 7 no longer catches "the AI landscape". The skill text still covers it for the model; only the hook misses it.

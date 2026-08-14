---
name: init
description: Bootstrap a repo's Claude Code context — a root CLAUDE.md, plus the hooks or skills the repo shows a reason for. Use on a repo that has none, or on a CLAUDE.md that has drifted into a survey and needs cutting back. Not for routing an ask through the chain (plan), authoring the body of a skill or hook ([write-skills](../write-skills/SKILL.md), [write-hooks](../write-hooks/SKILL.md)), or ranking a repo's structural debt (architecture-audit).
disable-model-invocation: true
---

# Init

`CLAUDE.md` is a **floor**, not a survey. It loads on every request in this repo from now
on, so each line is rent the whole repo pays forever. One test prices it:

> **Would a strong model behave worse without this line?**

A **surprise** passes — fact no capability recovers, because it is not in the repo to be
read. Everything a capable model already does, and everything the repo already says about
itself, fails. Expect to keep less than you want to.

## 1. Read the repo

Open the sources, one pass: manifest and lockfile (package manager, declared scripts),
test-runner and linter config, the CI workflow (the commands that actually gate a merge),
`README` and `docs/`, `.claude/` if present, and the last ~30 commits for a convention
nobody wrote down.

What you did not open, you cannot write. A line you believe rather than read is a template
blank, and a template blank gets filled with a plausible guess that outlives you.

**Done when** every candidate line traces to a file you opened, and each one you could not
confirm there is dropped instead of guessed.

## 2. Cut to the floor

Four survive:

- **Purpose** — one line on what the repo is. It anchors every later judgement call.
- **Package manager** — only when it is not the language default: `pnpm`, `bun`, `uv`,
  `poetry`. Default manager needs no line.
- **Commands** — build, test, lint, and only where the invocation surprises: a wrapper
  script, a workspace filter flag, a required order.
- **Gotchas** — generated trees that are never hand-edited, the step without which the
  suite fails, the thing that broke last time and cost an afternoon.

Five die — delete the sentence, do not rewrite it:

- **Restated defaults** — "write clean code", "handle errors", "think step by step".
- **Persona** — "you are a senior engineer with 12+ years of experience".
- **Emphasis scaffolding** — CRITICAL, IMPORTANT, all-caps imperatives, emoji markers.
- **Verification nudges** — "double-check", "re-read the file to confirm". These buy
  over-verification and wasted tokens, no quality. A deterministic gate is a different
  thing and stays: `npm run check` is a fact, "be careful" is not. Same for nudges to
  delegate more or self-correct more — both already run hot by default.
- **File trees** — a documented layout goes stale silently, and stale outranks absent for
  damage: the agent looks confidently in the wrong place. Name capabilities and domain
  vocabulary instead — those drift slower than paths.

True but occasional is not a cut, it is a move: one conversational link line in
`CLAUDE.md`, body in `docs/` or a skill. Light touch — a link, not an order to read it.

**Done when** every surviving line names something you could not derive from the repo in
one look, and everything else is either deleted or landed behind a link.

## 3. Write it, or cut it back

**No file yet** — write root `CLAUDE.md` from what step 2 kept, headings only over sections
that have content. A plain npm repo with nothing surprising in it earns four lines, and
four lines is a finished deliverable, not a stub. Generated is not comprehensive: the file
reports this repo, so anything a fresh clone of any repo could carry never belonged in it.

**File already there** — this is an edit pass, never an overwrite. Run each existing line
through the test and mark it keep, move, or cut. Two lines that contradict each other are
the user's call, not yours: quote both, ask which stands. Report the cut as a count and the
before/after line total, so the user can see what left.

Monorepo: nested `CLAUDE.md` merges with root. Package-specific facts go in the package's
file; root carries only what every package pays for.

**Done when** the file exists, every line in it passes the test, and — on an edit pass —
each cut line is deleted, moved behind a link, or resolved by the user's answer.

## 4. Hooks and skills, where the repo argues for one

Reason first, file second. The repo names the shape:

| Repo shows                                                                   | Output |
| :--------------------------------------------------------------------------- | :----- |
| Rule enforced mechanically — formatter, forbidden command, end-of-turn check | hook   |
| Procedure repeated with judgement in it — release, migration, review pass    | skill  |
| Neither                                                                      | none   |

A scaffolded `.claude/` is the filled-in template again, one directory up. Ship nothing
you cannot point at the repo fact that demanded it.

Where they land: `.claude/hooks/` with the registration block in `.claude/settings.json`;
`.claude/skills/<name>/SKILL.md`. This skill picks **whether and where** —
[write-hooks](../write-hooks/SKILL.md) and [write-skills](../write-skills/SKILL.md) pick
**how**, and own the authoring in full.

**Done when** each proposed hook or skill cites the repo fact that argues for it and is
authored by the skill that owns it — or none is proposed, and the user is told that the
repo showed no reason for one.

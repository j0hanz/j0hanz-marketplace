---
name: init
description: Bootstrap a repo's Claude Code context — a root CLAUDE.md, plus the hooks or skills the repo shows a reason for.
disable-model-invocation: true
---

# Init

`CLAUDE.md` is a **floor**, not a survey. It loads on every request in this repo from now
on, so every line is **rent**. One test prices it:

> **Would a strong model behave worse without this line?**

A **surprise** pays rent — a fact no capability recovers, because it is not in the repo to
be read. Everything a capable model already does, and everything the repo already says
about itself, fails.

## 1. Probe, then open what it points at

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/init/probe.mjs"
```

Bare, it reports the whole repo from its git root, wherever you invoke it. Append the
directory the invocation carried, when it carried one, and the brief covers that directory
alone — which is what a monorepo package needs before its own `CLAUDE.md`. Every cap it hit
is disclosed in the section that hit it.

The brief is aim, not lines: stack, declared commands, what CI gates on, mechanical
surprises, and **leads** — the questions its facts raise but cannot answer. Most of it
fails rent on sight; a framework readable from `package.json` never belonged in
`CLAUDE.md`.

Then read. Not the repo — the four places a floor line actually comes from:

- `README` and `docs/` — the purpose line, and what the repo already says about itself.
- The **body** behind each declared command. A wrapper, a required order, a workspace
  filter lives in the body; the name shows none of it.
- Every file the Surprises section named, plus the commits themselves where it says a
  convention is only mostly held.
- The existing `CLAUDE.md` and agent context, line by line, where the brief found one.

A line you believe rather than read is a guess that outlives you.

**Done when** every candidate line traces to a file you opened, and each one you could not
confirm there is dropped.

## 2. Grill, one round

The highest-value lines are the ones no probe reaches: what broke last, what a newcomer
gets wrong, which rule is worth enforcing. Put every lead and every question step 1 left
open into **one** round of **AskUserQuestion** — [grilling](../grilling/SKILL.md) owns it
instead where the decisions have prerequisites and need a map.

Four classes earn a question:

- **Gotcha** — always ask, open form: what broke last, what cost an afternoon, what a
  newcomer gets wrong. The probe cannot see these, and they are the highest-value floor
  lines. Where the brief flagged a mechanical one (generated tree, second lockfile,
  CI-only command), adjudicate it in the same question: does it hold, and what does
  getting it wrong cost? A gotcha nobody pays for is trivia.
- **Contradiction** — two lines of an existing `CLAUDE.md` disagree, or a second doctrine
  file says otherwise. Quote both, ask which stands.
- **Hook** — the mistake made twice. Which rule has to hold every time, whoever is typing?
- **Skill** — the procedure with judgement in it. Which one gets explained to a human more
  than once a month? Options are **skill** (hand off to [write-skills](../write-skills/SKILL.md)),
  **floor-line** (a line in `CLAUDE.md` is the procedure), or **neither** — never bundle line
  and skill into one option. The choice is settled here, not reopened at step 4.

The last three ask even when the brief surfaced no candidate — gotcha, hook, and skill
all have no other source, and a repo that wants none says so in one click. Never ask what
the probe answered; that spends the round-trip on nothing.

**Done when** every lead is settled or dropped with the user's reason on it, and the
gotcha, hook, and skill questions each carry an answer — the user's "none" counts.

## 3. Write the floor

Four kinds of line survive:

- **Purpose** — one line on what the repo is. It anchors every later judgement call.
- **Package manager** — only where it is not the language default: `pnpm`, `bun`, `uv`,
  `poetry`.
- **Commands** — build, test, lint, and only where the invocation surprises: a wrapper
  script, a workspace filter flag, a required order.
- **Gotcha** — the generated tree never hand-edited, the step without which the suite
  fails, the thing that broke last time and cost an afternoon.

Five die — delete the sentence, do not rewrite it:

- **Restated defaults** — "write clean code", "handle errors", "think step by step".
- **Persona** — "you are a senior engineer with 12+ years of experience".
- **Emphasis scaffolding** — CRITICAL, IMPORTANT, all-caps imperatives, emoji markers.
- **Verification nudges** — "double-check", "re-read the file to confirm", "delegate more".
  These buy over-verification and wasted tokens, no quality. A deterministic gate is a fact
  and stays — `npm run check` is one, "be careful" is not.
- **File trees** — a documented layout goes stale silently, and stale outranks absent for
  damage: the agent looks confidently in the wrong place. Name capabilities and domain
  vocabulary instead, which drift slower than paths.

True but occasional is a move, not a cut: one conversational link line in `CLAUDE.md`, body
in `docs/` or a skill. A link, not an order to read it.

**No file yet** — write root `CLAUDE.md` from what survived, headings only over sections
that have content. A plain npm repo with nothing surprising in it earns four lines, and
four lines is a finished deliverable, not a stub.

**File already there** — an edit pass, never an overwrite. Run each existing line through
rent and mark it keep, move, or cut. Report the count cut and the before/after line total,
so the user sees what left.

Monorepo: a nested `CLAUDE.md` merges with root, so the package file carries package facts
and root carries only what every package pays for.

**Done when** the file exists, every line in it pays rent, and each line that did not is
deleted, moved behind a link, or resolved by the user's answer.

## 4. Hook or skill, where step 2 got a yes

| Repo shows                                                                   | Output |
| :--------------------------------------------------------------------------- | :----- |
| Rule enforced mechanically — formatter, forbidden command, end-of-turn check | hook   |
| Procedure repeated with judgement in it — release, migration, review pass    | skill  |
| Neither                                                                      | none   |

Ship nothing you cannot point at the repo fact that demanded it — a scaffolded `.claude/`
is a filled-in template one directory up. Hooks land in `.claude/hooks/` with the
registration block in `.claude/settings.json`; skills in `.claude/skills/<name>/SKILL.md`.
This skill picks **whether and where**; [write-hooks](../write-hooks/SKILL.md) and
[write-skills](../write-skills/SKILL.md) pick **how** and own the authoring in full.

**Done when** each one shipped cites its repo fact and the user's yes, and is authored by
the skill that owns it — or none is, and the user is told the repo showed no reason for
one.

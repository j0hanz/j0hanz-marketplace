---
name: prototype
description: Use when the user wants to sanity-check whether a state model or logic feels right, or explore what a UI should look like.
---

# Prototype

Prototype = **throwaway code answering one question**. Question decides shape.

## Pick a branch

Name question from user prompt and surrounding code:

- **"Does this logic / state model hold up?"** → [LOGIC.md](LOGIC.md). One shareable HTML file (free-play buttons + tabbed guided walkthroughs) pushing model through cases hard to reason about on paper; non-developer can drive it.
- **"Which layout should this be?"** → [UI.md](UI.md). Several structurally different variations on one route of real app, switchable via `?variant=` search param and floating bottom bar.

Branches produce very different artifacts. Question still ambiguous? Ask user which before building. Backend module → logic; page or component → UI.

Not this skill:

- Whole visual identity up for grabs (new look, art direction): visual design skill, if installed.
- Decision user can settle by talking: `groundwork:grilling`.
- Real feature to build: project's normal workflow. Prototype answers question, then thrown away.

## Rules that apply to both

1. **Throwaway from day one, marked so.** Place prototype next to module or page it's for; put `prototype` in file or route name. UI routes: follow project routing convention; no new top-level structure.
2. **Trivial to run.** Logic demo = one HTML file: open it for user (`start <path>` on Windows, `open <path>` on macOS, `xdg-open <path>` on Linux) and give absolute path. UI prototype runs on project's existing dev command: give command and URLs with each `?variant=` key.
3. **No persistence by default.** State in memory. If question is about persistence, use scratch DB or local file named `PROTOTYPE-wipe-me` or similar.
4. **Skip polish.** No tests, no error handling beyond making it run, no abstractions. Point: learn fast.
5. **Surface state.** After every action (logic) or variant switch (UI), render full relevant state so user sees what changed.
6. **Speak domain.** Labels, scenario names, variant names use terms in `GLOSSARY.md` when project has one.

## When the question is answered

1. Write verdict: question, answer, what surprised user.
2. Fold validated decision into real code, rewritten properly. Prototype code had no tests or error handling.
3. Decision with load-bearing reason future readers would re-litigate? Call Skill tool with `groundwork:domain-modeling`, offer ADR. New domain terms surfaced? Same skill, update `GLOSSARY.md`.
4. Remove prototype from working tree. Ask user first whether to keep copy, e.g. on `prototype/<name>` branch. No branches or commits without asking.

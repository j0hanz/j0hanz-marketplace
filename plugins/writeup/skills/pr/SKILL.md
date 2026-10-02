---
name: pr
description: Use when writing or updating a pull request description, or before running `gh pr create`.
---

**REQUIRED:** apply writeup:unslop to all prose, and writeup:show-me for every visual.

## Description

Read the branch diff (`git diff <base>...HEAD`) first. A PR description has these parts, in this order:

1. **Summary line.** One sentence naming the behavior a user gets, with no part, file or count. The PR title takes the same shape. Name any unrelated change on the branch in one line.
2. **Why.** The problem before the change, or what it unblocks, in 1 to 3 lines.
3. **Behavior.** What triggers each new behavior and what it does. If it handles part of a set, say part. Give a component only the role the diff gives it. Strings, flags and numbers stay in the code. A convention the repo's instructions require is not a feature, even one this change first implements.
4. **Visuals.** One per structural change, made with writeup:show-me. Nodes name components or steps. A comment or caption says what the step does, never a code number or a convention it follows.
5. **Testing.** The command you ran and its result, in one or two lines. If you ran nothing, exactly one line saying so and nothing else. Tick a checklist item only for a command you ran.
6. **Review focus.** Where to look first. Each item is a way the new behavior could go wrong, not a test that covers it or a choice made on purpose. Say it in words, without code numbers. A gap in how the change tests a convention, such as a path tested only by simulation, is an item. The convention is not.

If the repo has `.github/pull_request_template.md`, use its sections in order, keep its checklist, and put each part in its closest section, visuals included. If no section fits review focus, add `## Review focus` after them.

Leave out file or commit lists, edits that follow from the change (a catalog entry, a generated region), and claims the diff does not support, such as parts from other branches.

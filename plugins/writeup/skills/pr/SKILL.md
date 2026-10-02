---
name: pr
description: Use when writing or updating a pull request description, or before running `gh pr create`.
---

**REQUIRED:** apply writeup:unslop to all prose, and writeup:show-me for every visual.

## Description

Read the branch diff (`git diff <base>...HEAD`) first. A PR description has these parts, in this order:

1. **Summary line.** One sentence naming the behavior a user gets, with no part, file or count. The PR title takes the same shape. If it handles part of a set, say part, and give a component only the role the diff gives it. Name any unrelated change on the branch in one line.
2. **Why.** The problem before the change, or what it unblocks, in 1 to 3 lines.
3. **Visuals.** One per structural change, made with writeup:show-me. Nodes, comments and captions name components or steps only.
4. **Testing.** The command you ran and its result, in one or two lines. If you ran nothing, exactly one line saying so and nothing else. Tick a checklist item only for a command you ran.
5. **Review focus.** Ways this change could go wrong, each checked against the code, not a test that covers it or a restatement of the design.

If the repo has `.github/pull_request_template.md`, use its sections in order, keep its checklist, and put each part in its closest section, visuals included. If no section fits review focus, add `## Review focus` after them.

In prose and visuals, write no number from the code (a limit, a threshold, a count of shown items) and no line on which host, client or environment a component serves or the format it writes there, unless it names a gap in how that is tested, such as a path tested only by simulation.

Leave out file or commit lists, edits that follow from the change (a catalog entry, a generated region), and unsupported claims, such as parts from other branches.

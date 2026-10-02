---
name: pr
description: Use when writing or updating a pull request description, or before running `gh pr create`.
---

**REQUIRED:** apply writeup:unslop to all prose, and writeup:show-me for every visual.

## Description

Read the branch diff (`git diff <base>...HEAD`) first. Describe each behavior by what triggers it and what it does, not what it guarantees or covers. A PR description has these parts, in this order:

1. **Summary line.** One sentence naming the behavior a user gets. Name no part, file or count. The PR title takes the same shape. Name any unrelated change on the branch in one more line.
2. **Why.** The problem before the change, or what it unblocks, in 1 to 3 lines.
3. **Visuals.** One for each structural change, made with writeup:show-me. Label each node with the name of a component or step only.
4. **Testing.** The command you ran and its result, in one or two lines. If you ran nothing, the section is exactly one line saying so and nothing else. In a template checklist, tick an item only for a command you ran.
5. **Review focus.** Where a reviewer should look first, and what could break. Each item names a risk specific to this change's new behavior, not a test that covers it or a repo-wide rule.

If the repo has `.github/pull_request_template.md`, use its sections in order and keep its checklist. Put each part above in the template's closest section, visuals included. If the template has no place for review focus, add a short `## Review focus` section after its sections.

## What to leave out

The reviewer has the diff. Leave out, in prose and in visuals:

- Code: matcher strings, regexes, rule ids, flags, and numbers such as caps and thresholds.
- Edits that follow from the change, such as a catalog entry, a generated region or a file list.
- Rules the repo applies to every change, also when phrased as something to check.
- Claims the diff does not support, such as parts from other branches.

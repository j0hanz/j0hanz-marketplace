---
name: pr
description: Use when writing or updating a pull request description, or before running `gh pr create`.
---

**REQUIRED:** apply writeup:unslop to all prose, and writeup:show-me for every visual.

## Description

Read the branch diff (`git diff <base>...HEAD`) first. Describe each behavior by what triggers it and what it does, not what it guarantees or covers. A PR description has these parts, in this order:

1. **Summary line.** One sentence naming the behavior a user gets. Name no part, file or count. The PR title takes the same shape. Name any unrelated change on the branch in one more line.
2. **Why.** The problem before the change, or what it unblocks, in 1 to 3 lines.
3. **Visuals.** Made with writeup:show-me, following its "In a pull request" section.
4. **Testing.** The command you ran and its result, in one or two lines. If you ran nothing, the section is exactly one line saying so and nothing else. In a template checklist, tick an item only for a command you ran.
5. **Review focus.** Where a reviewer should look first, and what could break. Each item names a risk specific to this change's new behavior, not a test that covers it.

If the repo has `.github/pull_request_template.md`, use its sections in order and keep its checklist. Put each part above in the template's closest section, visuals included. If the template has no place for review focus, add a short `## Review focus` section after its sections.

## What to leave out

The reviewer has the diff. Leave out, in prose and in visuals:

- Code in prose: identifiers, string literals, regexes, flags and any number from the code.
- Edits that follow from the change, such as a catalog entry, a generated region or a file list.
- Conventions the repo's instructions file requires, even when this change first implements one: no review item, diagram note or feature line. Only a gap in how this change tests one, such as a path tested only by simulation, is a review item.
- Claims the diff does not support, such as parts from other branches.

Done when the parts above appear in order, every number in the description is a test result or a fact about the problem, and every unrelated change on the branch has its line.

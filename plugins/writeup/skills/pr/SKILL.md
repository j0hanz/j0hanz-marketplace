---
name: pr
description: Use when writing or updating a pull request description, or before running `gh pr create`.
---

**REQUIRED:** apply writeup:unslop to all prose, writeup:show-me for every visual.

## Description

Read branch diff (`git diff <base>...HEAD`) first. Describe each behavior by trigger and effect, not guarantee or coverage. PR description parts, in order:

1. **Summary line.** One sentence naming behavior user gets. No part, file or count. PR title same shape. Unrelated change on branch: one more line.
2. **Why.** Problem before change, or what it unblocks, 1 to 3 lines.
3. **Visuals.** Made with writeup:show-me, per its "In a pull request" section.
4. **Testing.** Command run and result, one or two lines. Ran nothing: section is exactly one line saying so, nothing else. Template checklist: tick item only for command you ran.
5. **Review focus.** Where reviewer look first, what could break. Each item names risk specific to this change's new behavior, not test covering it.

Repo has `.github/pull_request_template.md`: use its sections in order, keep its checklist. Put each part above in template's closest section, visuals included. Template no place for review focus: add short `## Review focus` section after its sections.

## What to leave out

Reviewer has diff. Leave out, in prose and visuals:

- Code in prose: identifiers, string literals, regexes, flags, any number from code.
- Edits following from change, e.g. catalog entry, generated region, file list.
- Conventions repo's instructions file requires, even when this change first implements one: no review item, diagram note or feature line. Only gap in how this change tests one, e.g. path tested only by simulation, is review item.
- Claims diff not support, e.g. parts from other branches.

Done when parts above appear in order, every number in description is test result or fact about problem, every unrelated change on branch has its line.

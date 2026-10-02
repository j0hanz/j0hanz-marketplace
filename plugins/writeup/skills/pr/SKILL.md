---
name: pr
description: Use when writing or updating a pull request description, or before running `gh pr create`.
---

**REQUIRED:** apply writeup:unslop to all prose, and writeup:show-me for every visual.

## Description

Read the branch diff (`git diff <base>...HEAD`) first. A PR description has these parts, in this order:

1. **Summary line.** One sentence on what the change does that the code did not do before. Leave the version, the category and a count of parts to the diff.
2. **Why.** The problem before the change, or what it unblocks, in 1 to 3 lines.
3. **Visuals.** One for each structural change, made with writeup:show-me.
4. **Testing.** Run the repo's checks, then give the command and its result, such as the pass count. If you did not run them, say so in one line.
5. **Review focus.** Where a reviewer should look first, and what could break: a false positive, an edge case, a path the tests miss.

If the repo has `.github/pull_request_template.md`, use its sections in order and keep its checklist. Put each part above in the template's closest section, visuals included. If the template has no place for review focus, add a short `## Review focus` section after its sections.

## What to leave out

The reviewer has the diff and the repo's instructions. Write only what they cannot show, and leave out:

- A list of the files changed, or of the commits.
- Code details such as caps, flags and constants.
- Compliance with rules every change in the repo follows, such as those in the repo's instructions file.
- Claims about tests or behavior the diff does not contain.

Size it to the change. A part with nothing to say gets one line or none.

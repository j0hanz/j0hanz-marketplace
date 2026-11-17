---
name: review
description: Use when writing a code review or review comment, or before running `gh pr review` or `gh pr comment` on someone's PR.
---

**REQUIRED:** apply writeup:unslop to all prose.

Scope: review body and comments posted with `gh pr review` or `gh pr comment`. Inline line comments posted through `gh api` are not covered.

## Review body

Read the diff first. Review body parts, in order:

1. **Verdict first.** Body opens with the decision matching the flag (`--approve`, `--request-changes`, `--comment`) and the count of blocking items.
2. **Each comment.** Starts with a label: `blocking`, `non-blocking`, or `nit`. Then the location (`path:line`), the failure as a concrete scenario (input or state, then wrong result), and the fix.
3. **Order.** Blocking first, then non-blocking, then nits.

Example:

```text
Requesting changes: 1 blocking item.

blocking src/cache.js:57
When two requests for the same key arrive before the first resolves, both miss and both write. The second write overwrites a newer value with stale data. Store the pending promise in the map, not the result.
```

## What to leave out

- Praise padding.
- Restating what the diff does.
- Points the linter or formatter enforces.
- Hedges ("might want to consider").

Done when every `blocking` or `non-blocking` comment names a failure scenario and a fix, and the verdict matches the flag.

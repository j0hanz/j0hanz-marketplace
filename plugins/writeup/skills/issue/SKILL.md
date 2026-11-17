---
name: issue
description: Use when writing or editing a GitHub issue or issue comment, or before running `gh issue create`.
---

**REQUIRED:** apply writeup:unslop to all prose.

## Bug report

Issue body parts, in this order:

1. **Title.** Observed failure in one line, present tense. No "bug:" prefix unless repo's labels or title log use one.
2. **What happens.** Observed behavior. Exact error text in a `text` fence, trimmed to decisive lines.
3. **Expected.** One line.
4. **Repro.** Numbered minimal steps from a clean state. Commands copy-pasteable.
5. **Environment.** Only versions that bear on it (OS, runtime, tool version), copied from the report. Version the report did not give: leave out, never invent.
6. **Cause** (optional). Only when verified, with `file:line`. A guess is labeled as one.

Example:

```text
Title: export drops the last row when the table has one column

## What happens
`tabx export t.db out.csv` writes every row except the last.

    wrote 41 rows (table has 42)

## Expected
Output has 42 rows.

## Repro
1. `tabx new t.db --columns id`
2. `tabx insert t.db 1 2 3`
3. `tabx export t.db out.csv`
4. `wc -l out.csv` prints 2, not 3.

## Environment
tabx 1.8.0, Ubuntu 24.04

## Cause
Guess: the writer stops one row early when there is no delimiter to flush.
```

## Feature request

Parts, in order: **Title** names the capability. **Problem** says who hits what today. **Proposal** gives the behavior wanted. **Alternatives** is optional.

## Issue comment

`gh issue comment`: one new fact per comment, e.g. a repro result, a version, a verified cause.

## Template

Repo has `.github/ISSUE_TEMPLATE/`: use the matching template's sections in order. Put each part above in template's closest section.

## What to leave out

- Thanks and greetings.
- Agent's session story ("while working on X I noticed").
- A fix nobody asked for.
- Attribution to the model.

Done when a reader who never saw the session can reproduce the bug (or state the problem) from the issue alone, and every claim of cause is verified or labeled a guess.

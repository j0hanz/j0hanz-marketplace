---
name: commit
description: Use when writing a commit message, or before running `git commit`.
---

**REQUIRED:** apply writeup:unslop to all prose.

## Message

A commit message has these parts, in this order:

1. **Subject.** One line in the imperative mood, 72 characters or fewer.
2. **Blank line.**
3. **Body.** Say why the change exists: the problem before it, an alternative you rejected, or a side effect the reader would not expect. The reason usually fits in 1 to 3 lines. Wrap every line at 72 characters.
4. **Trailers.** After a blank line, such as `Co-Authored-By:`.

## What the body leaves out

The reader has the diff. Write only what the diff cannot show, and leave out:

- A list of the files changed, or what each one does.
- A list of the test cases.
- Code details such as constants, caps and flags.
- Conventions every change in the repo already follows, such as rules from the repo's instructions file.

## Example

```text
feat(writeup): flag slop as prose is written

The unslop skill only helps when a model loads it. A hook catches
slop in files, commits and PR bodies that skipped the skill.
```

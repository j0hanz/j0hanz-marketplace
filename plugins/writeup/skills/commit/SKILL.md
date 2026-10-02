---
name: commit
description: Use when writing a commit message, or before running `git commit`.
---

**REQUIRED:** apply writeup:unslop to all prose.

## Message

A commit message has these parts, in this order:

1. **Subject.** One line in the imperative mood, 72 characters or fewer.
2. **Blank line.**
3. **Body.** One paragraph of at most 3 lines, wrapped at 72 characters, that states the problem the change solves. It does not repeat the subject and names no file, function or constant. The reader has the diff for those. When the subject already states the problem, as for a typo fix, there is no body.
4. **Trailers.** After a blank line, such as `Co-Authored-By:`.

Also leave out of the body:

- A list of the test cases.
- Conventions every change in the repo already follows, such as rules from the repo's instructions file.

Done when the subject fits in 72 characters and a reader who has not seen the diff knows from the body what was wrong before.

## Example

```text
fix(auth): retry the token refresh once on a 401

The auth server rotates its signing key every hour, so a token
issued just before the rotation fails once. Users were logged out.
```

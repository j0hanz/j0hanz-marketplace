---
name: commit
description: Use when writing a commit message, or before running `git commit`.
---

**REQUIRED:** apply writeup:unslop to all prose.

## Message

Read the staged diff (`git diff --cached`) first. A commit message has these parts, in this order:

1. **Subject.** `type(scope): summary`, the Conventional Commits form. The type is one of `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `build`, `ci`, `style` or `revert`. The scope is the area the change touches, such as a package or plugin name, and is optional. The summary is in the imperative mood ("add", not "added" or "adds"), lowercase after the colon unless the repo's log says otherwise, with no trailing period. Aim for 50 characters; 72 is the limit. A `!` after the scope marks a breaking change.
2. **Blank line.**
3. **Body.** One paragraph of at most 3 lines, wrapped at 72 characters, that states the problem the change solves. It does not repeat the subject and names no file, function or constant. The reader has the diff for those. When the subject already states the problem, as for a typo fix, there is no body.
4. **Footer.** After a blank line: issue references such as `Closes #42` or `Refs #17`, a `BREAKING CHANGE:` line that says what a caller must change, then trailers such as `Co-Authored-By:`.

A breaking change, a security fix, a data migration or a revert always has a body. That body says what breaks, what was exposed, what moves, or why the earlier change went back.

## What to leave out

- "This commit", "I", "we", "now", "currently". The diff says what changed; the body says why.
- A list of the test cases.
- Conventions every change in the repo already follows, such as rules from the repo's instructions file.
- Attribution to the model or tool that wrote the change, except as a trailer the repo's own rules ask for.

## Examples

A subject that names the behavior, and a body that names the problem:

```text
feat(api): add GET /users/:id/profile

The mobile client loads the full user payload on every cold launch
to read three profile fields. Launch on LTE took over two seconds.

Closes #128
```

A body that states what was wrong before:

```text
fix(auth): retry the token refresh once on a 401

The auth server rotates its signing key every hour, so a token
issued just before the rotation fails once. Users were logged out.
```

A breaking change:

```text
feat(api)!: rename /v1/orders to /v1/checkout

The orders route also took cart edits, so a client could not tell a
placed order from an open cart.

BREAKING CHANGE: callers of /v1/orders must move to /v1/checkout
before 2026-06-01. The old route returns 410 after that date.
```

## Boundaries

Write the message. Stage, amend or push only when the user asked for it. When the user asked for the message and not the commit, hand it back in a code block ready to paste.

Done when the subject fits in 72 characters and a reader who has not seen the diff knows what was wrong before, from the body or, when there is none, from the subject.

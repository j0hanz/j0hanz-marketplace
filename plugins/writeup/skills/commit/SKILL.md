---
name: commit
description: Use when writing a commit message, or before running `git commit`.
---

**REQUIRED:** apply writeup:unslop to all prose.

## Message

Read staged diff (`git diff --cached`) first. Commit message parts, in order:

1. **Subject.** `type(scope): summary`, Conventional Commits form. Type one of `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `build`, `ci`, `style`, `revert`. Scope = area touched (package or plugin name), optional. Summary imperative mood ("add", not "added"/"adds"), lowercase after colon unless repo log says otherwise, no trailing period. Aim 50 chars; 72 limit. `!` after scope marks breaking change.
2. **Blank line.**
3. **Body.** One paragraph, max 3 lines, wrapped at 72 chars, states problem change solves. No repeat of subject, no file/function/constant names. Reader has diff for those. Subject already states problem (e.g. typo fix) → no body.
4. **Footer.** After blank line: issue refs like `Closes #42` or `Refs #17`, `BREAKING CHANGE:` line saying what caller must change, then trailers like `Co-Authored-By:`.

Breaking change, security fix, data migration, revert always have body. Body says what breaks, what exposed, what moves, or why earlier change reverted.

## What to leave out

- "This commit", "I", "we", "now", "currently". Diff says what changed; body says why.
- List of test cases.
- Conventions every repo change already follows, e.g. rules from repo's instructions file.
- Attribution to model/tool that wrote change, except as trailer repo's rules require.

## Examples

Subject names behavior, body names problem:

```text
feat(api): add GET /users/:id/profile

The mobile client loads the full user payload on every cold launch
to read three profile fields. Launch on LTE took over two seconds.

Closes #128
```

Body states what was wrong before:

```text
fix(auth): retry the token refresh once on a 401

The auth server rotates its signing key every hour, so a token
issued just before the rotation fails once. Users were logged out.
```

Breaking change:

```text
feat(api)!: rename /v1/orders to /v1/checkout

The orders route also took cart edits, so a client could not tell a
placed order from an open cart.

BREAKING CHANGE: callers of /v1/orders must move to /v1/checkout
before 2026-06-01. The old route returns 410 after that date.
```

## Boundaries

Write message. Stage, amend, push only when user asked. User asked for message, not commit → return it in code block ready to paste.

Done when subject fits 72 chars and reader who has not seen diff knows what was wrong before, from body or, if none, from subject.

---
name: docs
description: Use when writing or updating a README, CHANGELOG, release notes, or other repo markdown docs.
---

**REQUIRED:** apply writeup:unslop to all prose.

## README

A README has these parts, in this order:

1. **Title and one sentence.** Say what the project does.
2. **Install.** Write one command block for each client or package manager the project supports. Check the manifests for every target first, then cover all of them.
3. **Usage.** Give one concrete example: the exact command or prompt the user types, then what they get back.
4. **Reference.** Link to the source of truth, such as the SKILL.md, the API docs, or the `--help` output, with one line per item. Keep its lists, tables and catalogs where they are. A copy goes stale when the source changes.
5. **License.**

Leave out what only maintainers need: internal file trees, internal ids, notes written for contributors, and hardcoded version numbers. The manifest holds the version.

## Changelog entry

A changelog entry has these parts, in this order:

1. **Version.** Read the commits since the last tag with `git log <last-tag>..HEAD`. A breaking change (`!` after the type, or a `BREAKING CHANGE` footer) means a major bump. Otherwise a `feat` means a minor bump, and fixes alone mean a patch bump.
2. **Heading.** Write `## <version> - <YYYY-MM-DD>` with the release date.
3. **Breaking changes.** List them first, in their own `### Breaking` section, each with what users must change.
4. **Everything else.** Group the remaining user-facing changes under their own headings after that.

# j0hanz-marketplace

Personal Claude Code plugin marketplace. Every plugin lives in this repo.

## Install

```text
/plugin marketplace add j0hanz/j0hanz-marketplace
/plugin install tutor@j0hanz-marketplace
```

Swap `tutor` for any plugin below. Skills are namespaced by plugin: `/tutor:teach`, `/css:css-audit`, `/review:clean-code`.

## Plugins

| Plugin                     | What it does                                                                                                           |
| :------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| [craft](plugins/craft)     | Write skills and hooks that behave — the vocabulary that makes a skill predictable, plus authoring and debugging hooks |
| [css](plugins/css)         | Refuses CSS writes carrying provable defects, advises on performance and accessibility failures                        |
| [mcp-hub](plugins/mcp-hub) | MCP development skills for TypeScript SDK v2, with auditor, debugger and migrator agents                               |
| [prompt](plugins/prompt)   | Rewrites a rough, half-formed prompt into one that works on current Claude models                                      |
| [review](plugins/review)   | Clean Code readability pass and a strict maintainability review, both behavior-preserving                              |
| [tutor](plugins/tutor)     | Turns a folder into a course: spaced repetition, offline HTML lessons sealed behind a retrieval quiz                   |

## Layout

```text
.claude-plugin/marketplace.json    the catalog — one entry per plugin
plugins/<name>/
  .claude-plugin/plugin.json       manifest (only this file goes here)
  skills/<skill>/SKILL.md          skills
  agents/*.md                      subagents
  hooks/hooks.json                 hooks
```

Every component directory sits at the plugin root, never inside `.claude-plugin/`.

## Local use

Install from a checkout instead of GitHub:

```text
/plugin marketplace add /absolute/path/to/j0hanz-marketplace
```

Validate before pushing:

```bash
claude plugin validate .
claude plugin validate ./plugins/<name>
```

## Adding a plugin

1. `plugins/<name>/.claude-plugin/plugin.json` with at least `"name"`.
2. Components at the plugin root.
3. An entry in `.claude-plugin/marketplace.json` — `name`, `source`, `description`, `category`.
4. Validate.

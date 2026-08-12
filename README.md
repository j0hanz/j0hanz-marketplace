# j0hanz-marketplace

[![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin%20marketplace-D97757)](https://code.claude.com/docs/en/plugin-marketplaces)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Claude Code plugins: skills and agents you can install into any project.

## Install

**1. Add the marketplace** (once, from inside Claude Code):

```text
/plugin marketplace add j0hanz/j0hanz-marketplace
```

**2. Install a plugin.** One command per plugin, so pick only what you need:

<!-- install:start -->

```text
/plugin install tutor@j0hanz-marketplace
/plugin install css@j0hanz-marketplace
/plugin install mcp-hub@j0hanz-marketplace
/plugin install craft@j0hanz-marketplace
/plugin install review@j0hanz-marketplace
/plugin install prompt@j0hanz-marketplace
/plugin install output-styles@j0hanz-marketplace
```

<!-- install:end -->

**3. Use it.** Type the skill as a slash command, namespaced by plugin:

```text
/tutor:teach
/css:css-audit
/review:clean-code
```

Or browse everything installed with `/plugin`. To remove one:

```text
/plugin uninstall tutor@j0hanz-marketplace
```

## Plugins

<!-- plugins:start -->

### tutor

Teach one topic across many sessions: workspace, spaced repetition, offline HTML lessons sealed behind a retrieval quiz

- Commands: `/tutor:teach`
- Hooks: `SessionStart`, `Stop`

### css

Stops agents wrecking your CSS: refuses writes carrying provable defects, advises on performance and accessibility failures

- Commands: `/css:css-audit`, `/css:css-craft`, `/css:motion-craft`
- Hooks: `PreToolUse`, `PostToolUse`, `Stop`, `SessionStart`

### mcp-hub

MCP development skills for TypeScript SDK v2

- Commands: `/mcp-hub:mcp`
- Model-loaded skills: `mcp-auth`, `mcp-client`, `mcp-elicitation`, `mcp-migration`, `mcp-planning`, `mcp-protocol`, `mcp-router`, `mcp-server`, `mcp-test`
- Agents: `mcp-auditor`, `mcp-debugger`, `mcp-migrator`
- Hooks: `SessionStart`

### craft

Author Claude Code extensions properly: what makes a skill predictable, and how to write, audit and debug hooks

- Commands: `/craft:writing-hooks`, `/craft:writing-skills`

### review

Clean Code readability pass and a strict maintainability review, both behavior-preserving

- Commands: `/review:clean-code`, `/review:code-quality-review`

### prompt

Rewrites a rough, half-formed prompt into one that works on current Claude models

- Commands: `/prompt:prompting`

### output-styles

Set a global output style — Concise, TL;DR, or Diagram-first — via a picker skill

- Commands: `/output-styles:set-style`

<!-- plugins:end -->

## Requirements

Claude Code, and nothing else. Plugins install from this repo with no build step and no dependencies.

## License

[MIT](LICENSE)

# j0hanz-marketplace

[![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin%20marketplace-D97757)](https://code.claude.com/docs/en/plugin-marketplaces)
[![Plugins](https://img.shields.io/badge/plugins-6-blue)](#plugins)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Claude Code plugins: skills and agents you can install into any project.

## Install

**1. Add the marketplace** (once, from inside Claude Code):

```text
/plugin marketplace add j0hanz/j0hanz-marketplace
```

**2. Install a plugin.** One command per plugin, so pick only what you need:

```text
/plugin install tutor@j0hanz-marketplace
/plugin install css@j0hanz-marketplace
/plugin install mcp-hub@j0hanz-marketplace
/plugin install craft@j0hanz-marketplace
/plugin install review@j0hanz-marketplace
/plugin install prompt@j0hanz-marketplace
```

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

### tutor

Turns a folder into a course: spaced repetition, offline HTML lessons sealed behind a retrieval quiz.

| Skill          | What it does                    |
| :------------- | :------------------------------ |
| `/tutor:teach` | Teach one topic across sessions |

### css

Stops agents wrecking your CSS. Refuses writes carrying provable defects, flags performance and accessibility failures.

| Skill               | What it does                   |
| :------------------ | :----------------------------- |
| `/css:css-audit`    | Audit existing CSS for defects |
| `/css:css-craft`    | Write CSS that holds up        |
| `/css:motion-craft` | Animation and transition work  |

### mcp-hub

MCP (Model Context Protocol) development for the TypeScript SDK v2.

| Skill                      | What it does             |
| :------------------------- | :----------------------- |
| `/mcp-hub:mcp`             | Entry point for MCP work |
| `/mcp-hub:mcp-server`      | Build a server           |
| `/mcp-hub:mcp-client`      | Build a client           |
| `/mcp-hub:mcp-auth`        | Authentication           |
| `/mcp-hub:mcp-protocol`    | Protocol details         |
| `/mcp-hub:mcp-planning`    | Plan an MCP integration  |
| `/mcp-hub:mcp-router`      | Routing                  |
| `/mcp-hub:mcp-elicitation` | Elicitation flows        |
| `/mcp-hub:mcp-test`        | Testing                  |
| `/mcp-hub:mcp-migration`   | Migrate to SDK v2        |

Also ships three agents Claude picks up automatically: `mcp-auditor`, `mcp-debugger`, `mcp-migrator`.

### craft

Author Claude Code extensions properly: what makes a skill predictable, and how to write, audit and debug hooks.

| Skill                   | What it does                 |
| :---------------------- | :--------------------------- |
| `/craft:writing-skills` | Write skills that behave     |
| `/craft:writing-hooks`  | Write, audit and debug hooks |

### review

Two behavior-preserving review passes over existing code.

| Skill                         | What it does                  |
| :---------------------------- | :---------------------------- |
| `/review:clean-code`          | Readability pass              |
| `/review:code-quality-review` | Strict maintainability review |

### prompt

Rewrites a rough, half-formed prompt into one that works on current Claude models.

| Skill               | What it does     |
| :------------------ | :--------------- |
| `/prompt:prompting` | Rewrite a prompt |

## Requirements

Claude Code, and nothing else. Plugins install from this repo with no build step and no dependencies.

## License

[MIT](LICENSE)

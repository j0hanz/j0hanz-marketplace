# j0hanz-marketplace

[![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin%20marketplace-D97757)](https://code.claude.com/docs/en/plugin-marketplaces)
[![GitHub Copilot CLI](https://img.shields.io/badge/GitHub%20Copilot%20CLI-plugin%20marketplace-8957E5)](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-cli-plugins)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Plugins for Claude Code and GitHub Copilot CLI: skills, agents, and MCP servers you can install into any project. One catalog serves both clients.

## Install in Claude Code

**1. Add the marketplace** (once, from inside Claude Code):

```text
/plugin marketplace add j0hanz/j0hanz-marketplace
```

**2. Install a plugin.** One command per plugin, so pick only what you need:

<!-- install:start -->

```text
/plugin install tutor@j0hanz-marketplace
/plugin install css@j0hanz-marketplace
/plugin install frontend@j0hanz-marketplace
/plugin install mcp-hub@j0hanz-marketplace
/plugin install filesystem-mcp@j0hanz-marketplace
/plugin install review@j0hanz-marketplace
/plugin install prompt@j0hanz-marketplace
/plugin install workbench@j0hanz-marketplace
/plugin install output-styles@j0hanz-marketplace
/plugin install nodejs@j0hanz-marketplace
/plugin install typescript-pro@j0hanz-marketplace
/plugin install writeup@j0hanz-marketplace
/plugin install telltale@j0hanz-marketplace
```

<!-- install:end -->

**3. Use it.** Check MCP server connections with `/mcp`, or type an invocable skill as a slash command, namespaced by plugin:

```text
/tutor:teach
/css:css-audit
/review:code-quality-review
```

Or browse everything installed with `/plugin`. To remove one:

```text
/plugin uninstall tutor@j0hanz-marketplace
```

## Install in GitHub Copilot CLI

Copilot CLI reads the same catalog (`.claude-plugin/marketplace.json`). From a shell, add the marketplace once, then install what you need:

<!-- copilot:start -->

```text
copilot plugin marketplace add j0hanz/j0hanz-marketplace
copilot plugin install tutor@j0hanz-marketplace
copilot plugin install css@j0hanz-marketplace
copilot plugin install frontend@j0hanz-marketplace
copilot plugin install mcp-hub@j0hanz-marketplace
copilot plugin install filesystem-mcp@j0hanz-marketplace
copilot plugin install review@j0hanz-marketplace
copilot plugin install prompt@j0hanz-marketplace
copilot plugin install workbench@j0hanz-marketplace
copilot plugin install nodejs@j0hanz-marketplace
copilot plugin install typescript-pro@j0hanz-marketplace
copilot plugin install writeup@j0hanz-marketplace
```

<!-- copilot:end -->

Check with `copilot plugin list`, or `/skills` and `/agent` inside a session. Copilot lists plugin skills by bare name (`css-audit`, not `css:css-audit`). Remove one with `copilot plugin uninstall <name>`.

**Copilot cloud agent.** It installs no plugins by default. A repository opts in through `.github/copilot/settings.json`, which Copilot CLI also reads (same entry shape as Claude Code's `extraKnownMarketplaces`):

```json
{
  "extraKnownMarketplaces": {
    "j0hanz-marketplace": { "source": { "source": "github", "repo": "j0hanz/j0hanz-marketplace" } }
  },
  "enabledPlugins": { "css@j0hanz-marketplace": true }
}
```

**What differs under Copilot**

- `output-styles` is Claude Code only: Copilot has no output styles.
- Hooks detect the client and answer in its shape. Stop-time notes that Claude shows as a system message surface as a hook warning in Copilot.
- The Claude `UserPromptExpansion` event does not exist in Copilot, so typed-slash-command briefs fire through `PreToolUse` on the skill tool instead.

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

### frontend

Designs and reviews frontend UI: invents art-directed page direction from a brief, shapes perceived wait with the right loading pattern, and audits UI code against web interface guidelines

- Commands: `/frontend:design`, `/frontend:guidelines`, `/frontend:wait`
- Hooks: `Stop`

### mcp-hub

MCP development skills for TypeScript SDK v2

- Commands: `/mcp-hub:mcp`
- Model-loaded skills: `mcp-auth`, `mcp-client`, `mcp-elicitation`, `mcp-migration`, `mcp-planning`, `mcp-protocol`, `mcp-router`, `mcp-server`, `mcp-test`
- Agents: `mcp-auditor`, `mcp-debugger`, `mcp-migrator`
- Hooks: `SessionStart`, `PostToolUse`

### filesystem-mcp

Project-scoped filesystem MCP tools for batched reads, RE2 search, diffs, and edits. Requires Node.js 24+

- MCP servers: `filesystem` (stdio)

### review

One strict behavior-preserving review of a diff: how the code reads, and how it is shaped

- Commands: `/review:code-quality-review`

### prompt

Rewrites a rough, half-formed prompt into one that works on current Claude models

- Commands: `/prompt:prompting`

### workbench

Every tool for the job on one bench: decide, research, spec, plan, build test-first, debug, refactor, review, audit, verify — plus authoring the skills, hooks and QA docs you reach for next

- Commands: `/workbench:architecture-audit`, `/workbench:bug-hunt`, `/workbench:clean-code`, `/workbench:diagnose`, `/workbench:frontier`, `/workbench:grilling`, `/workbench:handoff`, `/workbench:ideation`, `/workbench:init`, `/workbench:plan-hunt`, `/workbench:prototype`, `/workbench:qc`, `/workbench:refactor`, `/workbench:research`, `/workbench:run-plan`, `/workbench:spec-hunt`, `/workbench:tdd`, `/workbench:verify-specs`, `/workbench:write-adr`, `/workbench:write-hooks`, `/workbench:write-plan`, `/workbench:write-qa`, `/workbench:write-skills`, `/workbench:write-specs`
- Hooks: `PreToolUse`, `SessionStart`, `UserPromptSubmit`, `UserPromptExpansion`, `Stop`

### output-styles

Set a global output style — Concise, TL;DR, Diagram-first, or Schematic — with `/set-style <style>` (Claude Code only)

- Commands: `/output-styles:set-style`
- Hooks: `UserPromptExpansion`

### nodejs

Node.js backend conventions and implementation patterns: framework selection, layered architecture, fail-fast validation, pooled transactions, a single error envelope, graceful drain, plus security and production hardening checklists

- Commands: `/nodejs:nodejs-backend-patterns`, `/nodejs:nodejs-best-practices`

### typescript-pro

TypeScript type system skills: type-level utilities and type tests, .d.ts declaration contracts for packages and untyped APIs, JSDoc type-checking for plain .js files, and tsconfig selection by runtime

- Commands: `/typescript-pro:advanced-types`, `/typescript-pro:declaration-contracts`, `/typescript-pro:jsdoc-types`, `/typescript-pro:tsconfig`

### writeup

PR descriptions and commit messages written for people: plain prose, structural diagrams, slop flagged on write.

- Commands: `/writeup:commit`, `/writeup:pr`, `/writeup:show-me`, `/writeup:unslop`
- Hooks: `PostToolUse`

### telltale

See how Claude uses your skills and MCP servers: a receipt under each answer, a pane of every tool call with what Claude read back and did next, context cost per server and skill, per-turn JSONL logs. Observe-only, local files only (Claude Code only)

<!-- plugins:end -->

## Requirements

Claude Code, and nothing else. Plugins install from this repo with no build step and no dependencies.

## License

[MIT](LICENSE)

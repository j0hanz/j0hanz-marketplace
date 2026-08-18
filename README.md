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
/plugin install frontend@j0hanz-marketplace
/plugin install mcp-hub@j0hanz-marketplace
/plugin install review@j0hanz-marketplace
/plugin install prompt@j0hanz-marketplace
/plugin install workbench@j0hanz-marketplace
/plugin install output-styles@j0hanz-marketplace
/plugin install nodejs@j0hanz-marketplace
/plugin install typescript-pro@j0hanz-marketplace
```

<!-- install:end -->

**3. Use it.** Type the skill as a slash command, namespaced by plugin:

```text
/tutor:teach
/css:css-audit
/review:code-quality-review
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

### review

One strict behavior-preserving review of a diff: how the code reads, and how it is shaped

- Commands: `/review:code-quality-review`

### prompt

Rewrites a rough, half-formed prompt into one that works on current Claude models

- Commands: `/prompt:prompting`

### workbench

Every tool for the job on one bench: decide, spec, plan, build test-first, review, verify — plus authoring the skills, hooks and QA docs you reach for next

- Commands: `/workbench:architecture-audit`, `/workbench:bug-hunt`, `/workbench:clean-code`, `/workbench:diagnose`, `/workbench:frontier`, `/workbench:grilling`, `/workbench:handoff`, `/workbench:ideation`, `/workbench:init`, `/workbench:plan-hunt`, `/workbench:prototype`, `/workbench:qc`, `/workbench:refactor`, `/workbench:research`, `/workbench:run-plan`, `/workbench:spec-hunt`, `/workbench:tdd`, `/workbench:verify-specs`, `/workbench:write-adr`, `/workbench:write-hooks`, `/workbench:write-plan`, `/workbench:write-qa`, `/workbench:write-skills`, `/workbench:write-specs`
- Hooks: `PreToolUse`, `SessionStart`, `UserPromptSubmit`, `UserPromptExpansion`, `Stop`

### output-styles

Set a global output style — Concise, TL;DR, Diagram-first, or Schematic — with `/set-style <style>`

- Commands: `/output-styles:set-style`
- Hooks: `UserPromptExpansion`

### nodejs

Node.js backend conventions and implementation patterns: framework selection, layered architecture, fail-fast validation, pooled transactions, a single error envelope, graceful drain, plus security and production hardening checklists

- Commands: `/nodejs:nodejs-backend-patterns`, `/nodejs:nodejs-best-practices`

### typescript-pro

TypeScript type system skills: type-level utilities and type tests, .d.ts declaration contracts for packages and untyped APIs, JSDoc type-checking for plain .js files, and tsconfig selection by runtime

- Commands: `/typescript-pro:advanced-types`, `/typescript-pro:declaration-contracts`, `/typescript-pro:jsdoc-types`, `/typescript-pro:tsconfig`

<!-- plugins:end -->

## Requirements

Claude Code, and nothing else. Plugins install from this repo with no build step and no dependencies.

## License

[MIT](LICENSE)

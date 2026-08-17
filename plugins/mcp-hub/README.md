# MCP Hub Plugin

<!-- docs-maintainer:START -->

![Claude](https://img.shields.io/badge/Claude-D97757?logo=claude&logoColor=fff&style=for-the-badge) ![GitHub Copilot](https://img.shields.io/badge/GitHub_Copilot-000000?logo=githubcopilot&logoColor=fff&style=for-the-badge) ![Version](https://img.shields.io/github/v/tag/j0hanz/j0hanz-marketplace?label=version&style=for-the-badge) ![License](https://img.shields.io/github/license/j0hanz/j0hanz-marketplace?style=for-the-badge)
<!-- docs-maintainer:END -->

A plugin for [Claude Code](https://claude.com/claude-code) and [GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli): skills and agents for building, testing, auditing, distributing, and migrating MCP servers and clients with the [MCP TypeScript SDK v2](https://ts.sdk.modelcontextprotocol.io/v2/) (`2.0.0-beta.3`, protocol revision `2026-07-28`).

## Install

### Claude Code

```bash
/plugin marketplace add j0hanz/j0hanz-marketplace
/plugin install mcp-hub@j0hanz-marketplace
```

### GitHub Copilot CLI

```bash
/plugin marketplace add j0hanz/j0hanz-marketplace
/plugin install mcp-hub@j0hanz-marketplace
```

Or from a terminal:

```bash
copilot plugin marketplace add j0hanz/j0hanz-marketplace
copilot plugin install mcp-hub@j0hanz-marketplace
```

## Usage

`/mcp` is the single command: with no argument it lists the available jobs; `/mcp <job>` routes to the right skills in the right order.

| Command         | What it does                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| `/mcp`          | List available jobs                                                                                      |
| `/mcp plan`     | Clarify requirements first: produces a Decision Record (`docs/mcp-decisions.md`)                         |
| `/mcp build`    | Build end to end: interview → scaffold → auth → test → ship                                              |
| `/mcp audit`    | Read-only production-readiness audit of existing MCP code                                                |
| `/mcp migrate`  | Upgrade SDK v1 code to v2                                                                                |
| `/mcp auth`     | OAuth, bearer-token, or machine-to-machine auth                                                          |
| `/mcp test`     | Write and run MCP tests; debug connection failures, `ProtocolError`/`SdkError` codes, inspector sessions |
| `/mcp elicit`   | Add progress reporting, cancellation, or mid-call user input                                             |
| `/mcp protocol` | Drop below `McpServer` for custom transports or raw protocol messages                                    |
| `/mcp publish`  | Package a server for npm/npx and register it with MCP hosts                                              |

Knowledge skills load automatically when the work touches their territory, without a command:

`mcp-planning`, `mcp-server`, `mcp-client`, `mcp-auth`, `mcp-elicitation`, `mcp-test`, `mcp-protocol`, `mcp-migration`

A SessionStart hook (`hooks/session-start.js`) injects the `/mcp` routing table into context at session start and after `/clear` or compaction (~3.1KB), so MCP work routes to the right skill without typing `/mcp`. Runs natively and cross-platform via Node.js (supported on Windows, macOS, and Linux).

## Agents

Three subagents handle work that's autonomous or context-heavy rather than a single command. Claude Code and Copilot CLI dispatch them automatically when a task matches their description. No `/mcp` invocation needed.

| Agent          | Handles                                                                 | Write access                                         |
| -------------- | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| `mcp-auditor`  | Read-only production-readiness audit of existing MCP server/client code | Tool-enforced read-only (Read, Grep, Glob, Skill)    |
| `mcp-migrator` | Runs the SDK v1 → v2 migration (codemod through verify) end to end      | Edits files                                          |
| `mcp-debugger` | Diagnoses connection failures and `ProtocolError`/`SdkError` codes      | Restricted (no Write/Edit; Bash retained for probes) |

Defined under `agents/*.md`; each loads the matching `mcp-*` skill for its checklist instead of duplicating it.

## Contributing

Issues and PRs are welcome at [j0hanz/j0hanz-marketplace](https://github.com/j0hanz/j0hanz-marketplace). Skills live under `plugins/mcp-hub/skills/*/SKILL.md`, agents under `plugins/mcp-hub/agents/*.md`. See [Maintenance](#maintenance) for what to keep in sync when the SDK version changes.

## Maintenance

The SDK version (`2.0.0-beta.3`) is targeted by the six SDK-facing skills: `mcp-server`, `mcp-client`, `mcp-auth`, `mcp-test`, `mcp-migration`, `mcp-protocol`. The literal version string appears in this README (intro) and in `skills/mcp-client/SKILL.md` and `skills/mcp-test/SKILL.md`; `skills/mcp-server/SKILL.md`'s Distribute step pins by policy ("the current beta, no `^`") without a literal. The protocol revision (`2026-07-28`) is referenced across the skills — when either changes, grep the repo for the old string and review every hit.

## License

[MIT](LICENSE)

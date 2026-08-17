---
name: mcp
description: 'Parse explicit `/mcp <job>` requests and dispatch planning, builds, audits, v1 migrations, authorization, tests, elicitation, protocol work, or publishing; generic MCP routing uses mcp-router.'
user-invocable: true
argument-hint: '[plan|build|audit|migrate|auth|test|elicit|protocol|publish]'
metadata:
  category: technique
---

# Parse `/mcp` commands

## Dispatch

Read `<job>` from an explicit `/mcp <job>` command, load its target, and continue after it is available. Route a generic MCP SDK request through [mcp-router](../mcp-router/SKILL.md).

- **No job** — list `plan`, `build`, `audit`, `migrate`, `auth`, `test`, `elicit`, `protocol`, and `publish`, then request one token.
- **Plan** — load [mcp-planning](../mcp-planning/SKILL.md) to make and record architecture decisions.
- **Build** — load [mcp-server](../mcp-server/SKILL.md) for a server or [mcp-client](../mcp-client/SKILL.md) for a client; load [mcp-planning](../mcp-planning/SKILL.md) first when `docs/mcp-decisions.md` is absent.
- **Audit** — dispatch `mcp-auditor` for a read-only MCP SDK v2 readiness review.
- **Migrate** — dispatch `mcp-migrator` to move an MCP SDK v1 codebase to v2.
- **Authorize** — load [mcp-auth](../mcp-auth/SKILL.md) for resource-server bearer validation or service credentials.
- **Test** — load [mcp-test](../mcp-test/SKILL.md) to author or run tests; dispatch `mcp-debugger` for runtime failures.
- **Elicit** — load [mcp-elicitation](../mcp-elicitation/SKILL.md) for user interaction, progress, or cancellation.
- **Protocol** — load [mcp-protocol](../mcp-protocol/SKILL.md) for custom transports or low-level messages.
- **Publish** — load [mcp-server](../mcp-server/SKILL.md) for distribution.

Completion: an explicit `<job>` selects one target before work starts, or a bare command returns the complete job list.

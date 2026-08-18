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

Read `<job>` from explicit `/mcp <job>` command, load target, continue after ready. Generic MCP SDK request route through [mcp-router](../mcp-router/SKILL.md).

- **No job** — list `plan`, `build`, `audit`, `migrate`, `auth`, `test`, `elicit`, `protocol`, `publish`, then request one token.
- **Plan** — load [mcp-planning](../mcp-planning/SKILL.md), make + record architecture decisions.
- **Build** — load [mcp-server](../mcp-server/SKILL.md) for server or [mcp-client](../mcp-client/SKILL.md) for client; load [mcp-planning](../mcp-planning/SKILL.md) first when `docs/mcp-decisions.md` absent.
- **Audit** — dispatch `mcp-auditor`, read-only MCP SDK v2 readiness review.
- **Migrate** — dispatch `mcp-migrator`, move MCP SDK v1 codebase to v2.
- **Auth** — load [mcp-auth](../mcp-auth/SKILL.md) for resource-server bearer validation or service credentials.
- **Test** — load [mcp-test](../mcp-test/SKILL.md) to write or run tests; dispatch `mcp-debugger` for runtime failures.
- **Elicit** — load [mcp-elicitation](../mcp-elicitation/SKILL.md) for user interaction, progress, cancellation.
- **Protocol** — load [mcp-protocol](../mcp-protocol/SKILL.md) for custom transports or low-level messages.
- **Publish** — load [mcp-server](../mcp-server/SKILL.md) for distribution.

Done: explicit `<job>` selects one target before work start, or bare command returns full job list.

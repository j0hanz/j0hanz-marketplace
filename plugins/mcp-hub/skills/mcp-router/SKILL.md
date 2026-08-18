---
name: mcp-router
description: 'Route: cross-cutting MCP SDK v2 work to its owning specialist; direct server, client, auth, protocol, or test work loads that skill.'
user-invocable: false
metadata:
  category: technique
---

# MCP SDK v2 Router

Route work span responsibility. Classify direct work by primary deliverable, load only skills implementation touch.

## Route

| Deliverable                                                            | Load or dispatch                                                                                         |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| New architecture or design record                                      | [mcp-planning](../mcp-planning/SKILL.md)                                                                 |
| High-level server, transport hosting, scaling, or release              | [mcp-server](../mcp-server/SKILL.md)                                                                     |
| Client connection, calls, subscriptions, cache, or browser OAuth       | [mcp-client](../mcp-client/SKILL.md)                                                                     |
| HTTP resource-server protection or service credentials                 | [mcp-auth](../mcp-auth/SKILL.md)                                                                         |
| Elicitation, progress, cancellation, or multi-round interaction        | [mcp-elicitation](../mcp-elicitation/SKILL.md)                                                           |
| Low-level `Server`, custom transport, raw wire data, gateway, or relay | [mcp-protocol](../mcp-protocol/SKILL.md)                                                                 |
| SDK v1 migration                                                       | Dispatch `mcp-migrator`; use [mcp-migration](../mcp-migration/SKILL.md) for decisions and rename tables. |
| Server/client test coverage or inspector probe                         | [mcp-test](../mcp-test/SKILL.md)                                                                         |
| Reproduced runtime protocol or SDK failure                             | Dispatch `mcp-debugger`.                                                                                 |
| Read-only production audit                                             | Dispatch `mcp-auditor`.                                                                                  |

## Coordinate

1. **Assign ownership**: Load specialist each distinct implementation concern; new server/client design start [mcp-planning](../mcp-planning/SKILL.md).
   - [ ] Every requested concern one owning skill/agent; overlap concern explicit boundary.

2. **Verify handoffs**: Let each specialist complete own checks; use [mcp-test](../mcp-test/SKILL.md) after implementation, [mcp-server](../mcp-server/SKILL.md) "Distribute" before release.
   - [ ] Every selected skill's completion criteria pass, released server/client behavior match test evidence.

## Audit Workflow

Canonical read-only sweep, existing MCP implementation. `mcp-auditor` load each named specialist only when step reached.

1. **Locate**: Scan source, manifests for `@modelcontextprotocol/sdk` (v1 single-package import).
   - [ ] Every MCP dependency, source import classified v1 or split v2 package.

2. **Version**: v1 package/import = Blocker, load [mcp-migration](../mcp-migration/SKILL.md). Classify remaining version surfaces:
   - SEP-2577 deprecations: `listRoots`, `sendRootsListChanged`, `sendLoggingMessage`, `createMessage`, `setLoggingLevel`; `registerClient` (SEP-991); variadic `.tool()`/`.prompt()`/`.resource()` registration = Should Fix.
   - v1→v2 renames: `McpError`, `ErrorCode`, `StreamableHTTPError`, `JSONRPCError`, `ResourceReference`, `IsomorphicHeaders`, `RequestHandlerExtra`, schema-first `setRequestHandler(`, `Invalid*Error` OAuth classes = Blockers.
   - Removed transports (not renames): `SSEServerTransport`, `WebSocketClientTransport` removed — migrate Streamable HTTP (temp v1 bridge `@modelcontextprotocol/server-legacy/sse`; WebSocket clients use `StreamableHTTPClientTransport` or `StdioClientTransport`). Blockers.
   - Removed experimental tasks (SEP-2663): `ProtocolOptions.tasks`, `taskManager`, `registerToolTask`, `TaskStore`, `InMemoryTaskStore`, `requestStream`, `callToolStream`, `createMessageStream`, `elicitInputStream`, `Experimental*Tasks` = Blockers; remove rather than mechanical migration.
   - [ ] Every matched version surface ranked with finding, [mcp-migration](../mcp-migration/SKILL.md) owns remediation.

3. **Design**: Load [mcp-server](../mcp-server/SKILL.md) or [mcp-client](../mcp-client/SKILL.md) each implemented role, assess registered capabilities, transport, lifecycle.
   - [ ] Every server/client role checked against owning skill.

4. **Security**: Each HTTP boundary, load [mcp-auth](../mcp-auth/SKILL.md), assess authentication, authorization, Host/Origin controls.
   - [ ] Every HTTP boundary has documented security finding or passing [mcp-auth](../mcp-auth/SKILL.md) assessment.

5. **Interactions**: Load [mcp-elicitation](../mcp-elicitation/SKILL.md) when implementation expose prompts, progress, cancellation, multi-round interaction.
   - [ ] Every implemented interaction surface checked against [mcp-elicitation](../mcp-elicitation/SKILL.md).

6. **Tests**: Load [mcp-test](../mcp-test/SKILL.md), assess evidence each implemented transport, error channel.
   - [ ] Every implemented transport has matching test evidence or ranked gap.

7. **Intent**: Compare implementation decisions with `docs/mcp-decisions.md` when exists.
   - [ ] Every recorded decision confirmed or has ranked contradiction.

8. **Report**: Emit Blockers, Should Fix, then Nice to Have findings as `- [file:line] | [Issue details] | [Skill to fix]`.
   - [ ] Every finding has source location, rank, owning remediation skill.

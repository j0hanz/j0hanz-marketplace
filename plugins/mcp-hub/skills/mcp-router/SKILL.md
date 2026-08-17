---
name: mcp-router
description: 'Route: cross-cutting MCP SDK v2 work to its owning specialist; direct server, client, auth, protocol, or test work loads that skill.'
user-invocable: false
metadata:
  category: technique
---

# MCP SDK v2 Router

Route work that spans responsibilities. Classify direct work by its primary deliverable and load only the skills its implementation actually reaches.

## Route

| Deliverable                                                            | Load or dispatch                                                                                         |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| New architecture or a design record                                    | [mcp-planning](../mcp-planning/SKILL.md)                                                                 |
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

1. **Assign ownership**: Load the specialist for each distinct implementation concern; a new server or client design starts with [mcp-planning](../mcp-planning/SKILL.md).
   - [ ] Every requested concern has one owning skill or agent; overlapping concerns have an explicit boundary.

2. **Verify handoffs**: Let each selected specialist complete its own checks; use [mcp-test](../mcp-test/SKILL.md) after implementation and [mcp-server](../mcp-server/SKILL.md) “Distribute” before release.
   - [ ] Every selected skill's completion criteria pass, and released server/client behavior has matching test evidence.

## Audit Workflow

Use this canonical read-only sweep for an existing MCP implementation. `mcp-auditor` loads each named specialist only when its step is reached.

1. **Locate**: Scan source and manifests for `@modelcontextprotocol/sdk` (the v1 single-package import).
   - [ ] Every MCP dependency and source import is classified as v1 or a split v2 package.

2. **Version**: Treat a v1 package or import as a Blocker and load [mcp-migration](../mcp-migration/SKILL.md). Classify remaining version surfaces:
   - SEP-2577 deprecations: `listRoots`, `sendRootsListChanged`, `sendLoggingMessage`, `createMessage`, `setLoggingLevel`; `registerClient` (SEP-991); and variadic `.tool()`/`.prompt()`/`.resource()` registration are Should Fix.
   - v1→v2 renames: `McpError`, `ErrorCode`, `StreamableHTTPError`, `JSONRPCError`, `ResourceReference`, `IsomorphicHeaders`, `RequestHandlerExtra`, schema-first `setRequestHandler(`, `SSEServerTransport`, `WebSocketClientTransport`, and `Invalid*Error` OAuth classes are Blockers.
   - Removed experimental tasks (SEP-2663): `ProtocolOptions.tasks`, `taskManager`, `registerToolTask`, `TaskStore`, `InMemoryTaskStore`, `requestStream`, `callToolStream`, `createMessageStream`, `elicitInputStream`, and `Experimental*Tasks` are Blockers; remove them rather than applying a mechanical migration.
   - [ ] Every matched version surface is ranked with the applicable finding and [mcp-migration](../mcp-migration/SKILL.md) owns its remediation.

3. **Design**: Load [mcp-server](../mcp-server/SKILL.md) or [mcp-client](../mcp-client/SKILL.md) for each implemented role and assess its registered capabilities, transport, and lifecycle.
   - [ ] Every server and client role is checked against its owning skill.

4. **Security**: For each HTTP boundary, load [mcp-auth](../mcp-auth/SKILL.md) and assess authentication, authorization, and Host/Origin controls.
   - [ ] Every HTTP boundary has a documented security finding or a passing [mcp-auth](../mcp-auth/SKILL.md) assessment.

5. **Interactions**: Load [mcp-elicitation](../mcp-elicitation/SKILL.md) when the implementation exposes prompts, progress, cancellation, or multi-round interaction.
   - [ ] Every implemented interaction surface is checked against [mcp-elicitation](../mcp-elicitation/SKILL.md).

6. **Tests**: Load [mcp-test](../mcp-test/SKILL.md) and assess the evidence for each implemented transport and error channel.
   - [ ] Every implemented transport has matching test evidence or a ranked gap.

7. **Intent**: Compare implementation decisions with `docs/mcp-decisions.md` when it exists.
   - [ ] Every recorded decision is confirmed or has a ranked contradiction.

8. **Report**: Emit Blockers, Should Fix, then Nice to Have findings as `- [file:line] | [Issue details] | [Skill to fix]`.
   - [ ] Every finding has a source location, rank, and owning remediation skill.

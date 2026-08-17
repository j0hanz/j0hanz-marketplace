---
name: mcp-router
description: Session-injected routing map for MCP SDK v2 work.
user-invocable: false
disable-model-invocation: true
metadata:
  category: technique
---

# MCP Router & Workflows

Entry point and canonical workflows for MCP SDK v2. Load sub-skills on-demand (never upfront or twice).

## Routing Map

- **Plan**: [mcp-planning]
- **Build**: [mcp-server] (server) or [mcp-client] (client)
- **Auth**: [mcp-auth]
- **Elicit**: [mcp-elicitation]
- **Protocol**: [mcp-protocol]
- **Gateway/proxy/relay**: [mcp-protocol]
- **Migrate**: `mcp-migrator` agent (runs codemods) — for reference material load [mcp-migration]
- **Test**: [mcp-test]
- **Debug**: `mcp-debugger` agent (on failure).
- **Audit**: `mcp-auditor` agent (read-only)
- **Publish**: [mcp-server] "Distribute"

## Workflows

### Build Workflow

1. **Clarify**: Run [mcp-planning] -> output `docs/mcp-decisions.md`.
2. **Scaffold**: Load [mcp-server] or [mcp-client]. Modern split v2 SDK deps, ESM-first; CommonJS also resolves.
3. **Auth** (*): HTTP/OAuth (Streamable HTTP) security. Load [mcp-auth].
4. **Interact** (*): Prompts, progress, cancellation. Load [mcp-elicitation].
5. **Test**: Load [mcp-test] to implement tests; they compile and run to completion.
6. **Distribute** (*): Package setup / deployment. See [mcp-server] "Distribute".
7. **Verify**: All prior phase checks pass.

### Audit Workflow

1. **Locate**: Scan for `@modelcontextprotocol/sdk` (v1 single-package) imports.
2. **Version**: If SDK v1, load [mcp-migration] (flag as Blocker).
   - **Version (deprecated APIs)**: Grep for SEP-2577-deprecated subsystems (`listRoots`, `sendRootsListChanged`, `sendLoggingMessage`, `createMessage`, `setLoggingLevel`), deprecated `registerClient` (SEP-991), and the removed variadic `.tool()`/`.prompt()`/`.resource()` registration — flag as Should Fix.
   - **Version (v1→v2 renames)**: Grep for `McpError`, `ErrorCode`, `StreamableHTTPError`, `JSONRPCError`, `ResourceReference`, `IsomorphicHeaders`, `RequestHandlerExtra`, schema-first `setRequestHandler(`, `SSEServerTransport`, `WebSocketClientTransport`, and the `Invalid*Error` OAuth classes — flag as **Blocker**.
   - **Version (removed tasks)**: Grep for `ProtocolOptions.tasks`, `taskManager`, `registerToolTask`, `TaskStore`, `InMemoryTaskStore`, `requestStream`/`callToolStream`/`createMessageStream`/`elicitInputStream`, `Experimental*Tasks` — the experimental tasks feature is removed (SEP-2663); flag as **Blocker** (no mechanical migration; remove usages).
3. **Design**: Check structure via [mcp-server] / [mcp-client].
4. **Security** (*): Audit auth (HTTP). Load [mcp-auth].
5. **Interact** (*): Audit prompts/progress/cancellation. Load [mcp-elicitation].
6. **Tests**: Check test coverage via [mcp-test].
7. **Intent**: Validate code matches `docs/mcp-decisions.md`.
8. **Report**: Rank findings: Blockers, Should Fix, Nice to Have. Formatted as:
   `- [file:line] | [Issue details] | [Skill to fix]`

### Migrate Workflow

Canonical steps live in [mcp-migration] (scope → codemod → packages → flags → era → modernize → mcpserver → tsconfig → verify). Dispatch the `mcp-migrator` agent to execute; load [mcp-migration] for reference tables (renames, package split, era adoption).

### Debug Workflow

1. **Reproduce**: Capture the failing request/response or error code.
2. **Classify**: Match the error against [mcp-test] "Error Code Reference" (`ProtocolErrorCode` / `SdkErrorCode`).
3. **Isolate**: Narrow to transport, protocol, auth, or application layer; reload the matching skill ([mcp-client] / [mcp-protocol] / [mcp-auth] / [mcp-server]).
4. **Fix**: Apply the fix; re-run the reproducer.

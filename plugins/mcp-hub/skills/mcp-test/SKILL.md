---
name: mcp-test
description: Use when writing or running tests for an MCP server or client in the TypeScript SDK v2 — test setup, inspector sessions, and coverage/assertion patterns. For diagnosing runtime misbehavior (connection failures, ProtocolError/SdkError), see the mcp-debugger agent.
when_to_use: MCP testing, test setup, inspector sessions, coverage, assertion patterns, test scaffolding.
user-invocable: false
metadata:
  category: technique
---

# Testing & Debugging MCP (TypeScript SDK v2)

Covers testing and error diagnosis for `2.0.0-beta.3`. Reference: https://ts.sdk.modelcontextprotocol.io/v2/

`in-process tests -> mock security -> manual probe (inspector | curl) -> match error channel & look up code`

## When to Use

- Writing tests for MCP servers/clients in TS/JS.
- Diagnosing runtime misbehavior (connection failures, ProtocolError/SdkError): dispatch the `mcp-debugger` agent instead.
- Running inspector sessions for test scaffolding.
- Deprecated APIs / mismatched SDKs: load [mcp-migration].
- Server config (stderr logging, custom schemas): see [mcp-server].
- Client connection testing: see [mcp-client].

## Steps

1. **Verify Sandbox**: Confirm test isolation. Prefer `InMemoryTransport.createLinkedPair()` to pair a `Client` and `McpServer` directly (era-specific; see `references/examples.md`), avoiding real ports or subprocesses.
2. **Mock Security**: If testing auth-protected endpoints, pass mock `authInfo` payloads following [mcp-auth] policies to test 401/403 controls.
3. **Execute Probe**: For stdio servers, launch the MCP inspector to probe commands interactively. For HTTP servers, direct post raw JSON-RPC requests via `curl` to the `/mcp` endpoints.
4. **Assert Correct Channel**: See [references/tables.md](references/tables.md) for error classes/codes and `isError` checks; error channels in [mcp-server errors](../mcp-server/references/errors.md).

## Completion Criteria

To consider testing implementation complete, you must verify:

- [ ] HTTP adapters are tested in-process via the `handler.fetch` mock (no real port); stdio coverage spawns the real process with `StdioClientTransport` (no in-process shortcut); `InMemoryTransport.createLinkedPair()` pairs 2025-era instances directly.
- [ ] No real network ports are spawned in the standard unit test execution workflows.
- [ ] Tool business failures return structured `isError: true` bodies in the success payload, not protocol-level crashes.
- [ ] Test suite executes successfully with no hanging tasks or loose connections.

## Examples & References

- In-process/manual test harness setup: [references/examples.md](references/examples.md)
- Error classes, codes & lookups: [references/tables.md](references/tables.md); error channels: [../mcp-server/references/errors.md](../mcp-server/references/errors.md)

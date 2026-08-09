---
name: mcp-client
description: Use when building MCP clients using TypeScript SDK v2 (@modelcontextprotocol/client), managing connections, calling tools/resources, subscribing to changes, caching, or configuring middleware.
when_to_use: Building an MCP client, client connections, registering capabilities, calling tools, reading resources, progress handlers.
user-invocable: false
metadata:
  category: technique
---

# Building MCP Clients (TypeScript SDK v2)

Covers `@modelcontextprotocol/client` `2.0.0-beta.3`. SDK: https://ts.sdk.modelcontextprotocol.io/v2/

## Steps

1. **Configure ESM**: Standardize to ESM-only (`"type": "module"` in `package.json`, `"NodeNext"` resolutions in `tsconfig.json`). v2 ships a CommonJS build too, so CJS projects can `require('@modelcontextprotocol/client')` directly — no dynamic `import()` shim required.

2. **Initialize Client**: `new Client({...})`, declaring capacities up front in the constructor — **elicitation is mandatory**; sampling (`createMessage`) and roots (`roots/list`) are deprecated per SEP-2577, so declare them only if you need legacy support. Pass paths via tool arguments / resource URIs / host config instead of roots.

3. **Pick Transport & Connect**: Choose by server transport, then `await client.connect(transport)`:
   - **Streamable HTTP** (default): `StreamableHTTPClientTransport`.
   - **stdio**: `StdioClientTransport` from the `@modelcontextprotocol/client/stdio` subpath.
   - **SSE-only legacy server**: `SSEClientTransport` — only after StreamableHTTP fails; SSE is a fallback, not a first choice.
   - **Negotiation footgun**: For spawn-per-invocation stdio CLI wrappers, pin the era with `versionNegotiation: { mode: { pin: '2026-07-28' } }` (modern-only) or `{ mode: 'legacy' }` — **never `{ mode: 'auto' }`**, which stalls on cold spawns. `{ mode: 'auto' }` is fine for long-lived connections.

4. **Register Hook Interceptors**: After `connect`, register handlers via `setRequestHandler('elicitation/create', …)` for auto-fulfillment. Register `sampling/createMessage` / `roots/list` handlers only if you declared those (deprecated) capacities in Step 2.

5. **Manage Calls**: Call tools with `.callTool()` and paginate; check execution status on the `result.isError` payload — do **not** catch standard tool exceptions as business failures.

6. **Graceful Terminate**: On every shutdown **and** error path, tear down cleanly to avoid dangling connections. Over **Streamable HTTP**, run `await transport.terminateSession()` (a no-op when the server issued no session ID) then `await client.close()`. Over **stdio** or in-memory, `await client.close()` alone is the whole teardown — there is no server-side session to terminate.

## Completion Criteria

To consider a client implementation complete, you must verify:

- [ ] ESM-only config is active in `tsconfig.json` (or CJS `require` resolves natively).
- [ ] Negotiation mode matches connection lifetime per Step 3 (`'auto'` only for long-lived connections).
- [ ] Client declares capacities (elicitation mandatory; sampling/roots only if used) in the constructor BEFORE registering handlers.
- [ ] Success checks read `result.isError` directly instead of catching exceptions for standard tool responses.
- [ ] Sessions terminate gracefully on shutdown AND error paths: Streamable HTTP runs `terminateSession()` + `close()`; stdio/in-memory run `close()` alone.
- [ ] Multi-user response caches set `cachePartition` so `'private'` entries never cross user/tenant boundaries.

## Reference Guides

- Connection, tools, resources, prompts: [references/examples.md](references/examples.md)
- Subscriptions, caching, middleware, roots: [references/subscriptions-caching-middleware.md](references/subscriptions-caching-middleware.md)
- Connection troubleshooting or tests: [mcp-test]

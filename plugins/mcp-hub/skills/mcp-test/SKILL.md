---
name: mcp-test
description: MCP SDK v2 — use when writing or running tests for an MCP server or client — test setup, inspector sessions, and coverage/assertion patterns. For diagnosing runtime misbehavior (connection failures, ProtocolError/SdkError), dispatch the mcp-debugger agent.
user-invocable: false
metadata:
  category: technique
---

# Testing MCP (MCP SDK v2)

Covers `2.0.0-beta.3` test workflows (plus the shared error-code reference the mcp-debugger agent loads) for `@modelcontextprotocol/server` and `@modelcontextprotocol/client`. Reference: https://ts.sdk.modelcontextprotocol.io/v2/

`pick harness -> mock security -> manual probe -> match error channel & look up code`

## When to Use

- Deprecated APIs / mismatched SDKs: load [mcp-migration].
- Server config (stderr logging, custom schemas): see [mcp-server].
- Client connection testing: see [mcp-client].

## Steps

1. **Pick a Harness** — match the transport under test; in-process by default; real ports/subprocesses only for stdio coverage.

   - **HTTP server**, in-process via `createMcpHandler`'s `handler.fetch` — exercises HTTP-specific behavior (headers, auth middleware, Host/Origin checks):

     ```ts
     const handler = createMcpHandler(createServer); // server factory
     const transport = new StreamableHTTPClientTransport(new URL('http://test.local/mcp'), {
       fetch: (url, init) => handler.fetch(new Request(url, init)), // in-process fetch mock
     });
     const client = new Client({ name: 'test-harness', version: '1.0.0' });
     await client.connect(transport);

     const failed = await client.callTool({
       name: 'apply-discount',
       arguments: { price: -5, percent: 25 },
     });
     assert.equal(failed.isError, true); // tool error -> isError: true, never a thrown exception

     // afterEach:
     await client.close();
     await handler.close();
     ```

   - **Direct server/client pairing, no HTTP concerns** — `InMemoryTransport.createLinkedPair()` is the SDK's own zero-mocking pattern, pairing a `Client` and `McpServer` directly:

     ```ts
     const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
     const server = new McpServer({ name: 'test-server', version: '1.0.0' });
     const client = new Client({ name: 'test-harness', version: '1.0.0' });
     await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
     // ... assert, then client.close()
     ```

     > `InMemoryTransport` lives in `@modelcontextprotocol/client`, not `core` (Zod schemas only). It's the 2025-era in-process pattern — for 2026-07-28 server coverage prefer the `handler.fetch` harness above. Leave `sessionId` unset at construction: setting it there skips the `initialize` handshake. `close()` aborts in-flight handlers via `ctx.mcpReq.signal` and no longer double-fires `onclose` on the initiating side.

   - **stdio server** — spawn the real process with `StdioClientTransport`; stdio has no in-process shortcut.

2. **Mock Security**: if testing auth-protected endpoints, pass mock `authInfo` payloads following [mcp-auth] policies to test 401/403 controls.

3. **Execute Probe**: for stdio servers, launch the MCP inspector to probe commands interactively:

   ```sh
   npx @modelcontextprotocol/inspector npx tsx src/index.ts
   ```

   For HTTP servers, POST raw JSON-RPC requests directly:

   ```sh
   curl -X POST http://127.0.0.1:3000/mcp \
     -H 'Content-Type: application/json' \
     -H 'Accept: application/json, text/event-stream' \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   ```

4. **Assert Correct Channel**: tool _business_ failures return `isError: true`; unknown/disabled tool names instead reject the promise with `ProtocolError(InvalidParams)` — assert via try/catch + `error.code`, never bare `instanceof` (fails cross-realm/cross-bundle; use `.isInstance()` or match `.code`/`data`). Error channel model: [mcp-server] "Handle Errors". Code lookups: Error Code Reference below.

## Error Code Reference

### Error classes

| Class                                 | Package       | Meaning                                                                                                                                                                   |
| ------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ProtocolError(code, message, data?)` | server/client | JSON-RPC error on the wire; subclasses: `ResourceNotFoundError`, `UrlElicitationRequiredError`, `UnsupportedProtocolVersionError`, `MissingRequiredClientCapabilityError` |
| `SdkError(code, message)`             | server/client | Local SDK failure — never a wire error                                                                                                                                    |
| `SdkHttpError`                        | server/client | HTTP-level failure; HTTP status on `.status`/`.statusText`, **not** `.code` (`.code` is a `SdkErrorCode` string)                                                          |

OAuth-flow classes (`UnauthorizedError`, `IssuerMismatchError`, `AuthorizationServerMismatchError`, `OAuthError`, `InsufficientScopeError`, `InsecureTokenEndpointError`) aren't re-described here — see [mcp-client] "Authenticate the client" and [mcp-auth] "Error Reference".

### ProtocolErrorCode (wire codes)

| Member                            | Code   | Meaning                                                                             |
| :-------------------------------- | :----- | :---------------------------------------------------------------------------------- |
| `ParseError`                      | −32700 | Not valid JSON                                                                      |
| `InvalidRequest`                  | −32600 | Not a valid JSON-RPC request                                                        |
| `MethodNotFound`                  | −32601 | No handler for the method                                                           |
| `InvalidParams`                   | −32602 | Bad params — also a `resources/read` miss                                           |
| `InternalError`                   | −32603 | Handler threw a non-`ProtocolError`                                                 |
| `ResourceNotFound`                | −32002 | Receive-tolerated only; the SDK always emits −32602 — throw `ResourceNotFoundError` |
| `MissingRequiredClientCapability` | −32021 | Request needs an undeclared client capability _(new in 2026-07-28)_                 |
| `UnsupportedProtocolVersion`      | −32022 | Requested version unknown/unsupported; `data.supported` lists options _(new)_       |
| `UrlElicitationRequired`          | −32042 | Tool needs the user to visit a URL first                                            |

### SdkErrorCode (local codes)

| Code                                                                                                                                                                                    | When                                                                                          |
| :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------- |
| `NotConnected` / `AlreadyConnected` / `NotInitialized`                                                                                                                                  | Transport/protocol lifecycle misuse                                                           |
| `CapabilityNotSupported`                                                                                                                                                                | Required capability not supported                                                             |
| `RequestTimeout`                                                                                                                                                                        | Request timed out                                                                             |
| `ConnectionClosed`                                                                                                                                                                      | Connection closed with requests in flight                                                     |
| `SendFailed`                                                                                                                                                                            | Failed to send a message                                                                      |
| `InvalidResult`                                                                                                                                                                         | Response failed local schema validation                                                       |
| `UnsupportedResultType`                                                                                                                                                                 | 2025-era response carried an unknown `resultType`                                             |
| `InputRequiredRoundsExceeded`                                                                                                                                                           | Auto-fulfilment hit `maxRounds`                                                               |
| `ListPaginationExceeded`                                                                                                                                                                | No-arg `list*()` aggregate walk hit `listMaxPages` (explicit-`cursor` calls are never capped) |
| `MethodNotSupportedByProtocolVersion`                                                                                                                                                   | Outbound method doesn't exist on the negotiated revision                                      |
| `EraNegotiationFailed`                                                                                                                                                                  | `connect()` found no shared era (pin unmet / no overlap)                                      |
| `ClientHttpNotImplemented` / `ClientHttpAuthentication` / `ClientHttpForbidden` / `ClientHttpUnexpectedContent` / `ClientHttpFailedToOpenStream` / `ClientHttpFailedToTerminateSession` | HTTP client-transport failures                                                                |

### Common Error Symptoms and Fixes

| Error                                                                                   | Fix                                                                                                                                                                                                                                                                                    |
| :-------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SyntaxError: ... is not valid JSON`                                                    | Something wrote to stdout on a stdio server. Log with `console.error`, never `console.log`.                                                                                                                                                                                            |
| `TS2589: Type instantiation is excessively deep`                                        | Multiple Zod versions in the tree. Dedupe to a single `zod ^4.2.0` — see [mcp-server] "Register Capabilities" gotcha.                                                                                                                                                                  |
| `ReferenceError: crypto is not defined`                                                 | Node < 20. Upgrade, or polyfill: `globalThis.crypto = webcrypto`.                                                                                                                                                                                                                      |
| `SdkError: ERA_NEGOTIATION_FAILED`                                                      | Client and server share no protocol era. Two shapes: (1) a `pin` the server doesn't offer — widen the pin or use `mode: 'auto'`; (2) `mode: 'auto'` with a `supportedProtocolVersions` list lacking a pre-2026 entry — add a legacy revision to the list so the fallback is available. |
| `SdkError: METHOD_NOT_SUPPORTED_BY_PROTOCOL_VERSION`                                    | Calling a method the negotiated era doesn't have — the error names the replacement.                                                                                                                                                                                                    |
| `No exported member 'SSEServerTransport'`                                               | HTTP serving now uses `createMcpHandler()` from `@modelcontextprotocol/server`. For a server that must stay on SSE, import the frozen v1 copy: `import { SSEServerTransport } from '@modelcontextprotocol/server-legacy/sse'`.                                                         |
| `ListPaginationExceeded` / no-arg list returns everything                               | v2 auto-aggregates pages; pass `{ cursor }` for one page, or drop to `client.request({ method: 'tools/list' })` (cap `listMaxPages` default 64).                                                                                                                                       |
| Empty `tools/list` returns `[]` not `-32601`; capability advertised `listChanged: true` | `McpServer` eager-installs handlers for declared capabilities; set `listChanged: false` to opt out.                                                                                                                                                                                    |
| Duck-typed `.code === 401` silently misses `SdkHttpError`                               | Read `.status` on `SdkHttpError`; `SseError` still uses numeric `.code`.                                                                                                                                                                                                               |

## Completion Criteria

To consider testing implementation complete, you must verify:

- [ ] Every harness matches its transport: HTTP tested in-process via `handler.fetch` (no real port); direct server/client pairing uses `InMemoryTransport.createLinkedPair()`; stdio coverage spawns the real process with `StdioClientTransport`.
- [ ] No test in the standard unit test run opens a real network port.
- [ ] Every error assertion matched against the Error Code Reference table for its channel (ProtocolError vs SdkError vs SdkHttpError) — no guessed codes.
- [ ] Tool business failures assert `isError: true`; unknown/disabled tool names assert `ProtocolError(InvalidParams)` via try/catch + `.code` (see step 4).
- [ ] Test suite exits cleanly: every `client.close()`/`handler.close()` runs, no hanging tasks or open connections.

## See Also

- Handling errors on the server: [mcp-server] "Handle Errors"
- Mocking auth in tests: [mcp-auth]
- Diagnosing a live failure instead of writing new tests: dispatch the `mcp-debugger` agent

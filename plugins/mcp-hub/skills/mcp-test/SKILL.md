---
name: mcp-test
description: 'Test: MCP SDK v2 server/client behavior with transport-matched harnesses, inspector probes, and error assertions; reproduced runtime protocol or SDK failures dispatch mcp-debugger.'
user-invocable: false
metadata:
  category: technique
---

# MCP SDK v2 Testing

Covers `2.0.0` test workflows (plus the error-code reference used by `mcp-debugger`) for `@modelcontextprotocol/server` and `@modelcontextprotocol/client`. Reference: https://ts.sdk.modelcontextprotocol.io/v2/

Test loop: `match transport → supply security context → probe behavior → assert its error channel`.

Use [mcp-migration](../mcp-migration/SKILL.md) for SDK-version changes, [mcp-server](../mcp-server/SKILL.md) for server configuration, and [mcp-client](../mcp-client/SKILL.md) for connection implementation.

## Steps

1. **Pick a Harness** — match the transport under test; in-process by default; real ports/subprocesses only for stdio coverage.

   - **HTTP server**, in-process via `createMcpHandler`'s `handler.fetch` — exercises HTTP-specific behavior (headers, auth middleware, Host/Origin checks):

     ```ts
     const handler = createMcpHandler(createServer); // server factory
     const transport = new StreamableHTTPClientTransport(new URL('http://test.local/mcp'), {
       fetch: (url, init) => handler.fetch(new Request(url, init)), // real in-process serving: handler.fetch serves every request, the transport never dials http://test.local/mcp
     });
     const client = new Client(
       { name: 'test-harness', version: '1.0.0' },
       { versionNegotiation: { mode: 'auto' } },
     );
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

     > `InMemoryTransport` lives in `@modelcontextprotocol/client`, not `core` (Zod schemas only). It's the 2025-era in-process pattern — for 2026-07-28 server coverage prefer the `handler.fetch` harness above. `close()` aborts in-flight handlers via `ctx.mcpReq.signal`.

   - **stdio server** — spawn the real process with `StdioClientTransport`; stdio has no in-process shortcut.

   - [ ] Every HTTP test uses in-process `handler.fetch`, every direct pairing uses `InMemoryTransport.createLinkedPair()`, and every stdio test uses `StdioClientTransport`.
   - [ ] The standard unit-test run opens no real network port.

2. **Supply Security Context**: Auth-protected endpoint tests pass mock `authInfo` payloads following [mcp-auth](../mcp-auth/SKILL.md) policies and cover their `401`/`403` controls.

   - [ ] Every auth-protected endpoint has allowed, unauthenticated, and insufficient-scope test cases.

3. **Execute Probe**: Exercise the shipping transport manually. For stdio servers, launch the MCP inspector:

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

   - [ ] Every shipping server transport completes its representative probe without protocol framing errors.

4. **Assert the error channel**: Tool business failures return `isError: true`; unknown or disabled tool names reject with `ProtocolError(InvalidParams)`. Assert rejection through `try`/`catch` and `error.code`; use `.isInstance()` or `.code`/`data` across realms and package bundles. Error-channel model: [mcp-server](../mcp-server/SKILL.md) “Handle Errors”. Code lookups: Error Code Reference below.

   - [ ] Every error assertion uses the matching `ProtocolError`, `SdkError`, or `SdkHttpError` entry below.
   - [ ] Tool business failures assert `isError: true`; unknown and disabled names assert `ProtocolError(InvalidParams)` via `try`/`catch` plus `.code`.
   - [ ] Test teardown closes every client and handler, leaving no hanging tasks or connections.

## Error Code Reference

### Error classes

| Class                                 | Package       | Meaning                                                                                                                                                                   |
| ------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ProtocolError(code, message, data?)` | server/client | JSON-RPC error on the wire; subclasses: `ResourceNotFoundError`, `UrlElicitationRequiredError`, `UnsupportedProtocolVersionError`, `MissingRequiredClientCapabilityError` |
| `SdkError(code, message)`             | server/client | Local SDK failure — never a wire error                                                                                                                                    |
| `SdkHttpError`                        | server/client | HTTP-level failure; HTTP status on `.status`/`.statusText`, **not** `.code` (`.code` is a `SdkErrorCode` string)                                                          |

OAuth-flow classes (`UnauthorizedError`, `IssuerMismatchError`, `AuthorizationServerMismatchError`, `OAuthError`, `InsufficientScopeError`, `InsecureTokenEndpointError`) aren't re-described here — see [mcp-client](../mcp-client/SKILL.md) "Authenticate the client" and [mcp-auth](../mcp-auth/SKILL.md) "Error Reference".

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
| `UnsupportedResultType`                                                                                                                                                                 | 2026-era response carried an unknown `resultType`                                             |
| `InputRequiredRoundsExceeded`                                                                                                                                                           | Auto-fulfilment hit `maxRounds`                                                               |
| `ListPaginationExceeded`                                                                                                                                                                | No-arg `list*()` aggregate walk hit `listMaxPages` (explicit-`cursor` calls are never capped) |
| `MethodNotSupportedByProtocolVersion`                                                                                                                                                   | Outbound method doesn't exist on the negotiated revision                                      |
| `EraNegotiationFailed`                                                                                                                                                                  | `connect()` found no shared era (pin unmet / no overlap)                                      |
| `ClientHttpNotImplemented` / `ClientHttpAuthentication` / `ClientHttpForbidden` / `ClientHttpUnexpectedContent` / `ClientHttpFailedToOpenStream` / `ClientHttpFailedToTerminateSession` | HTTP client-transport failures                                                                |

### Common Error Symptoms and Fixes

| Error                                                                                   | Fix                                                                                                                                                                                                                                                                                    |
| :-------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SyntaxError: ... is not valid JSON`                                                    | Something wrote to stdout on a stdio server. Log with `console.error`, never `console.log`.                                                                                                                                                                                            |
| `TS2589: Type instantiation is excessively deep`                                        | Multiple Zod versions in the tree. Dedupe to a single `zod ^4.2.0` — see [mcp-server](../mcp-server/SKILL.md) "Register Capabilities" gotcha.                                                                                                                                          |
| `ReferenceError: crypto is not defined`                                                 | Node < 20. Upgrade, or polyfill: `globalThis.crypto = webcrypto`.                                                                                                                                                                                                                      |
| `SdkError: ERA_NEGOTIATION_FAILED`                                                      | Client and server share no protocol era. Two shapes: (1) a `pin` the server doesn't offer — widen the pin or use `mode: 'auto'`; (2) `mode: 'auto'` with a `supportedProtocolVersions` list lacking a pre-2026 entry — add a legacy revision to the list so the fallback is available. |
| `SdkError: METHOD_NOT_SUPPORTED_BY_PROTOCOL_VERSION`                                    | Calling a method the negotiated era doesn't have — the error names the replacement.                                                                                                                                                                                                    |
| `No exported member 'SSEServerTransport'`                                               | HTTP serving now uses `createMcpHandler()` from `@modelcontextprotocol/server`. For a server that must stay on SSE, import the frozen v1 copy: `import { SSEServerTransport } from '@modelcontextprotocol/server-legacy/sse'`.                                                         |
| `ListPaginationExceeded` / no-arg list returns everything                               | v2 auto-aggregates pages; pass `{ cursor }` for one page, or drop to `client.request({ method: 'tools/list' })` (cap `listMaxPages` default 64).                                                                                                                                       |
| Empty `tools/list` returns `[]` not `-32601`; capability advertised `listChanged: true` | `McpServer` eager-installs handlers for declared capabilities; set `listChanged: false` to opt out.                                                                                                                                                                                    |
| Duck-typed `.code === 401` silently misses `SdkHttpError`                               | Read `.status` on `SdkHttpError`; `SseError` still uses numeric `.code`.                                                                                                                                                                                                               |

## See Also

- Handling errors on the server: [mcp-server](../mcp-server/SKILL.md) "Handle Errors"
- Mocking auth in tests: [mcp-auth](../mcp-auth/SKILL.md)
- Diagnosing a live failure instead of writing new tests: dispatch the `mcp-debugger` agent

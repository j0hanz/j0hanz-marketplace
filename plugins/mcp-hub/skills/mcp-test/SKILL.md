---
name: mcp-test
description: 'Test: MCP SDK v2 server/client behavior with transport-matched harnesses, inspector probes, and error assertions; reproduced runtime protocol or SDK failures dispatch mcp-debugger.'
user-invocable: false
metadata:
  category: technique
---

# MCP SDK v2 Testing

Covers `2.0.0` test workflows (plus error-code reference `mcp-debugger` use) for `@modelcontextprotocol/server` and `@modelcontextprotocol/client`. Reference: https://ts.sdk.modelcontextprotocol.io/v2/

Test loop: `match transport → supply security context → probe behavior → assert its error channel`.

Use [mcp-migration](../mcp-migration/SKILL.md) for SDK-version changes, [mcp-server](../mcp-server/SKILL.md) for server config, [mcp-client](../mcp-client/SKILL.md) for connection implementation.

## Steps

1. **Pick Harness** — match transport under test; in-process default; real ports/subprocesses only for stdio coverage.

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

   - **Direct server/client pairing, no HTTP concerns** — `InMemoryTransport.createLinkedPair()` is SDK's own zero-mocking pattern, pairing `Client` and `McpServer` direct:

     ```ts
     const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
     const server = new McpServer({ name: 'test-server', version: '1.0.0' });
     const client = new Client({ name: 'test-harness', version: '1.0.0' });
     await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
     // ... assert, then client.close()
     ```

     > `InMemoryTransport` lives in `@modelcontextprotocol/client`, not `core` (Zod schemas only). 2025-era in-process pattern — for 2026-07-28 server coverage prefer `handler.fetch` harness above. `close()` aborts in-flight handlers via `ctx.mcpReq.signal`.

   - **stdio server** — spawn real process with `StdioClientTransport`; stdio got no in-process shortcut.

   - [ ] Every HTTP test uses in-process `handler.fetch`, every direct pairing uses `InMemoryTransport.createLinkedPair()`, every stdio test uses `StdioClientTransport`.
   - [ ] Standard unit-test run opens no real network port.

2. **Supply Security Context**: Auth-protected endpoint tests pass mock `authInfo` payloads following [mcp-auth](../mcp-auth/SKILL.md) policies, cover `401`/`403` controls.

   - [ ] Every auth-protected endpoint has allowed, unauthenticated, insufficient-scope test cases.

3. **Execute Probe**: Exercise shipping transport manual. For stdio servers, launch MCP inspector:

   ```sh
   npx @modelcontextprotocol/inspector npx tsx src/index.ts
   ```

   For HTTP servers, POST raw JSON-RPC requests direct:

   ```sh
   curl -X POST http://127.0.0.1:3000/mcp \
     -H 'Content-Type: application/json' \
     -H 'Accept: application/json, text/event-stream' \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   ```

   - [ ] Every shipping server transport completes representative probe, no protocol framing errors.

4. **Assert error channel**: Tool business failures return `isError: true`; unknown/disabled tool names reject `ProtocolError(InvalidParams)`. Assert rejection via `try`/`catch` and `error.code`; use `.isInstance()` or `.code`/`data` across realms and package bundles. Error-channel model: [mcp-server](../mcp-server/SKILL.md) "Handle Errors". Code lookups: Error Code Reference below.

   - [ ] Every error assertion uses matching `ProtocolError`, `SdkError`, or `SdkHttpError` entry below.
   - [ ] Tool business failures assert `isError: true`; unknown/disabled names assert `ProtocolError(InvalidParams)` via `try`/`catch` plus `.code`.
   - [ ] Test teardown closes every client and handler, no hanging tasks or connections left.

## Error Code Reference

### Error classes

| Class                                 | Package       | Meaning                                                                                                                                                               |
| ------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ProtocolError(code, message, data?)` | server/client | JSON-RPC error on wire; subclasses: `ResourceNotFoundError`, `UrlElicitationRequiredError`, `UnsupportedProtocolVersionError`, `MissingRequiredClientCapabilityError` |
| `SdkError(code, message)`             | server/client | Local SDK failure — never wire error                                                                                                                                  |
| `SdkHttpError`                        | server/client | HTTP-level failure; HTTP status on `.status`/`.statusText`, **not** `.code` (`.code` is `SdkErrorCode` string)                                                        |

OAuth-flow classes (`UnauthorizedError`, `IssuerMismatchError`, `AuthorizationServerMismatchError`, `OAuthError`, `InsufficientScopeError`, `InsecureTokenEndpointError`) not re-described here — see [mcp-client](../mcp-client/SKILL.md) "Authenticate the client" and [mcp-auth](../mcp-auth/SKILL.md) "Error Reference".

### ProtocolErrorCode (wire codes)

| Member                            | Code   | Meaning                                                                         |
| :-------------------------------- | :----- | :------------------------------------------------------------------------------ |
| `ParseError`                      | −32700 | Not valid JSON                                                                  |
| `InvalidRequest`                  | −32600 | Not valid JSON-RPC request                                                      |
| `MethodNotFound`                  | −32601 | No handler for method                                                           |
| `InvalidParams`                   | −32602 | Bad params — also `resources/read` miss                                         |
| `InternalError`                   | −32603 | Handler threw non-`ProtocolError`                                               |
| `ResourceNotFound`                | −32002 | Receive-tolerated only; SDK always emits −32602 — throw `ResourceNotFoundError` |
| `MissingRequiredClientCapability` | −32021 | Request needs undeclared client capability _(new 2026-07-28)_                   |
| `UnsupportedProtocolVersion`      | −32022 | Requested version unknown/unsupported; `data.supported` lists options _(new)_   |
| `UrlElicitationRequired`          | −32042 | Tool needs user visit URL first                                                 |

### SdkErrorCode (local codes)

| Code                                                                                                                                                                                    | When                                                                                      |
| :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------- |
| `NotConnected` / `AlreadyConnected` / `NotInitialized`                                                                                                                                  | Transport/protocol lifecycle misuse                                                       |
| `CapabilityNotSupported`                                                                                                                                                                | Required capability unsupported                                                           |
| `RequestTimeout`                                                                                                                                                                        | Request timed out                                                                         |
| `ConnectionClosed`                                                                                                                                                                      | Connection closed with requests in flight                                                 |
| `SendFailed`                                                                                                                                                                            | Failed to send message                                                                    |
| `InvalidResult`                                                                                                                                                                         | Response failed local schema validation                                                   |
| `UnsupportedResultType`                                                                                                                                                                 | 2026-era response carried unknown `resultType`                                            |
| `InputRequiredRoundsExceeded`                                                                                                                                                           | Auto-fulfilment hit `maxRounds`                                                           |
| `ListPaginationExceeded`                                                                                                                                                                | No-arg `list*()` aggregate walk hit `listMaxPages` (explicit-`cursor` calls never capped) |
| `MethodNotSupportedByProtocolVersion`                                                                                                                                                   | Outbound method doesn't exist on negotiated revision                                      |
| `EraNegotiationFailed`                                                                                                                                                                  | `connect()` found no shared era (pin unmet / no overlap)                                  |
| `ClientHttpNotImplemented` / `ClientHttpAuthentication` / `ClientHttpForbidden` / `ClientHttpUnexpectedContent` / `ClientHttpFailedToOpenStream` / `ClientHttpFailedToTerminateSession` | HTTP client-transport failures                                                            |

### Common Error Symptoms and Fixes

| Error                                                                                   | Fix                                                                                                                                                                                                                                                 |
| :-------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SyntaxError: ... is not valid JSON`                                                    | Something wrote stdout on stdio server. Log via `console.error`, never `console.log`.                                                                                                                                                               |
| `TS2589: Type instantiation is excessively deep`                                        | Multiple Zod versions in tree. Dedupe to single `zod ^4.2.0` — see [mcp-server](../mcp-server/SKILL.md) "Register Capabilities" gotcha.                                                                                                             |
| `ReferenceError: crypto is not defined`                                                 | Node < 20. Upgrade, or polyfill: `globalThis.crypto = webcrypto`.                                                                                                                                                                                   |
| `SdkError: ERA_NEGOTIATION_FAILED`                                                      | Client and server share no protocol era. Two shapes: (1) `pin` server doesn't offer — widen pin or use `mode: 'auto'`; (2) `mode: 'auto'` with `supportedProtocolVersions` list lacking pre-2026 entry — add legacy revision so fallback available. |
| `SdkError: METHOD_NOT_SUPPORTED_BY_PROTOCOL_VERSION`                                    | Calling method negotiated era lacks — error names replacement.                                                                                                                                                                                      |
| `No exported member 'SSEServerTransport'`                                               | HTTP serving now uses `createMcpHandler()` from `@modelcontextprotocol/server`. Server must stay on SSE → import frozen v1 copy: `import { SSEServerTransport } from '@modelcontextprotocol/server-legacy/sse'`.                                    |
| `ListPaginationExceeded` / no-arg list returns everything                               | v2 auto-aggregates pages; pass `{ cursor }` for one page, or drop to `client.request({ method: 'tools/list' })` (cap `listMaxPages` default 64).                                                                                                    |
| Empty `tools/list` returns `[]` not `-32601`; capability advertised `listChanged: true` | `McpServer` eager-installs handlers for declared capabilities; set `listChanged: false` to opt out.                                                                                                                                                 |
| Duck-typed `.code === 401` silently misses `SdkHttpError`                               | Read `.status` on `SdkHttpError`; `SseError` still uses numeric `.code`.                                                                                                                                                                            |

## See Also

- Handling errors on server: [mcp-server](../mcp-server/SKILL.md) "Handle Errors"
- Mocking auth in tests: [mcp-auth](../mcp-auth/SKILL.md)
- Diagnosing live failure instead of writing new tests: dispatch `mcp-debugger` agent

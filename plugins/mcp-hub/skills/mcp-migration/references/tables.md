---
description: Reference tables for package split, API renames, and legacy-vs-modern era compatibility.
metadata:
  tags: [migration-tables, renames, compatibility]
  source: internal
---

# Migration Reference Tables

## Package Split

### Core Packages

| Package                         | Purpose                                                        |
| :------------------------------ | :------------------------------------------------------------- |
| `@modelcontextprotocol/server`  | `McpServer`, `Server`, `createMcpHandler`, validation & errors |
| `@modelcontextprotocol/client`  | `Client`, transport, auth, middleware, caching                 |
| `@modelcontextprotocol/core`    | Raw Zod wire schemas for gateways & proxies                    |
| `@modelcontextprotocol/node`    | Node HTTP adapter: `toNodeHandler` & stream transport          |
| `@modelcontextprotocol/codemod` | Migration CLI utility                                          |

> `@modelcontextprotocol/core-internal` — private, never import directly.

> **stdio subpath:** `StdioClientTransport`, `StdioServerParameters`, `getDefaultEnvironment`, `DEFAULT_INHERITED_ENV_VARS` import from `@modelcontextprotocol/client/stdio`; `StdioServerTransport` from `@modelcontextprotocol/server/stdio`. The package root barrels do **not** export these (root entries are runtime-neutral for browser/Workers bundlers). `ReadBuffer`, `serializeMessage`, `deserializeMessage` stay in the root barrel.

### Adapters & Legacy

| Package                               | Purpose                                                                                            |
| :------------------------------------ | :------------------------------------------------------------------------------------------------- |
| `@modelcontextprotocol/express`       | Express adapter and Bearer auth                                                                    |
| `@modelcontextprotocol/hono`          | Hono adapter                                                                                       |
| `@modelcontextprotocol/fastify`       | Fastify adapter                                                                                    |
| `@modelcontextprotocol/server-legacy` | Legacy v1 SSE transport and OAuth AS helpers — SSE at `/sse`, AS auth helpers at `/auth` subpaths. |

## Key Renames

### API & Type Renames

| v1                                                       | v2                                                                               |
| :------------------------------------------------------- | :------------------------------------------------------------------------------- |
| `server.setRequestHandler(CallToolRequestSchema, ...)`   | `server.setRequestHandler('tools/call', ...)` (low-level, method string)         |
| `.tool(...)` (variadic high-level)                       | `.registerTool(name, config, handler)` (high-level)                              |
| `McpError` / `ErrorCode`                                 | `ProtocolError` / `ProtocolErrorCode` (or `SdkErrorCode`)                        |
| `StreamableHTTPError`                                    | `SdkHttpError`                                                                   |
| `SchemaInput<T>`                                         | `StandardSchemaWithJSON.InferInput<T>`                                           |
| `ResourceTemplate` wire type                             | `ResourceTemplateType`                                                           |
| `JSONRPCError` / `JSONRPCErrorSchema` / `isJSONRPCError` | `JSONRPCErrorResponse` / `JSONRPCErrorResponseSchema` / `isJSONRPCErrorResponse` |
| `ResourceReference` / `ResourceReferenceSchema`          | `ResourceTemplateReference` / `ResourceTemplateReferenceSchema`                  |
| `IsomorphicHeaders`                                      | Web Standard `Headers` (use `.get()`/`.set()`, not bracket access)               |

> Low-level `setRequestHandler(Schema)` becomes `setRequestHandler('method/string')`; high-level `.tool()` becomes `.registerTool()`. Don't conflate them.

### Context & Property Renames

| v1                                                | v2                                                                                                           |
| :------------------------------------------------ | :----------------------------------------------------------------------------------------------------------- |
| `RequestHandlerExtra` (`extra`)                   | `ServerContext` / `ClientContext` (`ctx`)                                                                    |
| `extra.signal` / `requestId` / `_meta`            | `ctx.mcpReq.signal` / `id` / `_meta`                                                                         |
| `extra.sendRequest` / `sendNotification`          | `ctx.mcpReq.send` / `notify`                                                                                 |
| `extra.authInfo` / `requestInfo`                  | `ctx.http?.authInfo` / `req` (stdio = undefined)                                                             |
| `extra.sessionId`                                 | `ctx.sessionId`                                                                                              |
| `extra.closeSSEStream`                            | `ctx.http?.closeSSE`                                                                                         |
| `extra.closeStandaloneSSEStream`                  | `ctx.http?.closeStandaloneSSE`                                                                               |
| `server.sendLoggingMessage`                       | `ctx.mcpReq.log` (deprecated — SEP-2577; on 2026-07-28 prefer the `input_required` multi-round-trip pattern) |
| `elicitInput`                                     | `ctx.mcpReq.elicitInput` (2025-era only — throws on 2026-era; prefer returning `inputRequired(...)`)         |
| `StreamableHTTPServerTransport`                   | `Node/WebStandardStreamableHTTPServerTransport`                                                              |
| `extra.taskStore` / `taskId` / `taskRequestedTtl` | _removed_ (experimental tasks removed, SEP-2663 — no mechanical migration; remove usages)                    |

### OAuth Error Consolidation

The individual OAuth error classes are replaced with a single `OAuthError` + `OAuthErrorCode`. `OAUTH_ERRORS` is removed; `instanceof` → switch on `error.code`. Token verifiers must throw `OAuthError(OAuthErrorCode.InvalidToken)` or invalid tokens become HTTP 500.

| v1 class                       | v2                                                      |
| :----------------------------- | :------------------------------------------------------ |
| `InvalidRequestError`          | `OAuthError` + `OAuthErrorCode.InvalidRequest`          |
| `InvalidClientError`           | `OAuthError` + `OAuthErrorCode.InvalidClient`           |
| `InvalidGrantError`            | `OAuthError` + `OAuthErrorCode.InvalidGrant`            |
| `UnauthorizedClientError`      | `OAuthError` + `OAuthErrorCode.UnauthorizedClient`      |
| `UnsupportedGrantTypeError`    | `OAuthError` + `OAuthErrorCode.UnsupportedGrantType`    |
| `InvalidScopeError`            | `OAuthError` + `OAuthErrorCode.InvalidScope`            |
| `AccessDeniedError`            | `OAuthError` + `OAuthErrorCode.AccessDenied`            |
| `ServerError`                  | `OAuthError` + `OAuthErrorCode.ServerError`             |
| `TemporarilyUnavailableError`  | `OAuthError` + `OAuthErrorCode.TemporarilyUnavailable`  |
| `UnsupportedResponseTypeError` | `OAuthError` + `OAuthErrorCode.UnsupportedResponseType` |
| `UnsupportedTokenTypeError`    | `OAuthError` + `OAuthErrorCode.UnsupportedTokenType`    |
| `InvalidTokenError`            | `OAuthError` + `OAuthErrorCode.InvalidToken`            |
| `MethodNotAllowedError`        | `OAuthError` + `OAuthErrorCode.MethodNotAllowed`        |
| `TooManyRequestsError`         | `OAuthError` + `OAuthErrorCode.TooManyRequests`         |
| `InvalidClientMetadataError`   | `OAuthError` + `OAuthErrorCode.InvalidClientMetadata`   |
| `InsufficientScopeError`       | `OAuthError` + `OAuthErrorCode.InsufficientScope` ¹     |
| `InvalidTargetError`           | `OAuthError` + `OAuthErrorCode.InvalidTarget`           |
| `CustomOAuthError`             | `OAuthError` + a custom `OAuthErrorCode`                |

> ¹ Distinct from the **transport-layer** `InsufficientScopeError` (SEP-2350), which extends `OAuthClientFlowError`, not `OAuthError`.

## Behavioral Changes (v1 → v2)

| Behavior                                                                              | v1                                         | v2                                                                                                                                    |
| :------------------------------------------------------------------------------------ | :----------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| Unknown/disabled tool name                                                            | resolves `CallToolResult{ isError: true }` | rejects `ProtocolError(InvalidParams)` — caller catches `error.code` (see [mcp-server errors](../../mcp-server/references/errors.md)) |
| `listTools()`/`listPrompts()`/`listResources()`/`listResourceTemplates()` (no cursor) | one page                                   | auto-aggregate every page (cap `listMaxPages` default 64; overrun `SdkError(ListPaginationExceeded)`)                                 |
| Declared `tools: {}`/`resources: {}`/`prompts: {}`, no registrations                  | `-32601 Method not found`                  | `*/list` returns `[]`; advertised `listChanged: true` (set `listChanged: false` to opt out)                                           |
| POST `Content-Type`                                                                   | substring match                            | parsed media type; non-`application/json` → `415 Unsupported Media Type`                                                              |
| Default JSON Schema dialect                                                           | draft-07                                   | 2020-12 (declared draft-07/06 still honored)                                                                                          |
| `WebSocketClientTransport`                                                            | available                                  | removed — use `StreamableHTTPClientTransport` or `StdioClientTransport`                                                               |
| `SSEServerTransport`                                                                  | available                                  | removed — frozen at `@modelcontextprotocol/server-legacy/sse`                                                                         |

## Adopting the 2026-07-28 Era

### Transports & Handshakes

| Axis                 | 2025 Era (Legacy)                      | 2026 Era (Modern)                   |
| :------------------- | :------------------------------------- | :---------------------------------- |
| Server HTTP entry    | `*StreamableHTTPServerTransport`       | `createMcpHandler`                  |
| Server stdio entry   | `server.connect(StdioServerTransport)` | `serveStdio(factory)`               |
| Client connect       | `initialize` handshake                 | `server/discover` probe             |
| Client identity      | `getClientCapabilities/Version`        | `ctx.mcpReq.envelope` (per request) |
| Client cancel (HTTP) | POST `notifications/cancelled`         | Close the request's SSE stream      |

### Runtime Features

| Axis                                       | 2025 Era (Legacy)          | 2026 Era (Modern)             |
| :----------------------------------------- | :------------------------- | :---------------------------- |
| Server->client requests                    | `ctx.mcpReq.send`          | `return inputRequired(...)`   |
| Change notifications                       | `list_changed` / `updated` | `subscriptions/listen` stream |
| `ctx.mcpReq.log()` (deprecated — SEP-2577) | Session `logging/setLevel` | Per-request `_meta.logLevel`  |
| HTTP 400 JSON-RPC error                    | `SdkHttpError`             | `ProtocolError` (in-band)     |

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

### Adapters & Legacy

| Package                               | Purpose                                                                                            |
| :------------------------------------ | :------------------------------------------------------------------------------------------------- |
| `@modelcontextprotocol/express`       | Express adapter and Bearer auth                                                                    |
| `@modelcontextprotocol/hono`          | Hono adapter                                                                                       |
| `@modelcontextprotocol/fastify`       | Fastify adapter                                                                                    |
| `@modelcontextprotocol/server-legacy` | Legacy v1 SSE transport and OAuth AS helpers — SSE at `/sse`, AS auth helpers at `/auth` subpaths. |

## Key Renames

### API & Type Renames

| v1                                                     | v2                                                                       |
| :----------------------------------------------------- | :----------------------------------------------------------------------- |
| `server.setRequestHandler(CallToolRequestSchema, ...)` | `server.setRequestHandler('tools/call', ...)` (low-level, method string) |
| `.tool(...)` (variadic high-level)                     | `.registerTool(name, config, handler)` (high-level)                      |
| `McpError` / `ErrorCode`                               | `ProtocolError` / `ProtocolErrorCode` (or `SdkErrorCode`)                |
| `StreamableHTTPError`                                  | `SdkHttpError`                                                           |
| `SchemaInput<T>`                                       | `StandardSchemaWithJSON.InferInput<T>`                                   |
| `ResourceTemplate` wire type                           | `ResourceTemplateType`                                                   |

> Low-level `setRequestHandler(Schema)` becomes `setRequestHandler('method/string')`; high-level `.tool()` becomes `.registerTool()`. Don't conflate them.

### Context & Property Renames

| v1                                       | v2                                                                                                   |
| :--------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| `RequestHandlerExtra` (`extra`)          | `ServerContext` / `ClientContext` (`ctx`)                                                            |
| `extra.signal` / `requestId` / `_meta`   | `ctx.mcpReq.signal` / `id` / `_meta`                                                                 |
| `extra.sendRequest` / `sendNotification` | `ctx.mcpReq.send` / `notify`                                                                         |
| `extra.authInfo` / `requestInfo`         | `ctx.http?.authInfo` / `req` (stdio = undefined)                                                     |
| `extra.sessionId`                        | `ctx.sessionId`                                                                                      |
| `extra.closeSSEStream`                   | `ctx.http?.closeSSE`                                                                                 |
| `server.sendLoggingMessage`              | `ctx.mcpReq.log` (deprecated — SEP-2577; prefer stderr / OpenTelemetry)                              |
| `elicitInput`                            | `ctx.mcpReq.elicitInput` (2025-era only — throws on 2026-era; prefer returning `inputRequired(...)`) |
| `StreamableHTTPServerTransport`          | `Node/WebStandardStreamableHTTPServerTransport`                                                      |

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

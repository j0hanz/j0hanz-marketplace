---
name: mcp-migration
description: Migration: MCP SDK v1 to v2 through the codemod, split packages, API rewrites, and behavior verification.
user-invocable: false
metadata:
  category: technique
---

# Migrating MCP SDK v1 to v2

Migrate Node ≥20 projects from `@modelcontextprotocol/sdk` v1 to split v2 packages. Reference: https://ts.sdk.modelcontextprotocol.io/v2/

## Steps

1. **Scope migration**: Find every legacy dependency and import. Large multi-directory project: follow [mcp-planning](../mcp-planning/SKILL.md) decision 15 — migrate one directory at a time, keep both SDK versions only while untouched v1 code remains, remove v1 once `rg '@modelcontextprotocol/sdk'` finds no source imports. SDK objects can't cross v1/v2 boundary: nominal types and `instanceof` checks differ.

   **Done:** Migration scope and one-shot-or-staged posture explicit; every staged boundary isolates v1 and v2 SDK objects.

2. **Run codemod on that scope**: Execute `npx @modelcontextprotocol/codemod@latest v1-to-v2 .`, replace `.` with target **directory** when staging — subdirectory run still updates nearest manifest walking up (including removing v1 dependency), preview with `--dry-run`. Updates split-package imports, renames symbols, converts `extra` to `ctx`, rewrites schema-based `setRequestHandler` calls to method strings, changes `.tool()`/`.prompt()`/`.resource()` registrations to `registerTool`/`registerPrompt`/`registerResource` with `z.object()` schemas. Writes `@mcp-codemod-error` where safe rewrite unavailable.

   **Done:** Every targeted file compiles after rewrite or has `@mcp-codemod-error` marker to resolve.

3. **Install split packages**: Replace v1 package with public v2 packages used by rewritten imports (see [Package Split](#package-split)). Install `@modelcontextprotocol/server-legacy` (import from its `/sse` subpath) only for `SSEServerTransport`. Staged work: keep `@modelcontextprotocol/sdk` only for untouched v1 code; one-shot migration removes it now.

   **Done:** Every migrated import resolves to its v2 package, any retained v1 dependency serves only unmigrated scope.

4. **Resolve each codemod marker**: Find `@mcp-codemod-error` within migration scope, apply matching [rename](#renames) before moving on.

   **Done:** Migrated scope has zero `@mcp-codemod-error` comments, typechecks against installed packages.

5. **Set era posture**: Honor [mcp-planning](../mcp-planning/SKILL.md) decision 13; no record = serve both eras. HTTP uses `createMcpHandler(factory, { legacy: 'stateless' })`, stdio uses `serveStdio(factory, { legacy: 'serve' })` for both; modern-only uses `legacy: 'reject'`; 2025-only keeps hand-wired `*StreamableHTTPServerTransport` stack, no `legacy:` setting.

   **Done:** Every server entry point implements selected both-era, modern-only, or 2025-only posture.

6. **Modernize interaction and change flow for selected era**: Both-era and modern servers return `inputRequired(...)` instead of blocking for input; both-era server keeps `ctx.mcpReq.elicitInput` only inside its 2025 branch — throws for modern calls. Use `requestState` for modern multi-round data, `subscriptions/listen` for modern change streams. 2025-only stack keeps its 2025 interaction and notification mechanisms.

   **Done:** Each interaction, cross-round state, change-notification path uses APIs supported by selected connection era.

7. **Adopt `McpServer` where possible**: Convert low-level `Server` instances unless custom or vendor JSON-RPC methods need low-level class — send those to [mcp-protocol](../mcp-protocol/SKILL.md). Use Standard Schema objects: `z.object(...)` from zod ≥4.2.0, or existing ArkType/Valibot schemas.

   **Done:** Every server is either `McpServer` or has documented custom methods needing low-level [mcp-protocol](../mcp-protocol/SKILL.md) handling.

8. **Choose and verify module mode**: Default ESM with `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, `"type": "module"`. v2 is ESM-first; CommonJS projects can `require('@modelcontextprotocol/…')` directly.

   **Done:** Selected ESM or CommonJS mode resolves every v2 import in project's compiler and runtime.

9. **Verify behavior**: Run tests from [mcp-test](../mcp-test/SKILL.md), review every [Silent Behavior Change](#silent-behavior-changes) against migrated code. Tests — not codemod or compiler — cover those differences. Final staged slice: remove legacy package, confirm no source import remains.

   **Done:** Migrated scope compiles and passes tests; every silent change accounted for; complete migration has no legacy package or source import.

## Reference

### Package Split

| Package                               | Purpose                                                                                  |
| :------------------------------------ | :--------------------------------------------------------------------------------------- |
| `@modelcontextprotocol/server`        | `McpServer`, `Server`, `createMcpHandler`, validation, errors                            |
| `@modelcontextprotocol/client`        | `Client`, transport, auth, middleware, caching                                           |
| `@modelcontextprotocol/core`          | Raw Zod wire schemas for gateways and proxies                                            |
| `@modelcontextprotocol/node`          | Node HTTP adapter: `toNodeHandler` and stream transport                                  |
| `@modelcontextprotocol/codemod`       | Migration CLI                                                                            |
| `@modelcontextprotocol/server-legacy` | Frozen v1 `SSEServerTransport` (`/sse`) and Authorization Server OAuth helpers (`/auth`) |
| `@modelcontextprotocol/express`       | Express adapter when v1 server owns HTTP integration                                     |
| `@modelcontextprotocol/hono`          | Hono adapter when v1 server owns HTTP integration                                        |
| `@modelcontextprotocol/fastify`       | Fastify adapter when v1 server owns HTTP integration                                     |

**stdio subpath gotcha:** import `StdioClientTransport`, `StdioServerParameters`, `getDefaultEnvironment`, `DEFAULT_INHERITED_ENV_VARS` from `@modelcontextprotocol/client/stdio`; import `StdioServerTransport` from `@modelcontextprotocol/server/stdio`. Runtime-neutral package roots omit these exports; `ReadBuffer`, `serializeMessage`, `deserializeMessage` stay at root.

### Renames

#### API and type

| v1                                                                                                                            | v2                                                                                                                                   |
| :---------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------- |
| `server.setRequestHandler(CallToolRequestSchema, ...)`                                                                        | `server.setRequestHandler('tools/call', ...)` (low-level method string)                                                              |
| `.tool(...)` (variadic high-level)                                                                                            | `.registerTool(name, config, handler)` (high-level)                                                                                  |
| `McpError` / `ErrorCode`                                                                                                      | `ProtocolError` / `ProtocolErrorCode` (or `SdkErrorCode`)                                                                            |
| `StreamableHTTPError`                                                                                                         | `SdkHttpError`                                                                                                                       |
| `SchemaInput<T>`                                                                                                              | `StandardSchemaWithJSON.InferInput<T>`                                                                                               |
| `ResourceTemplate` wire type                                                                                                  | `ResourceTemplateType`                                                                                                               |
| `JSONRPCError` / `JSONRPCErrorSchema` / `isJSONRPCError`                                                                      | `JSONRPCErrorResponse` / `JSONRPCErrorResponseSchema` / `isJSONRPCErrorResponse`                                                     |
| `JSONRPCResponse` / `JSONRPCResponseSchema` / `isJSONRPCResponse`                                                             | `JSONRPCResultResponse` / `JSONRPCResultResponseSchema` / `isJSONRPCResultResponse`                                                  |
| `InMemoryTransport` (single export)                                                                                           | Split across `@modelcontextprotocol/server` and `/client`; both halves of linked pair must come from same package                    |
| `schemaToJson` / `parseSchemaAsync` / `getSchemaShape` / `getSchemaDescription` / `isOptionalSchema` / `unwrapOptionalSchema` | Removed (`@mcp-codemod-error`); `schemaToJson`→`fromJsonSchema()`, `parseSchemaAsync`→schema-library validation, rest no replacement |
| `ResourceReference` / `ResourceReferenceSchema`                                                                               | `ResourceTemplateReference` / `ResourceTemplateReferenceSchema`                                                                      |
| `IsomorphicHeaders`                                                                                                           | Web Standard `Headers` with `.get()` and `.set()`                                                                                    |

**Call-site gotcha:** low-level `setRequestHandler(Schema)` becomes `setRequestHandler('method/string')`; high-level `.tool()` becomes `.registerTool()`. Distinct conversions.

#### Context and property

| v1                                                  | v2                                                                                        |
| :-------------------------------------------------- | :---------------------------------------------------------------------------------------- |
| `RequestHandlerExtra` (`extra`)                     | `ServerContext` / `ClientContext` (`ctx`)                                                 |
| `extra.signal` / `requestId` / `_meta`              | `ctx.mcpReq.signal` / `id` / `_meta`                                                      |
| `extra.sendRequest` / `sendNotification`            | `ctx.mcpReq.send` / `notify`                                                              |
| `extra.authInfo` / `requestInfo`                    | `ctx.http?.authInfo` / `req` (stdio = undefined)                                          |
| `extra.sessionId`                                   | `ctx.sessionId`                                                                           |
| `extra.closeSSEStream` / `closeStandaloneSSEStream` | `ctx.http?.closeSSE` / `closeStandaloneSSE`                                               |
| `server.sendLoggingMessage`                         | `ctx.mcpReq.log` (deprecated, SEP-2577; modern replacement: per-request `_meta.logLevel`) |
| `server.createMessage`                              | Deprecated (SEP-2577); removed in later major                                             |
| `server.listRoots`                                  | Deprecated (SEP-2577); removed in later major                                             |
| `McpServer.sendLoggingMessage`                      | Deprecated (SEP-2577); removed in later major                                             |
| `Client.setLoggingLevel`                            | Deprecated (SEP-2577); removed in later major                                             |
| `Client.sendRootsListChanged`                       | Deprecated (SEP-2577); removed in later major                                             |
| `ctx.mcpReq.requestSampling`                        | Deprecated (SEP-2577); removed in later major                                             |
| `registerClient`                                    | Deprecated (SEP-2577); prefer Client ID Metadata Documents per SEP-991                    |
| `elicitInput`                                       | `inputRequired(...)`; keep `ctx.mcpReq.elicitInput` only for 2025 branches                |
| `StreamableHTTPServerTransport`                     | `Node/WebStandardStreamableHTTPServerTransport`                                           |
| `extra.taskStore` / `taskId` / `taskRequestedTtl`   | Removed (experimental tasks, SEP-2663); delete usages                                     |

#### OAuth migration

Map each `<Name>Error` class to `OAuthErrorCode.<Name>` without `Error` suffix (`InvalidGrantError` → `OAuthErrorCode.InvalidGrant`), except `ServerError`, keeps its name; map `CustomOAuthError` to defined custom code. Replace `OAUTH_ERRORS` and `instanceof` checks with switch on `error.code`. Token verifiers throw `OAuthError(OAuthErrorCode.InvalidToken)` for invalid tokens so response isn't HTTP 500. `InsufficientScopeError` from SEP-2350 is transport-layer `OAuthClientFlowError`, distinct from `OAuthErrorCode.InsufficientScope`.

### Silent Behavior Changes

Compiler and codemod can't catch these.

| Behavior                                                                                       | v1                                         | v2                                                                                                           |
| :--------------------------------------------------------------------------------------------- | :----------------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| Unknown or disabled tool name                                                                  | Resolves `CallToolResult{ isError: true }` | Rejects `ProtocolError(InvalidParams)`; catch the promise, read `error.code`                                 |
| `listTools()` / `listPrompts()` / `listResources()` / `listResourceTemplates()` without cursor | One page                                   | Auto-aggregates all pages; `listMaxPages` defaults to 64, overflow throws `SdkError(ListPaginationExceeded)` |
| Declared empty `tools`, `resources`, or `prompts`                                              | `-32601 Method not found`                  | `*/list` returns `[]`, advertises `listChanged: true`; set `listChanged: false` to opt out                   |
| POST `Content-Type`                                                                            | Substring match                            | Parsed media type; non-`application/json` returns `415 Unsupported Media Type`                               |
| Default JSON Schema dialect                                                                    | draft-07                                   | 2020-12; explicit draft-07/06 still honored                                                                  |
| `WebSocketClientTransport`                                                                     | Available                                  | Removed; use `StreamableHTTPClientTransport` or `StdioClientTransport`                                       |

### Era Axes

| Axis                       | 2025 era                                        | 2026 era                          |
| :------------------------- | :---------------------------------------------- | :-------------------------------- |
| Server HTTP entry          | `*StreamableHTTPServerTransport`                | `createMcpHandler`                |
| Server stdio entry         | `server.connect(StdioServerTransport)`          | `serveStdio(factory)`             |
| Client connect             | `initialize` handshake                          | `server/discover` probe           |
| Client identity            | `getClientCapabilities/Version`                 | `ctx.mcpReq.envelope` per request |
| Client cancellation (HTTP) | POST `notifications/cancelled`                  | Close request's SSE stream        |
| Server-to-client requests  | `ctx.mcpReq.send`                               | `return inputRequired(...)`       |
| Change notifications       | `list_changed` / `updated`                      | `subscriptions/listen` stream     |
| Logging                    | `ctx.mcpReq.log()` / session `logging/setLevel` | Per-request `_meta.logLevel`      |
| HTTP 400 JSON-RPC error    | `SdkHttpError`                                  | In-band `ProtocolError`           |

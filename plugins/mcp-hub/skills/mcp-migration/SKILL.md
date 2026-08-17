---
name: mcp-migration
description: Migration: MCP SDK v1 to v2 through the codemod, split packages, API rewrites, and behavior verification.
user-invocable: false
metadata:
  category: technique
---

# Migrating MCP SDK v1 to v2

Migrate Node ≥20 projects from `@modelcontextprotocol/sdk` v1 to the split v2 packages. Reference: https://ts.sdk.modelcontextprotocol.io/v2/

## Steps

1. **Scope the migration**: Identify every legacy dependency and import. For a large, multi-directory project, follow [mcp-planning] decision 15: migrate one directory at a time, retain both SDK versions only while untouched v1 code remains, and remove v1 once `rg '@modelcontextprotocol/sdk'` finds no source imports. SDK objects cannot cross the v1/v2 boundary: their nominal types and `instanceof` checks differ.

   **Done:** The migration scope and one-shot or staged posture are explicit; every staged boundary isolates v1 and v2 SDK objects.

2. **Run the codemod on that scope**: Execute `npx @modelcontextprotocol/codemod@latest v1-to-v2 .`, replacing `.` with one target file when staging. It updates split-package imports, renames symbols, converts `extra` to `ctx`, rewrites schema-based `setRequestHandler` calls to method strings, and changes `.tool()`/`.prompt()`/`.resource()` registrations to `registerTool`/`registerPrompt`/`registerResource` with `z.object()` schemas. It writes `@mcp-codemod-error` where a safe rewrite is unavailable.

   **Done:** Every targeted file either compiles after the rewrite or has an `@mcp-codemod-error` marker to resolve.

3. **Install the split packages**: Replace the v1 package with the public v2 packages used by rewritten imports (see [Package Split](#package-split)). Install `@modelcontextprotocol/server-legacy/sse` only for `SSEServerTransport`. In staged work, retain `@modelcontextprotocol/sdk` only for untouched v1 code; a one-shot migration removes it now.

   **Done:** Every migrated import resolves to its v2 package, and any retained v1 dependency serves only an unmigrated scope.

4. **Resolve each codemod marker**: Find `@mcp-codemod-error` within the migration scope and apply the matching [rename](#renames) before moving on.

   **Done:** The migrated scope has zero `@mcp-codemod-error` comments and typechecks against installed packages.

5. **Set the era posture**: Honor [mcp-planning] decision 13; without a record, serve both eras. HTTP uses `createMcpHandler(factory, { legacy: 'stateless' })` and stdio uses `serveStdio(factory, { legacy: 'serve' })` for both; modern-only uses `legacy: 'reject'`; 2025-only retains the hand-wired `*StreamableHTTPServerTransport` stack, which has no `legacy:` setting.

   **Done:** Every server entry point implements the selected both-era, modern-only, or 2025-only posture.

6. **Modernize interaction and change flow for the selected era**: Both-era and modern servers return `inputRequired(...)` instead of blocking for input; a both-era server keeps `ctx.mcpReq.elicitInput` only inside its 2025 branch, because it throws for modern calls. Use `requestState` for modern multi-round data and `subscriptions/listen` for modern change streams. A 2025-only stack retains its 2025 interaction and notification mechanisms.

   **Done:** Each interaction, cross-round state, and change-notification path uses APIs supported by its selected connection era.

7. **Adopt `McpServer` where possible**: Convert low-level `Server` instances unless custom or vendor JSON-RPC methods require the low-level class; send those cases to [mcp-protocol]. Use Standard Schema objects: `z.object(...)` from zod ≥4.2.0, or existing ArkType or Valibot schemas.

   **Done:** Every server is either an `McpServer` or has documented custom methods that require low-level [mcp-protocol] handling.

8. **Choose and verify the module mode**: Default to ESM with `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, and `"type": "module"`. v2 is ESM-first, and CommonJS projects can directly `require('@modelcontextprotocol/…')`.

   **Done:** The selected ESM or CommonJS mode resolves every v2 import in the project’s compiler and runtime.

9. **Verify behavior**: Run the tests described by [mcp-test], then review every [Silent Behavior Change](#silent-behavior-changes) against the migrated code. Tests—not the codemod or compiler—cover those differences. At the final staged slice, remove the legacy package and confirm no source import remains.

   **Done:** The migrated scope compiles and passes its tests; every silent change is accounted for; and a complete migration has no legacy package or source import.

## Reference

### Package Split

| Package                               | Purpose                                                                                  |
| :------------------------------------ | :--------------------------------------------------------------------------------------- |
| `@modelcontextprotocol/server`        | `McpServer`, `Server`, `createMcpHandler`, validation, and errors                        |
| `@modelcontextprotocol/client`        | `Client`, transport, auth, middleware, and caching                                       |
| `@modelcontextprotocol/core`          | Raw Zod wire schemas for gateways and proxies                                            |
| `@modelcontextprotocol/node`          | Node HTTP adapter: `toNodeHandler` and stream transport                                  |
| `@modelcontextprotocol/codemod`       | Migration CLI                                                                            |
| `@modelcontextprotocol/server-legacy` | Frozen v1 `SSEServerTransport` (`/sse`) and Authorization Server OAuth helpers (`/auth`) |
| `@modelcontextprotocol/express`       | Express adapter when the v1 server owns HTTP integration                                 |
| `@modelcontextprotocol/hono`          | Hono adapter when the v1 server owns HTTP integration                                    |
| `@modelcontextprotocol/fastify`       | Fastify adapter when the v1 server owns HTTP integration                                 |

**stdio subpath gotcha:** import `StdioClientTransport`, `StdioServerParameters`, `getDefaultEnvironment`, and `DEFAULT_INHERITED_ENV_VARS` from `@modelcontextprotocol/client/stdio`; import `StdioServerTransport` from `@modelcontextprotocol/server/stdio`. The runtime-neutral package roots omit these exports, while `ReadBuffer`, `serializeMessage`, and `deserializeMessage` remain at the root.

### Renames

#### API and type

| v1                                                       | v2                                                                               |
| :------------------------------------------------------- | :------------------------------------------------------------------------------- |
| `server.setRequestHandler(CallToolRequestSchema, ...)`   | `server.setRequestHandler('tools/call', ...)` (low-level method string)          |
| `.tool(...)` (variadic high-level)                       | `.registerTool(name, config, handler)` (high-level)                              |
| `McpError` / `ErrorCode`                                 | `ProtocolError` / `ProtocolErrorCode` (or `SdkErrorCode`)                        |
| `StreamableHTTPError`                                    | `SdkHttpError`                                                                   |
| `SchemaInput<T>`                                         | `StandardSchemaWithJSON.InferInput<T>`                                           |
| `ResourceTemplate` wire type                             | `ResourceTemplateType`                                                           |
| `JSONRPCError` / `JSONRPCErrorSchema` / `isJSONRPCError` | `JSONRPCErrorResponse` / `JSONRPCErrorResponseSchema` / `isJSONRPCErrorResponse` |
| `ResourceReference` / `ResourceReferenceSchema`          | `ResourceTemplateReference` / `ResourceTemplateReferenceSchema`                  |
| `IsomorphicHeaders`                                      | Web Standard `Headers` with `.get()` and `.set()`                                |

**Call-site gotcha:** low-level `setRequestHandler(Schema)` becomes `setRequestHandler('method/string')`; high-level `.tool()` becomes `.registerTool()`. These are distinct conversions.

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
| `elicitInput`                                       | `inputRequired(...)`; retain `ctx.mcpReq.elicitInput` only for 2025 branches              |
| `StreamableHTTPServerTransport`                     | `Node/WebStandardStreamableHTTPServerTransport`                                           |
| `extra.taskStore` / `taskId` / `taskRequestedTtl`   | Removed (experimental tasks, SEP-2663); delete usages                                     |

#### OAuth migration

Map each `<Name>Error` class to `OAuthErrorCode.<Name>` without the `Error` suffix (`InvalidGrantError` → `OAuthErrorCode.InvalidGrant`), except `ServerError`, which retains its name; map `CustomOAuthError` to a defined custom code. Replace `OAUTH_ERRORS` and `instanceof` checks with a switch on `error.code`. Token verifiers throw `OAuthError(OAuthErrorCode.InvalidToken)` for invalid tokens so the response is not an HTTP 500. `InsufficientScopeError` from SEP-2350 is a transport-layer `OAuthClientFlowError`, distinct from `OAuthErrorCode.InsufficientScope`.

### Silent Behavior Changes

The compiler and codemod cannot detect these changes.

| Behavior                                                                                         | v1                                         | v2                                                                                                              |
| :----------------------------------------------------------------------------------------------- | :----------------------------------------- | :-------------------------------------------------------------------------------------------------------------- |
| Unknown or disabled tool name                                                                    | Resolves `CallToolResult{ isError: true }` | Rejects `ProtocolError(InvalidParams)`; catch the promise and read `error.code`                                 |
| `listTools()` / `listPrompts()` / `listResources()` / `listResourceTemplates()` without a cursor | One page                                   | Auto-aggregates all pages; `listMaxPages` defaults to 64 and overflow throws `SdkError(ListPaginationExceeded)` |
| Declared empty `tools`, `resources`, or `prompts`                                                | `-32601 Method not found`                  | `*/list` returns `[]` and advertises `listChanged: true`; set `listChanged: false` to opt out                   |
| POST `Content-Type`                                                                              | Substring match                            | Parsed media type; non-`application/json` returns `415 Unsupported Media Type`                                  |
| Default JSON Schema dialect                                                                      | draft-07                                   | 2020-12; explicit draft-07/06 remains honored                                                                   |
| `WebSocketClientTransport`                                                                       | Available                                  | Removed; use `StreamableHTTPClientTransport` or `StdioClientTransport`                                          |

### Era Axes

| Axis                       | 2025 era                                        | 2026 era                          |
| :------------------------- | :---------------------------------------------- | :-------------------------------- |
| Server HTTP entry          | `*StreamableHTTPServerTransport`                | `createMcpHandler`                |
| Server stdio entry         | `server.connect(StdioServerTransport)`          | `serveStdio(factory)`             |
| Client connect             | `initialize` handshake                          | `server/discover` probe           |
| Client identity            | `getClientCapabilities/Version`                 | `ctx.mcpReq.envelope` per request |
| Client cancellation (HTTP) | POST `notifications/cancelled`                  | Close the request’s SSE stream    |
| Server-to-client requests  | `ctx.mcpReq.send`                               | `return inputRequired(...)`       |
| Change notifications       | `list_changed` / `updated`                      | `subscriptions/listen` stream     |
| Logging                    | `ctx.mcpReq.log()` / session `logging/setLevel` | Per-request `_meta.logLevel`      |
| HTTP 400 JSON-RPC error    | `SdkHttpError`                                  | In-band `ProtocolError`           |

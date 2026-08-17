---
name: mcp-migration
description: MCP SDK v2: use when migrating an MCP codebase from @modelcontextprotocol/sdk v1 to split v2 packages, including running the v1-to-v2 codemod and resolving its renames by hand.
user-invocable: false
metadata:
  category: technique
---

# Migrating MCP SDK v1 to v2

Upgrades from `@modelcontextprotocol/sdk` v1 to split v2 packages on Node ≥ 20. Official docs: https://ts.sdk.modelcontextprotocol.io/v2/

Flow: `scope → codemod → packages → flags → era → modernize → mcpserver → tsconfig → verify`

## Steps

1. **Confirm Scope**: Confirm the codebase contains `@modelcontextprotocol` dependencies or legacy v1 imports. For a large, multi-directory codebase, stage the rewrite instead of a one-shot pass (per [mcp-planning] decision 15): add the v2 packages and `zod ^4.2.0` alongside `@modelcontextprotocol/sdk`, rewrite one directory at a time, and remove the v1 dependency only once `grep -rn "@modelcontextprotocol/sdk"` finds no source import. While both are installed, no SDK object may cross the v1/v2 boundary — `instanceof` and nominal types don't.

- [ ]: Codebase confirmed to contain `@modelcontextprotocol` dependencies or legacy v1 imports; for large codebases, a staging posture (one-shot vs per-directory) has been chosen.

2. **Execute Codemod**: Run `npx @modelcontextprotocol/codemod@latest v1-to-v2 .` (swap `.` for a file path to target one file). It rewrites import paths to the split v2 packages, renames symbols and remaps `extra`→`ctx`, converts schema-based `setRequestHandler(XSchema, ...)` calls to method-string form, and converts `.tool()`/`.prompt()`/`.resource()` registrations to `registerTool`/`registerPrompt`/`registerResource` wrapped in `z.object()`. Where it can't safely resolve a case, it inserts an inline `@mcp-codemod-error` comment instead of guessing.

- [ ]: Codemod executed across the confirmed scope; every touched file either compiles or carries an `@mcp-codemod-error` marker.

3. **Update Packages**: Swap `@modelcontextprotocol/sdk` for the split v2 packages the rewritten imports now point at (see Package Split below) before resolving anything by hand — with the real packages installed, the language server and compiler can confirm each fix in the next step instead of guessing against unresolved modules. Load `@modelcontextprotocol/server-legacy/sse` if the codebase uses `SSEServerTransport`.

- [ ]: `package.json` lists only split v2 packages — no `@modelcontextprotocol/sdk` remains; stdio and SSE imports use their required subpaths.

4. **Resolve Flags**: Find every remaining marker with `grep -rn '@mcp-codemod-error' .` and resolve each by hand using the Renames tables below.

- [ ]: Zero `@mcp-codemod-error` comments remain anywhere in the source tree.

5. **Choose Era Posture**: Decide the 2026-07-28 posture now — it determines how step 6 is written. Default to serving both eras (HTTP: `createMcpHandler(factory, { legacy: 'stateless' })`; stdio: `serveStdio(factory, { legacy: 'serve' })`, decided once per connection) unless [mcp-planning] decision 13 already chose modern-only (`legacy: 'reject'`).

- [ ]: Era posture chosen and passed to `createMcpHandler`/`serveStdio`.

6. **Modernize State & Flow**:
   - Change blocking `elicitInput` calls to `inputRequired(...)` returns (import from `@modelcontextprotocol/server`). Keep the `ctx.mcpReq.elicitInput` branch only if step 5 chose to serve legacy connections — it throws unconditionally on 2026-era ones.
   - Employ `requestState` context properties for multi-round communication.
   - Replace legacy `list_changed` events with modern `subscriptions/listen` streams.

- [ ]: `elicitInput`→`inputRequired` (legacy branch present only if step 5 serves it), `requestState` wired for multi-round flows, `list_changed`→`subscriptions/listen`.

7. **Adopt McpServer**: Convert low-level `Server` to `McpServer` unless custom/vendor JSON-RPC methods require the low-level class — those stay; see [mcp-protocol]. This automates capability registration. Transition to Standard Schema objects (e.g. `z.object(...)` from zod ≥4.2.0; ArkType as-is; Valibot as-is (native Standard Schema)).

- [ ]: Every low-level `Server` either converted to `McpServer` or confirmed to carry custom methods that require it (handed to [mcp-protocol]); Standard Schema objects adopted.

8. **Transition TS Config**: Configure `tsconfig.json` modules to `"NodeNext"`, `"moduleResolution": "NodeNext"` and set `"type": "module"` in `package.json` for ESM (recommended). v2 is ESM-first but ships a CommonJS build too, so CommonJS projects can `require('@modelcontextprotocol/…')` directly — no dynamic `import()` shim required.

- [ ]: The app uses modern ECMAScript Modules (ESM) with a verified `NodeNext` resolution context.

9. **Verify with Tests**: Validate code functionality using [mcp-test] integration and unit assertions, and check the migrated code against Silent Behavior Changes below — the codemod and compiler can't catch these, so tests are the only gate.

- [ ]: Tests via [mcp-test] compile and pass against the migrated code; no references to the legacy `@modelcontextprotocol/sdk` package remain in `package.json` or source files; and every row of Silent Behavior Changes reviewed against the codebase (each either confirmed unchanged or migrated).

## Reference

### Package Split

| Package                               | Purpose                                                                                  |
| :------------------------------------ | :--------------------------------------------------------------------------------------- |
| `@modelcontextprotocol/server`        | `McpServer`, `Server`, `createMcpHandler`, validation & errors                           |
| `@modelcontextprotocol/client`        | `Client`, transport, auth, middleware, caching                                           |
| `@modelcontextprotocol/core`          | Raw Zod wire schemas for gateways & proxies                                              |
| `@modelcontextprotocol/node`          | Node HTTP adapter: `toNodeHandler` & stream transport                                    |
| `@modelcontextprotocol/codemod`       | This migration CLI                                                                       |
| `@modelcontextprotocol/server-legacy` | Frozen v1 `SSEServerTransport` (`/sse`) and Authorization Server OAuth helpers (`/auth`) |
| `@modelcontextprotocol/express`       | Express adapter — only needed if the v1 server bootstrapped its own HTTP integration     |
| `@modelcontextprotocol/hono`          | Hono adapter — only needed if the v1 server bootstrapped its own HTTP integration        |
| `@modelcontextprotocol/fastify`       | Fastify adapter — only needed if the v1 server bootstrapped its own HTTP integration     |

Never import `@modelcontextprotocol/core-internal` — private, no stable API.

> **stdio subpath**: `StdioClientTransport`, `StdioServerParameters`, `getDefaultEnvironment`, `DEFAULT_INHERITED_ENV_VARS` import from `@modelcontextprotocol/client/stdio`; `StdioServerTransport` from `@modelcontextprotocol/server/stdio`. The package root barrels don't export these (root stays runtime-neutral for browser/Workers bundlers) — `ReadBuffer`, `serializeMessage`, `deserializeMessage` do stay in the root barrel.

### Renames

#### API & Type

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

> Low-level `setRequestHandler(Schema)` becomes `setRequestHandler('method/string')`; high-level `.tool()` becomes `.registerTool()`. Low-level and high-level are distinct renames (different call sites).

#### Context & Property

| v1                                                  | v2                                                                                                  |
| :-------------------------------------------------- | :-------------------------------------------------------------------------------------------------- |
| `RequestHandlerExtra` (`extra`)                     | `ServerContext` / `ClientContext` (`ctx`)                                                           |
| `extra.signal` / `requestId` / `_meta`              | `ctx.mcpReq.signal` / `id` / `_meta`                                                                |
| `extra.sendRequest` / `sendNotification`            | `ctx.mcpReq.send` / `notify`                                                                        |
| `extra.authInfo` / `requestInfo`                    | `ctx.http?.authInfo` / `req` (stdio = undefined)                                                    |
| `extra.sessionId`                                   | `ctx.sessionId`                                                                                     |
| `extra.closeSSEStream` / `closeStandaloneSSEStream` | `ctx.http?.closeSSE` / `closeStandaloneSSE`                                                         |
| `server.sendLoggingMessage`                         | `ctx.mcpReq.log` (deprecated, SEP-2577 — see Era Axes below for the per-request replacement)        |
| `elicitInput`                                       | `inputRequired(...)` (step 6) — `ctx.mcpReq.elicitInput` survives only under a serve-legacy posture |
| `StreamableHTTPServerTransport`                     | `Node/WebStandardStreamableHTTPServerTransport`                                                     |
| `extra.taskStore` / `taskId` / `taskRequestedTtl`   | _removed_ (experimental tasks removed, SEP-2663 — no mechanical migration; delete usages)           |

**If the codebase uses OAuth**, the error classes collapse to one `OAuthError` + `OAuthErrorCode`: every `<Name>Error` class → `OAuthErrorCode.<Name>` with the `Error` suffix dropped (`InvalidGrantError` → `OAuthErrorCode.InvalidGrant`, `InvalidTokenError` → `OAuthErrorCode.InvalidToken`, …), except `ServerError` which keeps its full name (`OAuthErrorCode.ServerError`) and `CustomOAuthError` which maps to a custom code you define. `OAUTH_ERRORS` is removed — replace `instanceof` checks with a switch on `error.code`. Token verifiers must throw `OAuthError(OAuthErrorCode.InvalidToken)` for a bad token, or it becomes an HTTP 500 instead. The **transport-layer** `InsufficientScopeError` (SEP-2350, extends `OAuthClientFlowError`) is a distinct class from `OAuthErrorCode.InsufficientScope` above. Non-OAuth migrations skip this paragraph.

### Silent Behavior Changes

None of these raise a compile error — the codemod can't flag them and TypeScript won't either; only step 9's tests catch them.

| Behavior                                                                              | v1                                         | v2                                                                                                            |
| :------------------------------------------------------------------------------------ | :----------------------------------------- | :------------------------------------------------------------------------------------------------------------ |
| Unknown/disabled tool name                                                            | resolves `CallToolResult{ isError: true }` | rejects `ProtocolError(InvalidParams)` — catch the promise and read `error.code`                              |
| `listTools()`/`listPrompts()`/`listResources()`/`listResourceTemplates()` (no cursor) | one page                                   | auto-aggregates every page (cap `listMaxPages` default 64; overrun throws `SdkError(ListPaginationExceeded)`) |
| Declared `tools: {}`/`resources: {}`/`prompts: {}`, no registrations                  | `-32601 Method not found`                  | `*/list` returns `[]`; advertises `listChanged: true` (set `listChanged: false` to opt out)                   |
| POST `Content-Type`                                                                   | substring match                            | parsed media type; non-`application/json` → `415 Unsupported Media Type`                                      |
| Default JSON Schema dialect                                                           | draft-07                                   | 2020-12 (declared draft-07/06 still honored)                                                                  |
| `WebSocketClientTransport`                                                            | available                                  | removed — use `StreamableHTTPClientTransport` or `StdioClientTransport`                                       |

### Era Axes (2025 vs 2026)

| Axis                                      | 2025 Era (Legacy)                      | 2026 Era (Modern)                   |
| :---------------------------------------- | :------------------------------------- | :---------------------------------- |
| Server HTTP entry                         | `*StreamableHTTPServerTransport`       | `createMcpHandler`                  |
| Server stdio entry                        | `server.connect(StdioServerTransport)` | `serveStdio(factory)`               |
| Client connect                            | `initialize` handshake                 | `server/discover` probe             |
| Client identity                           | `getClientCapabilities/Version`        | `ctx.mcpReq.envelope` (per request) |
| Client cancel (HTTP)                      | POST `notifications/cancelled`         | Close the request's SSE stream      |
| Server→client requests                    | `ctx.mcpReq.send`                      | `return inputRequired(...)`         |
| Change notifications                      | `list_changed` / `updated`             | `subscriptions/listen` stream       |
| `ctx.mcpReq.log()` (deprecated, SEP-2577) | Session `logging/setLevel`             | Per-request `_meta.logLevel`        |
| HTTP 400 JSON-RPC error                   | `SdkHttpError`                         | `ProtocolError` (in-band)           |

---
name: mcp-server
description: Use when building, serving, or publishing an MCP server with the TypeScript SDK v2 (@modelcontextprotocol/server); for testing, load [mcp-test].
user-invocable: false
metadata:
  category: technique
---

# Building MCP Servers

Covers `@modelcontextprotocol/server` SDK v2 (protocol revision `2026-07-28`) on Node.js ≥ 20. Reference: https://ts.sdk.modelcontextprotocol.io/v2/

Flow: `ESM config -> McpServer init -> register (tools/resources/prompts) -> errors -> sanitize paths -> transport (stdio/HTTP) -> scale -> distribute` — then [mcp-test]

Minimal stdio stub (see Step 6 for the full transport picture):

```ts
serveStdio(() => {
  const server = new McpServer({ name: 'app', version: '1.0.0' });
  server.registerTool(
    'hello',
    { inputSchema: z.object({ name: z.string() }) },
    async ({ name }) => ({ content: [{ type: 'text', text: `Hi ${name}` }] }),
  );
  return server;
});
```

## Steps

1. **Configure ESM**: Standardize the project to ESM-only (`"type": "module"` in `package.json`, `"NodeNext"` resolutions in `tsconfig.json`). v2 ships a CommonJS build too, so CJS projects can `require('@modelcontextprotocol/server')` directly — no dynamic `import()` shim needed.

   - [ ] Codebase operates exclusively with modern ESM resolutions (or CJS `require` resolves natively).

2. **Initialize Server**: instantiate `McpServer` with a stable identifier and declare optional constructor behavior up front.

   ```ts
   const server = new McpServer(
     { name: 'catalog', version: '1.0.0' },
     {
       capabilities: { logging: {}, resources: { subscribe: true } },
       instructions: 'Call list-trips before book-trip.',
       enforceStrictCapabilities: true,
       cacheHints: { 'tools/list': { ttlMs: 60_000, cacheScope: 'public' } }, // SEP-2549 — HTTP clients only
     },
   );
   ```

   > `capabilities: { logging: {} }` enables the **deprecated** MCP logging subsystem (SEP-2577) — prefer `console.error` (stderr) or OpenTelemetry for new servers. `resources: { subscribe: true }` is not deprecated.
   - [ ] `name`/`version` are stable identifiers matching `package.json` exactly.

3. **Register Capabilities**: register tools via `.registerTool()`, dynamic resource templates via `.registerResource()`, and prompts via `.registerPrompt()`. `inputSchema`/`outputSchema`/`argsSchema` accept any **Standard Schema** (Zod v4, ArkType as-is, Valibot as-is, or raw JSON Schema via `fromJsonSchema()`). For gateway/proxy and custom (vendor-prefixed) JSON-RPC methods, see [mcp-protocol].

   ```ts
   server.registerTool(
     'search',
     {
       description: 'Search catalog',
       inputSchema: z.object({
         query: z.string().describe('Query'),
         limit: z.number().int().max(50).optional(),
       }),
       outputSchema: z.object({ names: z.array(z.string()) }),
       annotations: { readOnlyHint: true, idempotentHint: true },
     },
     async ({ query, limit }, ctx) => {
       const names = await lookupNames(query, { signal: ctx.mcpReq.signal }); // forward abort on client cancel/disconnect
       return { content: [{ type: 'text', text: names.join('\n') }], structuredContent: { names } };
     },
   );

   server.registerResource(
     'user-profile',
     new ResourceTemplate('users://{userId}/profile', {
       list: undefined,
       complete: { userId: async (v) => lookupIds(v) }, // argument completion for the URI's {userId} param
     }),
     { description: 'Profile', mimeType: 'application/json' },
     async (uri, { userId }) => ({
       contents: [{ uri: uri.href, text: JSON.stringify({ userId }) }],
     }),
   );

   server.registerPrompt(
     'review-code',
     { description: 'Review code', argsSchema: z.object({ code: z.string().describe('Code') }) },
     ({ code }) => ({
       messages: [{ role: 'user', content: { type: 'text', text: `Review:\n\n${code}` } }],
     }),
   );
   ```

   > Wrap any Standard Schema field in `completable(schema, async (value, ctx) => candidates)` to add argument completion — `ctx?.arguments` exposes sibling arguments already filled in, useful for dependent fields (e.g. filtering a `branch` field's candidates by an already-chosen `repo`).

   > **Gotcha — zod version pin:** pin `zod ^4.2.0`; it self-converts via `~standard.jsonSchema`. Zod 3 typechecks cleanly under the v2 peer range but fails only at runtime — registration swallows the conversion failure, the server starts and connects, and the first `tools/list` errors out of `fromJsonSchema()`. Zod 4.0–4.1 lacks `~standard.jsonSchema`: `import { z } from 'zod'` falls back to the bundled Zod's `z.toJSONSchema()` with a one-time `[mcp-sdk]` warning and **drops `.describe()` field descriptions** — a silent degradation, not a failure. The `zod/v4` subpath import instead **fails to compile** (`TS2769 No overload matches this call`). For other schema libs (or older zod), use `fromJsonSchema()` from `@modelcontextprotocol/server`.
   - [ ] Each capability registered via the matching `.registerTool()` / `.registerResource()` / `.registerPrompt()` method with a Standard Schema.
   - [ ] Normal tool exceptions are left to `throw` — the SDK wraps them into `{ isError: true }` automatically.

4. **Handle Errors**: two channels, picked by audience.

   | Channel            | Shape                               | Audience                                      | Produced by                                                 |
   | ------------------ | ----------------------------------- | --------------------------------------------- | ----------------------------------------------------------- |
   | **Tool error**     | Result with `isError: true`         | The **model** — reads the message and retries | Tool handlers: return it, or `throw` anything               |
   | **Protocol error** | JSON-RPC `{ code, message, data? }` | The **caller's code**                         | Resource/prompt/completion callbacks: `throw ProtocolError` |

   ```ts
   // Tool error — put the recovery hint in the text:
   return {
     content: [{ type: 'text', text: `No note "${id}". Known ids: ${ids.join(', ')}` }],
     isError: true,
   };

   // Resource/prompt/completion callbacks:
   import {
     ProtocolError,
     ProtocolErrorCode,
     ResourceNotFoundError,
   } from '@modelcontextprotocol/server';
   throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Note ids are lowercase, got "${id}"`);
   throw new ResourceNotFoundError(uri.href); // -32602 with data: { uri }
   ```

   Tool handlers **cannot** emit a protocol error — every throw (even `ProtocolError`) becomes `isError: true`; the sole exception is `UrlElicitationRequiredError`, which propagates (`-32042`). Full code tables in [mcp-test].

   > **Gotcha — caller side:** an unknown or disabled tool name rejects the `callTool()` promise with `ProtocolError(InvalidParams)` (`-32602`) — it does **not** resolve `{ isError: true }`. Catch the promise and inspect `error.code`; a registered tool's own business failure still returns `isError: true`.
   - [ ] Tool handlers return/`throw` for business failures — never a hand-built `ProtocolError`.
   - [ ] Resource/prompt/completion callbacks `throw ProtocolError`/subclasses for caller-facing failures.

5. **Sanitize Access Paths**: resolve and validate resource paths with `realpath`, checking boundaries to block directory traversal.

   - [ ] Resource template targets resolve securely and cannot exit root directories.

6. **Serve & Secure a Transport**: stdio for local/CLI use, HTTP for networked/hosted use.

   - **stdio**: `serveStdio(factory)`; servers NEVER call `console.log()` — it corrupts the JSON-RPC wire. All diagnostics go to `console.error()`.

     ```ts
     const handle = serveStdio(() => buildServer());
     console.error('listening on stdio'); // stderr — never console.log
     process.on('SIGINT', () => void handle.close());
     ```

   - **HTTP**: `createMcpHandler(factory, options)` returns a web-standard `handler.fetch`; the factory must build a fresh server per request — never accumulate heavy persistent DB connections across requests.

     ```ts
     const handler = createMcpHandler(() => new McpServer({ name: 'notes', version: '1.0.0' }), {
       responseMode: 'auto', // 'auto' | 'json' | 'sse' — 'auto' upgrades to SSE only when a notification precedes the result
       legacy: 'stateless', // 'stateless' (default, serves 2025-era clients) | 'reject'
     });
     ```

     Mount on plain `node:http` via `toNodeHandler(handler)` from `@modelcontextprotocol/node`, on a Web Standard runtime (Workers/Deno/Bun) by exporting `handler.fetch` directly, or on a framework adapter below. `handler.close()` aborts in-flight exchanges. Auth is pass-through: verify the bearer token in front, then `handler.fetch(request, { authInfo })`.

   - **Host/Origin security** (DNS-rebinding + CSRF): app factories (`createMcpExpressApp`/`createMcpFastifyApp`/`createMcpHonoApp`) arm Host/Origin validation by default on localhost. Binding beyond localhost: pass `{ host, allowedHosts, allowedOrigins }`. A **bare** Web Standard runtime with no app factory gets **no** automatic protection — wire it in yourself:

     ```ts
     import {
       createMcpHandler,
       hostHeaderValidationResponse,
       originValidationResponse,
     } from '@modelcontextprotocol/server';
     export default {
       async fetch(request: Request) {
         return (
           hostHeaderValidationResponse(request, allowedHosts) ??
           originValidationResponse(request, allowedOrigins) ??
           handler.fetch(request)
         );
       },
     };
     ```

   - **Framework adapters** — one factory function per framework, same pattern:

     ```ts
     import { createMcpExpressApp } from '@modelcontextprotocol/express';
     import { toNodeHandler } from '@modelcontextprotocol/node';

     const app = createMcpExpressApp();
     const nodeHandler = toNodeHandler(handler);
     app.all('/mcp', (req, res) => void nodeHandler(req, res, req.body));
     app.listen(3000, '127.0.0.1');
     ```

     | Framework | Install                                                                                         | App factory             | Mount delta                                                                                                                                                                                                                                                                       |
     | --------- | ----------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
     | Express   | `@modelcontextprotocol/server @modelcontextprotocol/express express @modelcontextprotocol/node` | `createMcpExpressApp()` | as above; also ships OAuth Resource Server helpers (`requireBearerAuth`, `mcpAuthMetadataRouter`) — see [mcp-auth]                                                                                                                                                                |
     | Fastify   | `@modelcontextprotocol/server @modelcontextprotocol/fastify @modelcontextprotocol/node fastify` | `createMcpFastifyApp()` | `app.all('/mcp', async (req, reply) => nodeHandler(req.raw, reply.raw, req.body))`                                                                                                                                                                                                |
     | Hono      | `@modelcontextprotocol/server @modelcontextprotocol/hono hono`                                  | `createMcpHonoApp()`    | `app.all('/mcp', (c: Context) => handler.fetch(c.req.raw, { parsedBody: c.get('parsedBody') }))` — annotate `c: Context` explicitly, else the compiler mis-narrows the key; runs on Node (`@hono/node-server`'s `serve({ fetch: app.fetch })`), Bun, Deno, and Cloudflare Workers |

   - **Legacy (2025-era) clients**: `createMcpHandler(factory, { legacy: 'stateless' })` or `serveStdio(factory, { legacy: 'serve' })`. SSE is deprecated (migration only) — frozen v1 transport lives in `@modelcontextprotocol/server-legacy/sse`. Every era: a POST whose `Content-Type` isn't `application/json` (by parsed media type) answers `415`.

   - [ ] Stdio servers never call `console.log()`; all diagnostics go to `console.error()`.
   - [ ] HTTP factories instantiate a fresh server per request — no accumulated heavy connections.
   - [ ] A server bound beyond localhost, or on a bare runtime, has Host/Origin validation wired.
   - [ ] Public HTTP endpoints are never exposed without auth ([mcp-auth]).

7. **Manage Sessions & Scale**:

   - **Stateless default**: fresh instance per request, nothing held → any load balancer, no affinity.
   - **Sessions (2025-era only)**: hand-wire `NodeStreamableHTTPServerTransport` with `sessionIdGenerator` and a `Map<sessionId, transport>`. The 2026-07-28 revision is per-request — state lives in `requestState`, not a session.
   - **Resumability**: pass an `eventStore` (`storeEvent(streamId, message)` / `replayEventsAfter(lastEventId, { send })`) so clients can reconnect via `Last-Event-ID`.
   - **Cross-node notifications**: implement a `ServerEventBus` (`publish`/`subscribe`) over external pub/sub (e.g. Redis) and pass it in: `createMcpHandler(factory, { bus: redisBus })`.
   - **Notifications**: most servers notify automatically via a registration handle (`update()`/`enable()`/`disable()`/`remove()`). Behind `createMcpHandler` (stateless per-request), publish through the handler facade instead: `handler.notify.resourceUpdated(uri)`, `.toolsChanged()`, `.promptsChanged()`, `.resourcesChanged()`. On stdio, `server.send*` routes directly onto the stdio stream.

   - [ ] Cross-node deployments pass a shared `ServerEventBus` — otherwise notifications only reach the node that received the change.

8. **Distribute**: ship only after testing with [mcp-test].

   - **stdio via npm/npx**: entry file's first line must be exactly `#!/usr/bin/env node`; `package.json` needs `"type": "module"`, `"bin"`, `"files": ["dist"]`, `"engines": { "node": ">=20" }`. Pin the `@modelcontextprotocol/*` packages together with an exact version (no `^`) — betas break between minors. Smoke-test the packed artifact before publishing: `npm pack && npx @modelcontextprotocol/inspector npx -y ./example-mcp-0.1.0.tgz`.
   - **HTTP**: deploy like any web service; never expose a public endpoint without auth ([mcp-auth]).
   - **Host registration** (copy into the README):

     | App         | How to connect                                                                                                           |
     | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
     | Claude Code | `claude mcp add example -- npx -y example-mcp`                                                                           |
     | VS Code     | `.vscode/mcp.json`: `{ "servers": { "example": { "type": "stdio", "command": "npx", "args": ["-y", "example-mcp"] } } }` |
     | Cursor      | `.cursor/mcp.json`: `{ "mcpServers": { "example": { "command": "npx", "args": ["-y", "example-mcp"] } } }`               |

   - **Versioning**: `new McpServer({ name, version })` must match `package.json` exactly. Changing what a tool requires is a breaking change — prefer adding optional fields; otherwise bump the major version.

   - [ ] Packed artifact smoke-tested with the inspector before publishing.
   - [ ] `McpServer` version matches `package.json` exactly.

## Handler Context (`ctx`)

Every handler receives context as its second argument:

| Member                                         | Purpose                                                                                |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| `ctx.mcpReq.signal`                            | `AbortSignal` — aborts on client cancel/disconnect; check in loops, forward to `fetch` |
| `ctx.mcpReq.id` / `ctx.mcpReq._meta`           | JSON-RPC request id / request `_meta` (e.g. `progressToken`)                           |
| `ctx.mcpReq.notify(n)` / `ctx.mcpReq.send(r)`  | Send notification / request tied to this request                                       |
| `ctx.mcpReq.elicitInput(params)`               | Ask user mid-call (2025-era; throws on 2026-era)                                       |
| `ctx.mcpReq.inputResponses` / `requestState()` | 2026-era multi-round-trip surfaces                                                     |
| `ctx.mcpReq.envelope`                          | Per-request client identity & capabilities (2026-era; legacy: `getClientVersion()`)    |
| `ctx.sessionId`                                | Session id when transport has one                                                      |
| `ctx.http?.authInfo` / `ctx.http?.req`         | Verified `AuthInfo` / inbound `Request` (HTTP only — `undefined` on stdio)             |

## See Also

- Writing/running tests, inspector sessions: [mcp-test]
- Custom transports, gateways, raw wire messages: [mcp-protocol]
- OAuth/bearer-token wiring for HTTP servers: [mcp-auth]

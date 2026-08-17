---
name: mcp-server
description: Use when building, serving, or publishing an MCP server with the TypeScript SDK v2 (@modelcontextprotocol/server); for testing, load [mcp-test].
user-invocable: false
metadata:
  category: technique
---

# Building MCP Servers

Covers `@modelcontextprotocol/server` SDK v2 (protocol revision `2026-07-28`) on Node.js ≥ 20. Official reference: https://ts.sdk.modelcontextprotocol.io/v2/

Flow: `ESM config` ➔ `McpServer` init ➔ register (tools/resources/prompts) ➔ sanitize paths ➔ transport (stdio/HTTP) — then [mcp-test], then distribute

## Stdio Quickstart

See [Quickstart Examples](references/examples.md#quick-start) for complete setups. Minimal stub:

```ts
serveStdio(() => {
  const server = new McpServer({ name: 'app', version: '1.0.0' });
  server.registerTool(
    'hello',
    { inputSchema: z.object({ name: z.string() }) },
    async ({ name }) => ({
      content: [{ type: 'text', text: `Hi ${name}` }],
    }),
  );
  return server;
});
```

## Steps

1. **Configure ESM**: Standardize project to ESM-only (`"type": "module"` in `package.json`, `"NodeNext"` resolutions in `tsconfig.json`).

- [ ]: Codebase operates exclusively with modern ESM resolutions.

2. **Initialize Server**: Instantiate `McpServer` with suitable identifier.

- [ ]: Server `name` and `version` are stable identifiers matching `package.json`.

3. **Register Capabilities**:
   - Register tools using `.registerTool()` passing Standard Schema input schema (see note after Steps and `references/examples.md`).
   - Register dynamic templates using `.registerResource()` mapping dynamic parameters.
   - Register prompt layouts using `.registerPrompt()`.

- [ ]: Each capability registered via matching `.registerTool()` / `.registerResource()` / `.registerPrompt()` method with Standard Schema.
- [ ]: Normal tool exceptions let SDK automatically wrap failures into standard `{ isError: true }` responses.

4. **Sanitize Access Paths**: Resolve and ensure resource paths using `realpath`, validating boundaries to protect against directory traversal.

- [ ]: Resource template targets resolve securely and cannot exit root directories.

5. **Establish Transport**: Bind server dependencies to standard channels (`serveStdio` or HTTP interfaces per-request factories).

- [ ]: Stdio servers NEVER use `console.log()` to prevent JSON-RPC wire corruption. All debug messages output on `console.error()`.
- [ ]: Factory setups for HTTP endpoints instantiate fresh servers per-request without accumulating heavy persistent DB connections.

> `inputSchema`/`outputSchema`/`argsSchema` accept any **Standard Schema** (Zod v4, Arktype, Valibot (native Standard Schema, passed directly), raw JSON Schema via `fromJsonSchema`). For gateway/proxy and custom (vendor-prefixed) JSON-RPC methods, see [mcp-protocol].

> Pin `zod ^4.2.0` — it self-converts via `~standard.jsonSchema`. A `zod` 3 range that satisfied the v1 peer typechecks cleanly under v2 and fails only at runtime, quietly: registration swallows the conversion failure, the server starts and connects, and the first `tools/list` answers with an error pointing at `fromJsonSchema()`. `zod` 4.0–4.1 lacks `~standard.jsonSchema`: under `import { z } from 'zod'` the SDK falls back to its bundled Zod's `z.toJSONSchema()` with a one-time `[mcp-sdk]` console warning and **drops `.describe()` field descriptions** — the server still starts, connects, and `tools/list` works, so this is a _silent degradation_, not a failure (a migrator expecting a compile break gets none). With the `zod/v4` subpath import (or zod-3.25.x via that subpath) the same code runs the fallback but **fails to compile** (`TS2769 No overload matches this call`). For other schema libs or older zod, use `fromJsonSchema()` from `@modelcontextprotocol/server`.

## Reference Guides & Adapters

- [Code Examples](references/examples.md): Practical code samples.
- [Context API](references/context.md): Context variables (`ctx.mcpReq`, `ctx.http`, etc.).
- [Errors API](references/errors.md): Tool vs Protocol error channels and handling.
- [HTTP Serving](references/serving-http.md): Setup, Host/Origin security, and legacy clients.
- [Scaling & Notifications](references/scaling.md): Caching, state, Event Bus, and pub/sub.
- [Distribution](references/distribution.md): Npm publishing and host installation (`mcp.json`).
- Adapters: [Express](references/framework-express.md) \| [Fastify](references/framework-fastify.md) \| [Hono](references/framework-hono.md) — pick by web stack (Hono for edge/serverless, Fastify for schema validation, Express for ecosystem/OAuth helpers).

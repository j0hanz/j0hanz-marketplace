---
description: Guide to HTTP server setup, Host/Origin security, caching, and legacy client adapters.
metadata:
  tags: [http-serving, security, caching, legacy]
  source: internal
---

# HTTP Serving Guide

## `createMcpHandler` Options

```ts
const handler = createMcpHandler(factory, {
  responseMode: 'auto', // 'auto' | 'json' | 'sse'
  legacy: 'stateless', // 'stateless' (default) | 'reject'
  bus: new InMemoryServerEventBus(),
});
```

- `handler.fetch` is web-standard `(Request) => Promise<Response>`.
- `responseMode`: `'auto'` answers with single JSON body, upgrading to SSE only when notification precedes result; `'json'` never streams; `'sse'` always streams.
- `handler.close()` aborts in-flight exchanges.

## Host/Origin Security

- App factories arm Host/Origin validation by default on localhost.
- **Binding beyond localhost**: configure allowed hosts: `createMcp*App({ host: '0.0.0.0', allowedHosts: ['api.example.com'], allowedOrigins: [...] })`.
- Bare fetch runtimes: use `hostHeaderValidationResponse(request, allowedHosts)` and `originValidationResponse(request, allowedOrigins)` from `@modelcontextprotocol/server`.
- Native middleware: use `hostHeaderValidation(allowedHostnames)`, `localhostHostValidation()`, `originValidation(allowedOrigins)` from `@modelcontextprotocol/express` (or `fastify` / `hono` equivalents).
- Auth is pass-through: verify bearer token in front and pass to `fetch`: `handler.fetch(request, { authInfo })`.

## Cache Hints (SEP-2549)

Mark results with freshness hints so clients can cache:

```ts
new McpServer(
  { name: 'catalog', version: '1.0.0' },
  {
    cacheHints: {
      'tools/list': { ttlMs: 60_000, cacheScope: 'public' },
      'resources/read': { ttlMs: 5_000, cacheScope: 'private' },
    },
  },
);
```

## Bare Web-Standard Runtimes (Cloudflare Workers / Deno / Bun)

With no framework adapter, `handler.fetch` is entire server — no app factory runs, so Host/Origin protection is **not** armed automatically. Wire it in yourself:

```ts
import {
  createMcpHandler,
  hostHeaderValidationResponse,
  originValidationResponse,
} from '@modelcontextprotocol/server';

const handler = createMcpHandler(factory);
const allowedHosts = ['api.example.com'];
const allowedOrigins = ['https://app.example.com'];

export default {
  async fetch(request: Request): Promise<Response> {
    return (
      hostHeaderValidationResponse(request, allowedHosts) ??
      originValidationResponse(request, allowedOrigins) ??
      handler.fetch(request)
    );
  },
};
```

Skipping this on bare runtime leaves server open to DNS-rebinding and cross-origin attacks that framework adapter (Express/Fastify/Hono) would otherwise block by default.

## Legacy Clients

Serving 2025-era clients:

- `createMcpHandler(factory, { legacy: 'stateless' })` — stateless per-request serving of legacy calls.
- `serveStdio(factory, { legacy: 'serve' })` — decide once per stdio connection.
- **SSE (deprecated, migration only)**: Migrate to Streamable HTTP. Frozen v1 SSE transport in `@modelcontextprotocol/server-legacy/sse`.

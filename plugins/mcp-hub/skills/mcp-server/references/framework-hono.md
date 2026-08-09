---
description: >-
  Detailed API reference, middleware configuration, and integration examples for mounting MCP servers on Hono.
metadata:
  tags: [hono, serverless, middleware, integration]
  source: internal
---

# Hono Integration

`@modelcontextprotocol/hono` provides an adapter for Hono, suitable for Node.js, Bun, Deno, Deno Deploy, Cloudflare Workers, and other web-standard environments.

## Installation

`npm install @modelcontextprotocol/server @modelcontextprotocol/hono hono`

## Security Options

Hono app factories enable Host/Origin verification by default on localhost to prevent DNS-rebinding and CSRF attacks.

## API Reference

### `createMcpHonoApp(options?)`

Creates a Hono app pre-configured with JSON body parsing and default DNS-rebinding/Origin validation protections.

- **Options:**
  - `host` (string): Hostname to bind to. Default: `'127.0.0.1'`.
  - `allowedHosts` (string[]): Allowed hostnames for DNS-rebinding protection.
  - `allowedOrigins` (string[]): Allowed browser origin hostnames.

### Middleware Helpers

- `hostHeaderValidation(allowedHostnames: string[]): MiddlewareHandler`
- `localhostHostValidation(): MiddlewareHandler`
- `originValidation(allowedOrigins: string[]): MiddlewareHandler`
- `localhostOriginValidation(): MiddlewareHandler`

## Usage Examples

### Web Standard Routing (Cloudflare Workers / Deno / Bun)

Hono operates natively with Web Standard request/responses. Direct call to `handler.fetch` is supported.

> [!IMPORTANT]
> Always declare the explicit type annotation `c: Context` on Hono handlers to prevent compiler key-narrowing type failures.

```ts
import { createMcpHonoApp } from '@modelcontextprotocol/hono';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import type { Context } from 'hono';
import * as z from 'zod/v4';

const mcpHandler = createMcpHandler(() => {
  const server = new McpServer({ name: 'hono-example', version: '1.0.0' });
  server.registerTool(
    'calculate',
    { inputSchema: z.object({ val: z.number() }) },
    async ({ val }) => ({
      content: [{ type: 'text', text: `Result: ${val * 2}` }],
    }),
  );
  return server;
});

const app = createMcpHonoApp();
app.all('/mcp', (c: Context) => mcpHandler.fetch(c.req.raw, { parsedBody: c.get('parsedBody') }));
export default app;
```

### Node.js Runner Example

To execute Hono inside Node.js, use Hono's Node server:

```ts
import { serve } from '@hono/node-server';
import app from './app'; // app exported above

serve({ fetch: app.fetch, port: 3000 });
```

> Node.js runner variant additionally requires `@hono/node-server`.

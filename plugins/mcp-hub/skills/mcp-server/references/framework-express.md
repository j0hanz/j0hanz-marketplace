---
description: >-
  Detailed API reference, middleware configuration, and integration examples for mounting MCP servers on Express.
metadata:
  tags: [express, middleware, oauth, integration]
  source: internal
---

# Express Integration

`@modelcontextprotocol/express` provides middleware, routers, and bootstrap helpers to run MCP servers over Express.

## Installation

`npm install @modelcontextprotocol/server @modelcontextprotocol/express express @modelcontextprotocol/node`

## Security Concepts

MCP servers binding to localhost are vulnerable to DNS Rebinding and CSRF. Express app factories enable Host/Origin verification by default on localhost to prevent these attacks.

### DNS Rebinding Protection

All adapters check incoming `Host` header against allowed hostnames (e.g. `localhost`, `127.0.0.1`, `[::1]`). Unlisted hosts rejected with `400 Bad Request` or `403 Forbidden`.

### Browser Origin Validation

Adapters check `Origin` header against allowed origins list. Requests with no `Origin` pass (allowing local non-browser clients); cross-origin browser requests rejected with `403 Forbidden`.

## API Reference

### `createMcpExpressApp(options?)`

Creates Express app with pre-configured JSON body parsing and Host/Origin validation.

- **Options:**
  - `host` (string): Hostname to bind to. Default `'127.0.0.1'`.
  - `allowedHosts` (string[]): Allowed hostnames for DNS-rebinding protection.
  - `allowedOrigins` (string[]): Allowed browser origin hostnames.
  - `jsonLimit` (string): Max request body size. Default `'100kb'`.

### Middleware Helpers

- `hostHeaderValidation(allowedHostnames: string[]): RequestHandler`
- `localhostHostValidation(): RequestHandler` (limits to localhost, `127.0.0.1`, `[::1]`)
- `originValidation(allowedOrigins: string[]): RequestHandler`
- `localhostOriginValidation(): RequestHandler`
- `requireBearerAuth(options: BearerAuthMiddlewareOptions): RequestHandler` (enforces bearer token, populates `req.auth`)

### OAuth Helpers

- `mcpAuthMetadataRouter(options: AuthMetadataOptions): Router` (exposes RFC 9728 and RFC 8414 metadata)
- `getOAuthProtectedResourceMetadataUrl(serverUrl: URL): string`

## Usage Examples

### Stateless Per-Request Integration

```ts
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

const mcpHandler = createMcpHandler(() => {
  const server = new McpServer({ name: 'express-example', version: '1.0.0' });
  server.registerTool(
    'echo',
    { inputSchema: z.object({ text: z.string() }) },
    async ({ text }) => ({
      content: [{ type: 'text', text }],
    }),
  );
  return server;
});

const app = createMcpExpressApp();
const nodeHandler = toNodeHandler(mcpHandler);
app.all('/mcp', (req, res) => void nodeHandler(req, res, req.body));
app.listen(3000, '127.0.0.1');
```

### OAuth Protected Server

```ts
import {
  createMcpExpressApp,
  requireBearerAuth,
  mcpAuthMetadataRouter,
  getOAuthProtectedResourceMetadataUrl,
} from '@modelcontextprotocol/express';
import { OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server';

const tokenVerifier = {
  async verifyAccessToken(token: string) {
    if (token !== 'valid') throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid token');
    return {
      token,
      clientId: 'user-123',
      scopes: ['mcp:read'],
      expiresAt: new Date(Date.now() + 3600_000),
    };
  },
};

const app = createMcpExpressApp();
const resourceUrl = new URL('http://127.0.0.1:3000');

app.use(
  mcpAuthMetadataRouter({
    resourceServerUrl: resourceUrl,
    oauthMetadata: {
      issuer: 'https://auth.example.com',
      token_endpoint: 'https://auth.example.com/token',
      authorization_endpoint: 'https://auth.example.com/auth',
    },
    scopesSupported: ['mcp:read'],
  }),
);

app.post(
  '/mcp',
  requireBearerAuth({
    verifier: tokenVerifier,
    requiredScopes: ['mcp:read'],
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceUrl),
  }),
  (req, res) => {
    res.json({ status: 'authenticated', clientId: req.auth?.clientId });
  },
);
```

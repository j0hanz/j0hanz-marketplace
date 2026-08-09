---
name: mcp-auth
description: Use when an MCP server or endpoint needs protection or an MCP client needs credentials — bearer-token verification, OAuth flows, or machine-to-machine auth in the TypeScript SDK v2.
when_to_use: Bearer-token verification, OAuth flows, machine-to-machine authentication, MCP authentication, token validation, security.
user-invocable: false
metadata:
  category: technique
---

# MCP Authorization (TypeScript SDK v2)

Server-side HTTP auth and client credentials for TypeScript SDK v2. Ref: https://ts.sdk.modelcontextprotocol.io/v2/

**Server is Resource Server only — never issues tokens.**

## When to Use

- Protecting MCP endpoints with bearer tokens.
- Configuring client credentials, OAuth, or machine-to-machine auth.

## Steps

1. **Wire**: supply `verifyAccessToken` to `requireBearerAuth` — extracts Authorization header, forwards verified `AuthInfo`.
2. **Verify**: check token against IdP/external keys (return 401/403 if invalid).
3. **Populate**: helper attaches `AuthInfo` to `req.auth`; `toNodeHandler` forwards it → handlers read `ctx.http.authInfo` (no manual setup).
4. **Enforce**: in tool callbacks, verify `ctx.http?.authInfo`; return `{ isError: true, content: [...] }` if unauthorized.

## Completion Criteria

- [ ] No token generation, JWT issuing, or credential DB checks on the server (Resource Server only).
- [ ] Token validation fails with standard 401/403 outside/before tool dispatch.
- [ ] Auth failures in tools return `{ isError: true }` — no transport exceptions.
- [ ] Tool callbacks read tenant/user permissions via `ctx.http?.authInfo`, not factory `ctx.authInfo`.
- [ ] No raw HTTP header processing inside individual tool callbacks.
- [ ] No token revocation endpoint on the MCP server — delegate to IdP/Authorization Server.
- [ ] `verifyAccessToken` populates `expiresAt` on `AuthInfo`, else `requireBearerAuth` returns `401 invalid_token`.
- [ ] Token rejection throws `OAuthError` with `OAuthErrorCode.InvalidToken` (other exceptions → `500`).
- [ ] Non-Express `fetch` hosts (Cloudflare Workers, Deno, Hono) use web-standard `requireBearerAuth` from `@modelcontextprotocol/server`.

## Examples & References

- [examples.md](references/examples.md): server verification, prebuilt client providers, custom `OAuthClientProvider` for browser/SPA flows.

## Common Mistakes

- **Token Generation**: issuing tokens/JWT keys from the server instead of verifying via IdP.
- **Header Extraction**: expecting SDK to auto-extract bearer tokens without middleware config.
- **Tool Exceptions**: throwing HTTP/transport errors in tools (return `{ isError: true, content: [...] }` instead).
- **Wrong Auth Context**: reading `ctx.authInfo` (factory-only) instead of `ctx.http?.authInfo`.
- **Dynamic Clients**: using deprecated `registerClient` instead of Client ID Metadata Documents.
- **Test Tokens**: generating real tokens in tests — use mock issuers with [mcp-test].
- **Decode-only JWT**: decoding without verifying signature/issuer/audience — always verify against IdP keys.

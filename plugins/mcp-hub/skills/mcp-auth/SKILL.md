---
name: mcp-auth
description: Use when an MCP server needs bearer-token protection or a client needs service-to-machine credentials (ClientCredentials / PrivateKeyJwt / CrossApp providers) in MCP SDK v2; for browser authorization_code client flows, use [mcp-client].
user-invocable: false
metadata:
  category: technique
---

# Authorization (MCP SDK v2)

Ref: https://ts.sdk.modelcontextprotocol.io/v2/

**Server is Resource Server only — never issues tokens.**

> v1 Authorization Server helpers (`mcpAuthRouter`, `OAuthServerProvider`) are frozen in `@modelcontextprotocol/server-legacy/auth`; Resource Server helpers (`requireBearerAuth`, `mcpAuthMetadataRouter`) come from `@modelcontextprotocol/express` (Node) or `@modelcontextprotocol/server` (web-standard hosts). Migrate the AS role to a dedicated IdP.

## When to Use

- Browser/SPA end-user login wiring (`connect`/`finishAuth`, `IssuerMismatchError`): see [mcp-client] "Authenticate the client".
- Mocking `authInfo` in tests: see [mcp-test].

## Steps

### Protect the server (Resource Server)

```ts
import {
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthMetadataRouter,
  requireBearerAuth,
} from '@modelcontextprotocol/express';
import { OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server';

const auth = requireBearerAuth({
  verifier: {
    verifyAccessToken: async (token) => {
      try {
        const payload = await verifyJwt(token);
        return { token, clientId: payload.sub, scopes: payload.scopes, expiresAt: payload.exp };
      } catch {
        throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid or expired token'); // a plain Error here becomes HTTP 500
      }
    },
  },
  requiredScopes: ['mcp'],
  resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpServerUrl),
});

app.all('/mcp', auth, (req, res) => void node(req, res, req.body));
app.use(mcpAuthMetadataRouter({ oauthMetadata, resourceServerUrl: mcpServerUrl }));
```

1. **Wire**: supply `verifyAccessToken` to `requireBearerAuth` — extracts the Authorization header, forwards verified `AuthInfo`.
2. **Verify**: check the token against IdP/external keys; throw `OAuthError(OAuthErrorCode.InvalidToken)` on rejection.
3. **Populate**: the helper attaches `AuthInfo` to `req.auth`; `toNodeHandler` forwards it → handlers read `ctx.http.authInfo` (no manual setup).
4. **Enforce**: in tool callbacks, verify `ctx.http?.authInfo`; return `{ isError: true, content: [...] }` if unauthorized.

### Authenticate the client

Pick by trust model:

- **User present in a browser** → prebuilt `authorization_code` flow (`UnauthorizedError` catch, `finishAuth` callback leg, `IssuerMismatchError`) — see [mcp-client] "Authenticate the client".
- **Service-to-service, no user** → `ClientCredentialsProvider` or `PrivateKeyJwtProvider`:
  ```ts
  new ClientCredentialsProvider({ clientId, clientSecret, expectedIssuer });
  new PrivateKeyJwtProvider({
    clientId,
    privateKey,
    algorithm: 'RS256',
    jwtLifetimeSeconds: 300,
    expectedIssuer,
  });
  ```
  `expectedIssuer` pins the credential — a mismatched discovery result throws `AuthorizationServerMismatchError`.
- **Host app already authenticated the user** → `CrossAppAccessProvider` exchanges the host session for MCP access:
  ```ts
  new CrossAppAccessProvider({
    assertion: async (ctx) =>
      (await discoverAndRequestJwtAuthGrant({/* issuer/audience */})).jwtAuthGrant,
    clientId,
    clientSecret,
  });
  ```
- **None of the above fit** → implement `OAuthClientProvider`: static `clientMetadata`/`redirectUrl` config plus `tokens`/`saveTokens`, `clientInformation`/`saveClientInformation`, `codeVerifier`/`saveCodeVerifier`, `state`, `redirectToAuthorization`, `saveDiscoveryState`/`discoveryState` methods. Key `clientInformation`/`saveTokens` by `ctx.issuer` (SEP-2352) — a value from one AS must never reach another. Override `validateResourceURL(url, ctx)` for RFC 8707 resource pinning.

Prefer a **Client ID Metadata Document** (host `clientMetadata` at a stable HTTPS URL, pass that URL as `clientId`) over the deprecated `registerClient` (SEP-991).

## Completion Criteria

- [ ] Token issuance and revocation delegated to the IdP; the server validates only.
- [ ] Token validation fails with standard 401/403 outside/before tool dispatch.
- [ ] Auth failures in tools return `{ isError: true }` — no transport exceptions.
- [ ] Tool callbacks read tenant/user permissions via `ctx.http?.authInfo`, not factory `ctx.authInfo`.
- [ ] `verifyAccessToken` populates `expiresAt` on `AuthInfo`, else `requireBearerAuth` returns `401 invalid_token`.
- [ ] Token rejection throws `OAuthError` with `OAuthErrorCode.InvalidToken` — any other exception type becomes an HTTP 500.
- [ ] Non-Express `fetch` hosts (Cloudflare Workers, Deno, Hono) use web-standard `requireBearerAuth` from `@modelcontextprotocol/server`.
- [ ] Client credentials/tokens are stored keyed by `ctx.issuer` (SEP-2352) — never shared across authorization servers.
- [ ] Every Common Mistakes entry checked against the implementation.
- [ ] Error Reference consolidation applied — no `instanceof` on `Invalid*Error` / `OAUTH_ERRORS`.

## Error Reference

- **OAuth consolidation**: the v1 `Invalid*Error` family and `OAUTH_ERRORS` are replaced by `OAuthError` + `OAuthErrorCode`; switch `instanceof` to `error.code`.
- **`InsufficientScopeError`** — two distinct classes: the **OAuth** one (`OAuthError(OAuthErrorCode.InsufficientScope)`, thrown by `verifyAccessToken`) and a separate **transport** class (client-side, SEP-2350) covered in [mcp-client].

## Common Mistakes

- **Header Extraction**: expecting the SDK to auto-extract bearer tokens without wiring `requireBearerAuth` as middleware.
- **Test Tokens**: generating real tokens in tests — use mock issuers with [mcp-test].
- **Decode-only JWT**: decode passes typecheck and returns claims that look valid — verify signature/issuer/audience against IdP keys, not just decode.

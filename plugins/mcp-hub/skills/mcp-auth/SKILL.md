---
name: mcp-auth
description: 'Authorize MCP SDK v2 resource servers with bearer validation, service clients with credentials, or host-session exchanges; browser authorization_code flows use mcp-client.'
user-invocable: false
metadata:
  category: technique
---

# MCP SDK v2 authorization

Ref: https://ts.sdk.modelcontextprotocol.io/v2/

**Server = Resource Server: IdP issue/revoke token, server validate.**

> v1 Authorization Server helpers (`mcpAuthRouter`, `OAuthServerProvider`) frozen in `@modelcontextprotocol/server-legacy/auth`. Resource Server helpers come from `@modelcontextprotocol/express` (Node: `requireBearerAuth`, `mcpAuthMetadataRouter`) or `@modelcontextprotocol/server` (web-standard hosts: `requireBearerAuth`, `oauthMetadataResponse`). Migrate AS role to dedicated IdP.

Browser/SPA login (`connect`, `finishAuth`, `IssuerMismatchError`) belongs in [mcp-client](../mcp-client/SKILL.md) "Authenticate the client." Mock `authInfo` with [mcp-test](../mcp-test/SKILL.md).

## Protect a resource server

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

Verify signature, issuer, audience against IdP keys. Decoded JWT claims alone not enough. `requireBearerAuth` extracts header, attaches verified `AuthInfo` to `req.auth`. `toNodeHandler` forwards it to `ctx.http.authInfo`.

- [ ] `requireBearerAuth` protects MCP route before tool dispatch; `mcpAuthMetadataRouter` serves resource metadata.
- [ ] `verifyAccessToken` supplies `expiresAt`, rejects bad tokens with `OAuthError(OAuthErrorCode.InvalidToken)`. Plain exception becomes HTTP 500.
- [ ] Tool callbacks get tenant/user permissions from `ctx.http?.authInfo`, return `{ isError: true, content: [...] }` on authorization failure.
- [ ] Express hosts use `@modelcontextprotocol/express` (`requireBearerAuth`, `mcpAuthMetadataRouter`); web-standard fetch hosts use `requireBearerAuth` + `oauthMetadataResponse` from `@modelcontextprotocol/server`.

```ts
// web-standard fetch host (Cloudflare Workers, Hono, Bun, Deno)
import { oauthMetadataResponse, requireBearerAuth } from '@modelcontextprotocol/server';

export default {
  async fetch(req: Request): Promise<Response> {
    const meta = await oauthMetadataResponse(req, {
      oauthMetadata,
      resourceServerUrl: mcpServerUrl,
    });
    if (meta) return meta; // RFC 9728 protected-resource / RFC 8414 AS metadata
    // ...route to handler; requireBearerAuth(req) returns AuthInfo or a 401 challenge Response
  },
};
```

## Authenticate a service client

Use `ClientCredentialsProvider` for service with client secret. Use `PrivateKeyJwtProvider` when authorization server requires private-key client authentication:

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

`expectedIssuer` pins credentials; mismatched discovery throws `AuthorizationServerMismatchError`.

For authenticated host session, exchange its assertion with `CrossAppAccessProvider`:

```ts
new CrossAppAccessProvider({
  assertion: async (ctx) =>
    (await discoverAndRequestJwtAuthGrant({/* issuer/audience */})).jwtAuthGrant,
  clientId,
  clientSecret,
  expectedIssuer,
});
```

For other grant model, implement `OAuthClientProvider` with static `clientMetadata`/`redirectUrl` plus `tokens`/`saveTokens`, `clientInformation`/`saveClientInformation`, `codeVerifier`/`saveCodeVerifier`, `state`, `redirectToAuthorization`, and `saveDiscoveryState`/`discoveryState`. Only `clientInformation(ctx?)` and `saveClientInformation(info, ctx?)` accept optional `ctx`; `saveTokens(tokens)` and `tokens()` take no `ctx` — tokens not issuer-partitioned. Override `validateResourceURL(serverUrl, resource?)` for RFC 8707 resource pinning. Use **Client ID Metadata Document** — stable HTTPS `clientMetadata` URL passed as `clientId` — instead of deprecated `registerClient` (SEP-991).

- [ ] `ClientCredentialsProvider` sets `expectedIssuer` (mismatched discovery throws `AuthorizationServerMismatchError`); `PrivateKeyJwtProvider` and `CrossAppAccessProvider` don't accept it.
- [ ] `clientInformation` and `saveClientInformation` accept optional `ctx`; `tokens` and `saveTokens` not issuer-partitioned.
- [ ] Custom provider implements every listed persistence and redirect method, plus resource URL validation when RFC 8707 pinning applies.

## Handle authorization errors

- **OAuth consolidation**: v1 `Invalid*Error` family and `OAUTH_ERRORS` replaced by `OAuthError` + `OAuthErrorCode`; switch `instanceof` to `error.code`.
- **`InsufficientScopeError`** — two distinct classes: **OAuth** one (`OAuthError(OAuthErrorCode.InsufficientScope)`, surfaced as 403 by `requireBearerAuth` scope enforcement) and separate **transport** class (client-side, SEP-2350), covered in [mcp-client](../mcp-client/SKILL.md).

- [ ] Error handling uses `error.code` for consolidated OAuth errors, distinguishes OAuth vs transport `InsufficientScopeError` classes.
- [ ] Tests use mock issuers from [mcp-test](../mcp-test/SKILL.md).

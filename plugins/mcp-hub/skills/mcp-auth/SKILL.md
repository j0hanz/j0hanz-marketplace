---
name: mcp-auth
description: 'Authorize MCP SDK v2 resource servers with bearer validation, service clients with credentials, or host-session exchanges; browser authorization_code flows use mcp-client.'
user-invocable: false
metadata:
  category: technique
---

# MCP SDK v2 authorization

Ref: https://ts.sdk.modelcontextprotocol.io/v2/

**A server is a Resource Server: an IdP issues and revokes tokens; the server validates them.**

> v1 Authorization Server helpers (`mcpAuthRouter`, `OAuthServerProvider`) are frozen in `@modelcontextprotocol/server-legacy/auth`; Resource Server helpers (`requireBearerAuth`, `mcpAuthMetadataRouter`) come from `@modelcontextprotocol/express` (Node) or `@modelcontextprotocol/server` (web-standard hosts). Migrate the AS role to a dedicated IdP.

Browser/SPA login (`connect`, `finishAuth`, `IssuerMismatchError`) belongs in [mcp-client](../mcp-client/SKILL.md) “Authenticate the client.” Mock `authInfo` with [mcp-test](../mcp-test/SKILL.md).

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

Verify signatures, issuer, and audience against IdP keys; decoded JWT claims are insufficient. `requireBearerAuth` extracts the header, attaches verified `AuthInfo` to `req.auth`, and `toNodeHandler` forwards it to `ctx.http.authInfo`.

- [ ] `requireBearerAuth` protects the MCP route before tool dispatch and `mcpAuthMetadataRouter` serves resource metadata.
- [ ] `verifyAccessToken` supplies `expiresAt` and rejects bad tokens with `OAuthError(OAuthErrorCode.InvalidToken)`; a plain exception becomes HTTP 500.
- [ ] Tool callbacks obtain tenant/user permissions from `ctx.http?.authInfo` and return `{ isError: true, content: [...] }` for authorization failures.
- [ ] The host uses `@modelcontextprotocol/express` for Express or web-standard `requireBearerAuth` from `@modelcontextprotocol/server` for fetch hosts.

## Authenticate a service client

Use `ClientCredentialsProvider` for a service with a client secret. Use `PrivateKeyJwtProvider` when the authorization server requires private-key client authentication:

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

For an authenticated host session, exchange its assertion with `CrossAppAccessProvider`:

```ts
new CrossAppAccessProvider({
  assertion: async (ctx) =>
    (await discoverAndRequestJwtAuthGrant({/* issuer/audience */})).jwtAuthGrant,
  clientId,
  clientSecret,
  expectedIssuer,
});
```

For another grant model, implement `OAuthClientProvider` with static `clientMetadata`/`redirectUrl` plus `tokens`/`saveTokens`, `clientInformation`/`saveClientInformation`, `codeVerifier`/`saveCodeVerifier`, `state`, `redirectToAuthorization`, and `saveDiscoveryState`/`discoveryState`. Key `clientInformation` and `saveTokens` by `ctx.issuer` (SEP-2352), and override `validateResourceURL(serverUrl, resource?)` for RFC 8707 resource pinning. Use a **Client ID Metadata Document**—a stable HTTPS `clientMetadata` URL passed as `clientId`—instead of deprecated `registerClient` (SEP-991).

- [ ] Each `ClientCredentialsProvider`, `PrivateKeyJwtProvider`, and `CrossAppAccessProvider` sets `expectedIssuer`.
- [ ] Client information and tokens are partitioned by `ctx.issuer`; an authorization server receives only its own values.
- [ ] A custom provider implements every listed persistence and redirect method, plus resource URL validation when RFC 8707 pinning applies.

## Handle authorization errors

- **OAuth consolidation**: the v1 `Invalid*Error` family and `OAUTH_ERRORS` are replaced by `OAuthError` + `OAuthErrorCode`; switch `instanceof` to `error.code`.
- **`InsufficientScopeError`** — two distinct classes: the **OAuth** one (`OAuthError(OAuthErrorCode.InsufficientScope)`, surfaced as a 403 by `requireBearerAuth` scope enforcement) and a separate **transport** class (client-side, SEP-2350) covered in [mcp-client](../mcp-client/SKILL.md).

- [ ] Error handling uses `error.code` for the consolidated OAuth errors and distinguishes the OAuth and transport `InsufficientScopeError` classes.
- [ ] Tests use mock issuers from [mcp-test](../mcp-test/SKILL.md).

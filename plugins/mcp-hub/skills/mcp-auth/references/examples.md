---
description: >-
  Examples illustrating server-side bearer auth, end-user OAuth, client credentials, and cross-app session authorization.
metadata:
  tags: [examples, oauth, authentication, bearer-auth]
  source: internal
---

# MCP Authorization Examples & Flows

## Server side - protecting the endpoint

```ts
import {
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthMetadataRouter,
  requireBearerAuth,
} from '@modelcontextprotocol/express';
import type { AuthInfo } from '@modelcontextprotocol/server';

const mcpServerUrl = new URL('https://api.example.com/mcp');

const auth = requireBearerAuth({
  verifier: {
    verifyAccessToken: async (token) => {
      const payload = await verifyJwt(token);
      return { token, clientId: payload.sub, scopes: payload.scopes, expiresAt: payload.exp };
    },
  },
  requiredScopes: ['mcp'],
  resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpServerUrl),
});

app.all('/mcp', auth, (req, res) => void node(req, res, req.body));
app.use(mcpAuthMetadataRouter({ oauthMetadata, resourceServerUrl: mcpServerUrl }));
```

## Client-Side Authentication Flows

Client-side auth requires authorization headers in HTTP/SSE requests.

### A. End-user OAuth (authorization_code)

Browser login. Client handles OAuth flow, attaches token as Bearer header.

```ts
import {
  Client,
  StreamableHTTPClientTransport,
  UnauthorizedError,
  IssuerMismatchError,
} from '@modelcontextprotocol/client';

const transport = new StreamableHTTPClientTransport(url, { authProvider });
try {
  await client.connect(transport);
} catch (error) {
  if (!(error instanceof UnauthorizedError)) throw error;
  // SDK handles discovery and redirects user to authorization server
}

// Redirect callback:
const params = new URL(callbackUrl).searchParams;
if (params.get('state') !== authProvider.lastState) throw new Error('state mismatch');
try {
  await transport.finishAuth(params); // exchanges code, saves tokens
  await client.connect(new StreamableHTTPClientTransport(url, { authProvider }));
} catch (e) {
  if (e instanceof IssuerMismatchError) {
    throw new Error('Authorization server mismatch');
  }
  throw e;
}
```

> **`IssuerMismatchError`** signals an RFC 9207 `iss` mismatch (possible mix-up attack). Never render `error_description` to the user — it is attacker-controlled.

### B. Machine-to-machine (client_credentials)

Service-to-service auth, no user interaction. Service requests token and injects into transport headers.

```ts
import { ClientCredentialsProvider, PrivateKeyJwtProvider } from '@modelcontextprotocol/client';

// Client credentials (shared secret)
new ClientCredentialsProvider({ clientId, clientSecret, expectedIssuer });

// Signed JWT assertion (private_key_jwt)
new PrivateKeyJwtProvider({ clientId, privateKey, algorithm: 'RS256', jwtLifetimeSeconds: 300 });

// Custom minimal token provider
const authProvider = {
  token: () => getStoredToken(),
  onUnauthorized: (ctx) => refresh(),
};
```

> `expectedIssuer` pins the credential; if discovery resolves a different issuer, `AuthorizationServerMismatchError` is thrown.

### C. Cross-app access

For users authenticated in the host app. Exchanges host session for MCP access.

```ts
import {
  CrossAppAccessProvider,
  discoverAndRequestJwtAuthGrant,
} from '@modelcontextprotocol/client';

new CrossAppAccessProvider({
  assertion: async (ctx) => {
    const grant = await discoverAndRequestJwtAuthGrant({/* issuer/audience params */});
    return grant.jwtAuthGrant;
  },
  clientId,
  clientSecret,
});
```

### D. Custom `OAuthClientProvider` + Discovery

Custom provider when no prebuilt fits (e.g. browser app storing tokens). Implement:

```ts
import type {
  OAuthClientProvider,
  StoredOAuthClientInformation,
} from '@modelcontextprotocol/client';

const creds = new Map<string, StoredOAuthClientInformation>();

const authProvider: OAuthClientProvider & { lastState?: string } = {
  lastState: undefined,
  redirectUrl: 'https://app.example.com/callback',
  clientMetadata: {
    client_name: 'Example App',
    redirect_uris: ['https://app.example.com/callback'],
  },
  tokens: () => readFromSessionStorage('tokens'),
  saveTokens: (tokens) => writeToSessionStorage('tokens', tokens),
  clientInformation(ctx) {
    // SEP-2352: key credentials by issuer so a client_id from one AS is never sent to another
    if (!ctx) return undefined;
    return creds.get(ctx.issuer);
  },
  saveClientInformation(info, ctx) {
    if (ctx) creds.set(ctx.issuer, info);
  },
  codeVerifier: () => readFromSessionStorage('pkce_verifier'),
  saveCodeVerifier: (verifier) => writeToSessionStorage('pkce_verifier', verifier),
  state() {
    this.lastState = crypto.randomUUID();
    return this.lastState;
  },
  redirectToAuthorization(url) {
    window.location.href = url.toString();
  },
  saveDiscoveryState(state) {
    sessionStorage.setItem('mcp:discovery', JSON.stringify(state));
  },
  discoveryState() {
    const s = sessionStorage.getItem('mcp:discovery');
    return s ? JSON.parse(s) : undefined;
  },
};
```

> **SEP-2352:** Credentials must be keyed by `ctx.issuer` — a `client_id` registered with one AS must not be sent to another.

`auth()` orchestrator handles PKCE (`saveCodeVerifier` before redirect, verified on token exchange) and discovery: fetches `.well-known/oauth-protected-resource` (RFC 9728), follows issuer to `.well-known/oauth-authorization-server` (RFC 8414) via `discoverOAuthServerInfo`.

> **RFC 8707 resource pinning:** override `validateResourceURL(url, ctx)` on a custom `OAuthClientProvider` to pin the `resource` parameter on the token request, binding the access token to a specific resource server.

Dynamic Client Registration (`registerClient`) is deprecated (SEP-991). Prefer a **Client ID Metadata Document**: host `clientMetadata` at a stable HTTPS URL, pass that URL as `clientId`.

## Token Revocation

IdP revocation lets you invalidate compromised/expired tokens immediately instead of waiting for TTL:

> **Deprecated v1 Authorization Server helper.** `revocationHandler` is a v1 AS function frozen in `@modelcontextprotocol/server-legacy/auth`. An MCP Resource Server does not revoke tokens — that is the IdP's job. Shown only for legacy AS support.

```ts
import { revocationHandler } from '@modelcontextprotocol/server-legacy/auth';

app.post(
  '/revoke',
  revocationHandler({
    provider: { revokeToken: async (token) => idp.revoke(token) },
  }),
);
```

## Error Reference

- `UnauthorizedError` (client): HTTP 401 `invalid_token` — token missing/expired; re-run auth.
- `InsufficientScopeError` (client): HTTP 403 `insufficient_scope` — token valid but lacks required scopes.
- **`onInsufficientScope`** (client transport, SEP-2350): `'reauthorize'` (default) auto-steps-up scopes; `'throw'` raises `InsufficientScopeError`.

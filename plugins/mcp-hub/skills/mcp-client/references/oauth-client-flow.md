---
description: >-
  OAuth client flow for MCP clients — AuthProvider, OAuthClientProvider, end-user authorization_code, SEP-2352 issuer stamping, and the v2 OAuth error surface.
metadata:
  tags: [oauth, client, authentication, examples]
  source: internal
---

# OAuth Client Flow (TypeScript SDK v2)

Client-side auth for `@modelcontextprotocol/client`. Server-side verification lives in [mcp-auth](../../mcp-auth/SKILL.md); this covers the **client** side: getting tokens onto requests and handling the OAuth round-trips.

## The widened `authProvider` option

The transport `authProvider` option accepts `AuthProvider | OAuthClientProvider`.

### `AuthProvider` — static-token / non-OAuth bearer

A minimal interface for when you already hold a bearer token and there is no OAuth flow:

```ts
import type { AuthProvider } from '@modelcontextprotocol/client';

const authProvider: AuthProvider = {
  token: () => getStoredToken(), // called before every request
  onUnauthorized: (ctx) => refresh(), // called once on 401, then the transport retries
};

new StreamableHTTPClientTransport(url, { authProvider });
```

Transports call `token()` before every request and `onUnauthorized()` on 401 (then retry once). No OAuth discovery, no browser redirect.

### End-user OAuth (`authorization_code`)

`connect()` catches `UnauthorizedError` and triggers discovery + browser redirect; `finishAuth` runs on the **original** transport (a started transport cannot be restarted):

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
  // SDK ran discovery and redirected the user to the authorization server
}

// Redirect callback leg:
const params = new URL(callbackUrl).searchParams;
if (params.get('state') !== authProvider.lastState) throw new Error('state mismatch'); // validate state yourself
try {
  await transport.finishAuth(params); // exchanges the code, saves tokens — on the original transport
  await client.connect(new StreamableHTTPClientTransport(url, { authProvider })); // fresh transport for the real session
} catch (e) {
  if (e instanceof IssuerMismatchError) throw new Error('Authorization server mismatch');
  throw e;
}
```

> Validate `state` yourself before `finishAuth`. The SDK validates `iss` (RFC 9207) and throws `IssuerMismatchError` on a mismatch — never render the callback's `error*` values to the user (attacker-controlled).

## Issuer stamping (SEP-2352)

`auth()` stamps an `issuer` field onto every value it passes to `saveTokens()` / `saveClientInformation()` and threads `{ issuer }` as the `ctx` argument to those methods plus `tokens()` / `clientInformation()`. A stored value whose `issuer` names a different AS is treated as `undefined` and the flow re-registers / re-authorizes.

- **Round-trip the stored object verbatim** — single-slot storage works; a `saveTokens()` that rebuilds the object field-by-field and drops `issuer` defeats the per-AS check (every read logs an `[mcp-sdk]` warning).
- Key multi-AS storage on `ctx.issuer` (treat `ctx === undefined` as "return the most-recently-saved token set" — the per-request `Authorization: Bearer` read calls `tokens()` with no `ctx`).
- `PrivateKeyJwtProvider`, `StaticPrivateKeyJwtProvider`, `ClientCredentialsProvider`, and `CrossAppAccessProvider` take `expectedIssuer?: string` for per-AS pinning.

## OAuth error surface (v2)

The v1 `Invalid*Error` family and `OAUTH_ERRORS` are replaced by `OAuthError` + `OAuthErrorCode`. Switch `instanceof` to `error.code`:

```ts
import { OAuthError, OAuthErrorCode } from '@modelcontextprotocol/client';
if (error instanceof OAuthError && error.code === OAuthErrorCode.InvalidClient) {
  /* ... */
}
```

New / renamed client-flow errors:

- `IssuerMismatchError` — RFC 9207 `iss` mismatch on the callback leg (mix-up defense).
- `AuthorizationServerMismatchError` — credential pinned via `expectedIssuer` to a different AS.
- `RegistrationRejectedError` — Dynamic Client Registration rejected; carries `status` / `body` / `submittedMetadata`.
- `InsecureTokenEndpointError` — token endpoint not `https:` (loopback exempt — SEP-2207).
- `InsufficientScopeError` (transport, SEP-2350) — extends `OAuthClientFlowError`, **not** `OAuthError`. Distinct from `OAuthError(OAuthErrorCode.InsufficientScope)` thrown by verifiers.

## Step-up: `onInsufficientScope` / `maxStepUpRetries`

`StreamableHTTPClientTransport` accepts `onInsufficientScope: 'reauthorize' | 'throw'` (default `'reauthorize'`):

- `'reauthorize'` — re-authorize with the **union** of previously-requested and challenged scope; when that union strictly exceeds the current token's granted scope, the SDK forces a fresh authorization request.
- `'throw'` — raise `InsufficientScopeError` and do not re-authorize. Set this for `client_credentials` / m2m clients where re-authorization can't widen scope.

Step-up retries are hard-capped per send (`maxStepUpRetries`, default 1). With a non-OAuth `AuthProvider`, a `403 insufficient_scope` throws `InsufficientScopeError` instead of the previous `SdkHttpError(ClientHttpNotImplemented)`.

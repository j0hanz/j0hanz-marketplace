# Machine auth: no end user

A job, a backend, a service account authenticating to an MCP server. Every flow plugs into the same `authProvider` option on `StreamableHTTPClientTransport`. All symbols from `@modelcontextprotocol/client`.

## Client credentials

`ClientCredentialsProvider` runs the OAuth `client_credentials` grant from a `client_id` + `client_secret`. `connect()` discovers the server's AS, posts the grant, attaches the access token; on `401` the provider refreshes and the transport retries once. No browser.

```ts
const authProvider = new ClientCredentialsProvider({
  clientId: 'reporting-job',
  clientSecret: 'reporting-job-secret',
  expectedIssuer: 'https://auth.example.com',
});
const transport = new StreamableHTTPClientTransport(new URL('https://api.example.com/mcp'), {
  authProvider,
});
```

`expectedIssuer` is the issuer the credential was registered with. Discovery resolving a different issuer throws `AuthorizationServerMismatchError` **before the secret is sent**. Omitting it is deprecated — the credential then goes to whichever AS the server advertises. `PrivateKeyJwtProvider` and `CrossAppAccessProvider` take it too.

## Bring your own bearer token

Something outside the SDK owns the token (API key, gateway, platform secret store): implement `AuthProvider` with only `token()`.

```ts
const authProvider: AuthProvider = { token: async () => getStoredToken() };
```

Transport calls `token()` before every request. Without `onUnauthorized`, a `401` throws `UnauthorizedError`. Add `onUnauthorized(ctx)` to refresh the credential — the transport retries once.

## Private key JWT

`PrivateKeyJwtProvider` runs the same grant with a signed JWT assertion (`private_key_jwt`, RFC 7523) instead of a shared secret. `privateKey` takes a PEM string, `Uint8Array`, or JWK; a fresh assertion is signed per token request. `jwtLifetimeSeconds` overrides the 300s default; `claims` merges extras.

```ts
const authProvider = new PrivateKeyJwtProvider({
  clientId: 'reporting-job',
  privateKey: pemEncodedKey,
  algorithm: 'RS256',
  expectedIssuer: 'https://auth.example.com',
});
```

## Cross-app access (SEP-990)

A service acting for an enterprise user who already authenticated with the IdP, no second consent screen. Two exchanges: IdP ID Token → JWT Authorization Grant (RFC 8693), grant → MCP access token (RFC 7523). `CrossAppAccessProvider` runs the second; your `assertion` callback supplies the grant.

```ts
const authProvider = new CrossAppAccessProvider({
  assertion: async (ctx) => {
    const grant = await discoverAndRequestJwtAuthGrant({
      idpUrl: 'https://idp.example.com',
      audience: ctx.authorizationServerUrl, // pass ctx through: the grant must be
      resource: ctx.resourceUrl, // bound to the right audience/resource
      idToken: await getIdToken(),
      clientId: 'idp-exchange-client',
      clientSecret: 'idp-exchange-secret',
      scope: ctx.scope,
      fetchFn: ctx.fetchFn,
    });
    return grant.jwtAuthGrant;
  },
  clientId: 'reporting-job',
  clientSecret: 'reporting-job-secret',
  expectedIssuer: 'https://auth.example.com',
});
```

The SDK discovers the AS and resource URL before calling `assertion`, and hands them in on `ctx` with the negotiated scope and the transport's `fetchFn`.

## Token-exchange utilities

For flows the providers do not cover — caching grants across transports, non-standard IdP steps, your own token store:

- `requestJwtAuthorizationGrant` — ID Token → JWT Authorization Grant at a known IdP token endpoint (RFC 8693).
- `discoverAndRequestJwtAuthGrant` — same exchange, discovering the IdP token endpoint from `idpUrl` first.
- `exchangeJwtAuthGrant` — grant → access token at the MCP server's AS (RFC 7523).

All three live in `client/crossAppAccess` in the API reference.

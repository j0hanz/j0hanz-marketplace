# Client authentication

Use this reference for a static bearer token or browser `authorization_code`. For client credentials or host-session exchange, use [mcp-auth].

The transport accepts `AuthProvider | OAuthClientProvider`. For a static bearer token, provide `token()` and an `onUnauthorized()` refresh; the transport retries once after a 401:

```ts
const authProvider: AuthProvider = {
  token: () => getStoredToken(), // called before every request
  onUnauthorized: (ctx) => refresh(), // one 401 retry
};
new StreamableHTTPClientTransport(url, { authProvider });
```

For browser `authorization_code`, catch `UnauthorizedError` from `connect()` to begin discovery and redirect. Validate callback `state`, call `finishAuth()` on the original transport, then connect a fresh transport:

```ts
const transport = new StreamableHTTPClientTransport(url, { authProvider });
try {
  await client.connect(transport);
} catch (error) {
  if (!(error instanceof UnauthorizedError)) throw error;
  // The SDK discovered the authorization server and redirected the user.
}

const params = new URL(callbackUrl).searchParams;
if (params.get('state') !== authProvider.lastState) throw new Error('state mismatch');
try {
  await transport.finishAuth(params);
  await client.connect(new StreamableHTTPClientTransport(url, { authProvider }));
} catch (error) {
  if (error instanceof IssuerMismatchError) throw new Error('Authorization server mismatch');
  throw error;
}
```

The SDK validates callback `iss` (RFC 9207) and throws `IssuerMismatchError` on a mismatch. Treat callback `error` and `error_description` as attacker-controlled.

`auth()` stamps `issuer` on values passed to `saveTokens()` and `saveClientInformation()`, then supplies `{ issuer }` to those methods plus `tokens()` and `clientInformation()`. Store the objects intact and key multi-AS storage by `ctx.issuer`; a no-context `tokens()` call returns the most recently saved set for its per-request bearer read.

`InsufficientScopeError` (SEP-2350, extending `OAuthClientFlowError`) is a transport class distinct from the server verifier's `OAuthError(OAuthErrorCode.InsufficientScope)`; see [mcp-auth] “Handle authorization errors.” `onInsufficientScope` defaults to `'reauthorize'`, which requests the union of requested and challenged scope. For client-credentials clients, set `'throw'`; step-up retries default to one through `maxStepUpRetries`.

- [ ] Static credentials refresh once after 401, and browser callbacks validate `state` before `finishAuth()`.
- [ ] Stored issuer-stamped values remain intact and isolated per authorization server.
- [ ] Browser callback errors remain unrendered, and machine clients use `'throw'` for insufficient scope.

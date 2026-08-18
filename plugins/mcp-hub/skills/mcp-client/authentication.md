# Client authentication

Use this reference for a static bearer token or browser `authorization_code`. For client credentials or host-session exchange, use [mcp-auth](../mcp-auth/SKILL.md).

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

`saveTokens(tokens: OAuthTokens)` and `tokens()` take no `ctx`/issuer; store tokens as a single set and let the no-argument `tokens()` return the most recently saved one for per-request bearer reads. Only `clientInformation(ctx?)` and `saveClientInformation(info, ctx?)` accept an optional `OAuthClientInformationContext`, keyed by `ctx.issuer` so a `client_id` registered with one authorization server is never sent to another (SEP-2352).

`InsufficientScopeError` (SEP-2350, extending `OAuthClientFlowError`) is a transport class distinct from the server verifier's `OAuthError(OAuthErrorCode.InsufficientScope)`; see [mcp-auth](../mcp-auth/SKILL.md) “Handle authorization errors.” `onInsufficientScope` defaults to `'reauthorize'`, which requests the union of requested and challenged scope. For client-credentials clients, set `'throw'`; step-up retries default to one through `maxStepUpRetries`.

- [ ] Static credentials refresh once after 401, and browser callbacks validate `state` before `finishAuth()`.
- [ ] Client information stays isolated per authorization server (`ctx.issuer`), and tokens are stored as a single set.
- [ ] Browser callback errors remain unrendered, and machine clients use `'throw'` for insufficient scope.

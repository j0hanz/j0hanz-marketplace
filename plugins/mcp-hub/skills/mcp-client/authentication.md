# Client authentication

Use this for static bearer token or browser `authorization_code`. For client credentials or host-session exchange, use [mcp-auth](../mcp-auth/SKILL.md).

Transport accept `AuthProvider | OAuthClientProvider`. Static bearer token: give `token()` + `onUnauthorized()` refresh; transport retry once after 401:

```ts
const authProvider: AuthProvider = {
  token: () => getStoredToken(), // called before every request
  onUnauthorized: (ctx) => refresh(), // one 401 retry
};
new StreamableHTTPClientTransport(url, { authProvider });
```

Browser `authorization_code`: catch `UnauthorizedError` from `connect()`, begin discovery + redirect. Validate callback `state`, call `finishAuth()` on original transport, then connect fresh transport:

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

SDK validates callback `iss` (RFC 9207), throws `IssuerMismatchError` on mismatch. Treat callback `error` and `error_description` as attacker-controlled.

`saveTokens(tokens: OAuthTokens)` and `tokens()` take no `ctx`/issuer; store tokens as single set, no-arg `tokens()` return most recent for per-request bearer reads. Only `clientInformation(ctx?)` and `saveClientInformation(info, ctx?)` accept optional `OAuthClientInformationContext`, keyed by `ctx.issuer` — `client_id` registered with one authorization server never sent to another (SEP-2352).

`InsufficientScopeError` (SEP-2350, extends `OAuthClientFlowError`) is transport class, distinct from server verifier's `OAuthError(OAuthErrorCode.InsufficientScope)`; see [mcp-auth](../mcp-auth/SKILL.md) "Handle authorization errors." `onInsufficientScope` defaults `'reauthorize'` — requests union of requested + challenged scope. Client-credentials clients: set `'throw'`. Step-up retries default one, via `maxStepUpRetries`.

- [ ] Static credentials refresh once after 401, browser callbacks validate `state` before `finishAuth()`.
- [ ] Client information stays isolated per authorization server (`ctx.issuer`), tokens stored as single set.
- [ ] Browser callback errors stay unrendered, machine clients use `'throw'` for insufficient scope.

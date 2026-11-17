---
name: mcp-auth
description: Use when protecting an MCP server with OAuth (requireBearerAuth, bearer token verification, expectedResource, scopeChallenge, RFC 9728 protected resource metadata), signing a user in from an MCP client (OAuthClientProvider, authProvider, finishAuth, UnauthorizedError, IssuerMismatchError), authenticating without a user (ClientCredentialsProvider, PrivateKeyJwtProvider, CrossAppAccessProvider), or reviewing MCP auth code for contract violations or security holes.
---

# MCP auth

Two sides, one contract. The server is an OAuth **resource server**: it verifies access tokens an authorization server issued and never issues them. The client signs in through an `OAuthClientProvider` the SDK drives. Machine flows plug into the same client option — see [machine-auth.md](machine-auth.md).

## Server: the token gate

`requireBearerAuth` is the whole gate. Express: from `@modelcontextprotocol/express`, mounted in front of the `/mcp` route. Web-standard hosts (Workers, Deno, Bun, Hono): from `@modelcontextprotocol/server`, called as `await gate(request)` — resolves to the verified `AuthInfo` (pass on as `{ authInfo }`) or a ready-to-return challenge `Response`.

```ts
import {
  createMcpExpressApp,
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthMetadataRouter,
  requireBearerAuth,
} from '@modelcontextprotocol/express';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler } from '@modelcontextprotocol/server';

const mcpServerUrl = new URL('https://api.example.com/mcp');
const verifier: OAuthTokenVerifier = { verifyAccessToken };

const auth = requireBearerAuth({
  verifier,
  requiredScopes: ['mcp'],
  resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpServerUrl),
  expectedResource: mcpServerUrl,
});

const app = createMcpExpressApp({
  host: '0.0.0.0',
  allowedHosts: ['api.example.com'],
});
const node = toNodeHandler(createMcpHandler(buildServer));
app.all('/mcp', auth, (req, res) => void node(req, res, req.body));
```

`node(req, res, req.body)` with the third argument is the documented Express pattern — do not flag it in review.

- Missing, malformed, or expired token: `401` with OAuth error `invalid_token`.
- Valid token missing a `requiredScopes` entry: `403` with `insufficient_scope`.
- Both carry a `WWW-Authenticate: Bearer` challenge whose `resource_metadata` parameter comes from `resourceMetadataUrl` — that challenge is what starts a client's OAuth flow. Configure the metadata URL exactly once, here.
- v1 Authorization Server helpers (`mcpAuthRouter`, `ProxyOAuthServerProvider`) are frozen in `@modelcontextprotocol/server-legacy/auth` — never for new servers.
- Host/Origin (DNS rebinding) validation is separate — see `mcp-transport`.

## Server: the verifier contract

`verifyAccessToken(token)` returns an `AuthInfo`. Reject a token by throwing `OAuthError` with `OAuthErrorCode.InvalidToken` (both from `@modelcontextprotocol/server`) — the gate turns it into the `401` challenge. Any other exception becomes `500 server_error`.

```ts
async function verifyAccessToken(token: string): Promise<AuthInfo> {
  const payload = await verifyJwt(token);
  // aud is one value, a list, or absent: report this server's entry, if any
  const audience = [payload.aud ?? []]
    .flat()
    .find((aud) => URL.canParse(aud) && new URL(aud).origin === mcpServerUrl.origin);
  return {
    token,
    clientId: payload.sub,
    scopes: payload.scopes,
    expiresAt: payload.exp, // unset => gate 401s every token
    resource: audience ? new URL(audience) : undefined,
  };
}
```

- **Always populate `expiresAt`** (JWT `exp` or introspection `exp`). The gate answers `401 invalid_token` for a token whose `expiresAt` is unset — a verifier that omits it rejects every caller.
- `expectedResource` binds tokens to this server: the gate accepts a token only if the verifier reports that value in `AuthInfo.resource` (one trailing slash aside). Populate `resource` from the JWT `aud` claim; leave it unset when `aud` has no entry for this origin.
- `requiredScopes` on the gate is all-of and endpoint-wide.
- Express: `@modelcontextprotocol/express` 2.0.1 does not pass `expectedResource` on, so nothing is compared. Require `@modelcontextprotocol/express` ≥ 2.0.2 and upgrade it together with `@modelcontextprotocol/server`.

## Server: read the caller, step up per operation

Tool handlers read the verified caller as `ctx.http?.authInfo` — the exact object the verifier returned. `ctx.http` is `undefined` over stdio; guard the read if the server serves both transports. The per-request factory receives the same value as `ctx.authInfo` and can register a different tool set per caller.

Per-operation scope step-up: `scopeChallenge` on any tool, resource, or prompt registration. `undefined` continues; a returned scope set sends `403 insufficient_scope` before invocation. Throwing or rejecting fails closed.

```ts
import { requireScopes } from '@modelcontextprotocol/server';

server.registerTool('purge-notes', { scopeChallenge: requireScopes('notes:write') }, async () => ({
  content: [{ type: 'text', text: 'All notes deleted' }],
}));
```

- `requireScopes(...)` = static all-of check. A callback `({ request, authInfo }) => ...` when the required set depends on the request.
- Do scope enforcement **here**, not inside handler bodies — an in-handler check returns an `isError` result to the model instead of a `403`, and the model retries instead of the user re-consenting.
- The callback runs **before** input-schema validation: `request` carries raw JSON-parsed wire values. Validate any value whose meaning the schema transforms. Scope names follow the `scope-token` grammar; `errorDescription` follows RFC 6750 `error-description`.
- Challenged primitives stay visible in their list operations.

## Server: publish protected resource metadata

The `401` challenge points at an RFC 9728 document. Serve it, or the client flow dies before it starts:

```ts
app.use(mcpAuthMetadataRouter({ oauthMetadata, resourceServerUrl: mcpServerUrl }));
```

Mounts `/.well-known/oauth-protected-resource/mcp` (the string `getOAuthProtectedResourceMetadataUrl` put into the challenge) and `/.well-known/oauth-authorization-server` (a mirror of the AS's own RFC 8414 metadata). Web-standard host: `oauthMetadataResponse(request, { oauthMetadata, resourceServerUrl })` returns the matched `Response` or `undefined` to fall through.

## Client: sign a user in

Pass an `OAuthClientProvider` as the transport's `authProvider` — everything on this half comes from `@modelcontextprotocol/client`:

```ts
const transport = new StreamableHTTPClientTransport(mcpServerUrl, {
  authProvider: provider,
});
try {
  await client.connect(transport);
} catch (error) {
  if (!(error instanceof UnauthorizedError)) throw error;
  // SDK ran discovery, registered the client, called provider.redirectToAuthorization(url);
  // the user is in the browser at the authorization server.
}
```

Provider methods — the SDK drives, your code stores and redirects:

| Member                                                        | Job                                                                                                                        |
| :------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------- |
| `redirectUrl`, `clientMetadata`                               | Callback URI and RFC 7591 registration metadata                                                                            |
| `clientInformation(ctx)` / `saveClientInformation(info, ctx)` | Client credentials **keyed by `ctx.issuer`** — a `client_id` from one AS must never reach another                          |
| `tokens()` / `saveTokens(tokens)`                             | Persist to OS keychain / secure storage, never plain files; durable storage skips the browser round trip                   |
| `state()`                                                     | CSRF binding the SDK puts on the authorize URL — **the SDK does not validate it on callback; you compare it**              |
| `saveCodeVerifier(v)` / `codeVerifier()`                      | PKCE verifier across the redirect                                                                                          |
| `saveDiscoveryState(s)` / `discoveryState()`                  | AS-binding of the callback leg so the code is exchanged at the same AS                                                     |
| `redirectToAuthorization(url)`                                | Open the browser                                                                                                           |
| `scopeForRefresh(tokens)`                                     | Only for ASes that reject a scope-less refresh (e.g. Entra ID `AADSTS90009`) — otherwise omit; the wrong AS breaks refresh |

Callback, in order:

```ts
const params = new URL(callbackUrl).searchParams;
// lastState: your provider's own field, set when state() generated the value
if (params.get('state') !== provider.lastState) throw new Error('state mismatch'); // YOU check this
await transport.finishAuth(params); // whole query, not finishAuth(code)
await client.connect(
  // FRESH transport — a started one cannot restart
  new StreamableHTTPClientTransport(url, { authProvider: provider }),
);
```

- `finishAuth(params)` extracts `code`, validates the RFC 9207 `iss` parameter, exchanges the code at the AS discovery resolved, saves tokens through the provider. A positional `finishAuth(code, iss)` that drops `iss` is rejected when the AS advertises RFC 9207 — pass the `URLSearchParams`.
- OAuth state (tokens, verifier, discovery) lives on the **provider**, so the fresh transport loses nothing.
- A callback from the wrong AS throws `IssuerMismatchError` — a mix-up attack. The callback's `error` and `error_description` are attacker-controlled: never render them; show a generic failure.
- `skipOfflineAccessConsentPrompt` omits the `prompt=consent` the SDK adds for `offline_access` when consent was granted out of band (e.g. Entra ID admin consent).
- `validateResourceURL(serverUrl, resource?)` overrides the RFC 8707 `resource` parameter sent on every leg — return the pinned URL or `undefined` to omit; `checkResourceAllowed` and `resourceUrlFromServerUrl` are exported for it.

## Common mistakes

| Mistake                                                           | Reality                                                                                      |
| :---------------------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| MCP server issues tokens                                          | Server is a resource server only; a dedicated AS issues                                      |
| `audience` option on the gate                                     | The option is `expectedResource`; the verifier reports `resource` from `aud`                 |
| Scope check inside tool handler body                              | `scopeChallenge: requireScopes(...)` sends proper `403 insufficient_scope` before invocation |
| `extra.authInfo` in handlers (v1 path)                            | v2 is `ctx.http?.authInfo`; `undefined` over stdio                                           |
| `{ auth: provider }` on the transport (v1)                        | v2 option is `authProvider`                                                                  |
| `finishAuth(code)` positional                                     | Pass the whole `URLSearchParams`; dropped `iss` is rejected under RFC 9207                   |
| Rendering callback `error_description`                            | Attacker-controlled; `IssuerMismatchError` means mix-up attack — show a generic failure      |
| Client credentials stored globally                                | Key by `ctx.issuer`; cross-AS leakage is a mix-up vector                                     |
| Tokens in plain files                                             | OS keychain / secure storage                                                                 |
| Gate wiring as `createMcpHandler(server, { middleware: [auth] })` | Express middleware in front of the route; web-standard: `await gate(request)`                |

## Review checklist

- [ ] `requireBearerAuth` configured with `verifier`, `requiredScopes`, `resourceMetadataUrl`, `expectedResource` (Express: `@modelcontextprotocol/express` ≥ 2.0.2)
- [ ] Verifier populates `expiresAt` and `resource` (from `aud`); rejects via `OAuthError(InvalidToken)`
- [ ] `mcpAuthMetadataRouter` / `oauthMetadataResponse` actually mounted — challenge URL resolves
- [ ] Per-operation scopes via `scopeChallenge`, callback validates raw wire values itself
- [ ] Handlers read `ctx.http?.authInfo` with a stdio guard
- [ ] Provider: credentials keyed by `ctx.issuer`; tokens in secure storage; `state()` random per flow
- [ ] Callback compares `state` before anything; passes whole query to `finishAuth`
- [ ] `IssuerMismatchError` handled without rendering `error` / `error_description`
- [ ] No v1 helpers (`mcpAuthRouter`, `ProxyOAuthServerProvider`) on new servers
- [ ] Host/Origin validation present (see `mcp-transport`) — the token gate does not replace it

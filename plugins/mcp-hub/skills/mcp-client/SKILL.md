---
name: mcp-client
description: Use when building MCP SDK v2 clients — connecting, calling tools/resources/prompts, subscribing, caching, middleware, or browser authorization_code auth; for service credentials see [mcp-auth], for custom transports see [mcp-protocol].
user-invocable: false
metadata:
  category: technique
---

# Building MCP Clients (MCP SDK v2)

Covers `@modelcontextprotocol/client` `2.0.0-beta.3`.

## Steps

1. **Configure ESM**: Standardize to ESM-only (`"type": "module"` in `package.json`, `"NodeNext"` resolutions in `tsconfig.json`). v2 ships CJS too — `require()` resolves natively.

   - [ ] ESM-only config is active in `tsconfig.json` (or CJS `require` resolves natively).

2. **Initialize Client**: `new Client({...})`, declaring capacities up front in the constructor — **elicitation is mandatory**; sampling (`createMessage`) and roots (`roots/list`) are deprecated per SEP-2577, so declare them only if you need legacy support. Pass paths via tool arguments / resource URIs / host config instead of roots.

   ```ts
   import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

   const client = new Client(
     { name: 'my-client', version: '1.0.0' },
     {
       capabilities: {
         elicitation: { form: {}, url: {} },
         sampling: {}, // deprecated — declare only if you need legacy sampling
       },
       versionNegotiation: { mode: 'auto' },
       listChanged: { tools: { onChanged } },
       inputRequired: { maxRounds: 10, autoFulfill: true },
       listMaxPages: 64,
       responseCacheStore,
       cachePartition,
       defaultCacheTtlMs,
     },
   );
   ```

   - [ ] Client declares capacities (elicitation mandatory; sampling/roots only if used) in the constructor BEFORE registering handlers.

3. **Pick Transport & Connect**: Choose by server transport, then `await client.connect(transport)`:

   ```ts
   await client.connect(new StreamableHTTPClientTransport(new URL('http://localhost:3000/mcp')));
   ```

   - **Streamable HTTP** (default): `StreamableHTTPClientTransport`.
   - **stdio**: `StdioClientTransport` from the `@modelcontextprotocol/client/stdio` subpath.
   - **SSE-only legacy server**: `SSEClientTransport` — only after StreamableHTTP fails; SSE is a fallback, not a first choice.
   - **Negotiation footgun**: For spawn-per-invocation stdio CLI wrappers, pin the era with `versionNegotiation: { mode: { pin: '2026-07-28' } }` (modern-only) or `{ mode: 'legacy' }` — **never `{ mode: 'auto' }`**, which stalls on cold spawns. `{ mode: 'auto' }` is fine for long-lived connections.

   - [ ] Negotiation mode matches connection lifetime per Step 3 (`'auto'` only for long-lived connections).

4. **Register Hook Interceptors**: After `connect`, register `sampling/createMessage` / `roots/list` handlers only if you declared those deprecated capacities in Step 2; for the elicitation/create handler, see [mcp-elicitation] "Client: register the handler first".

5. **Manage Calls**: Call tools with `.callTool()` (no-arg `listTools()`/`listPrompts()`/`listResources()` auto-aggregate pages; pass `{ cursor }` for one page); check execution status on the `result.isError` payload — do **not** catch standard tool exceptions as business failures; unknown/disabled tool names reject the promise with `ProtocolError(InvalidParams)` — catch that separately from `isError: true` business failures (see [mcp-server] "Handle Errors").

   ```ts
   const { tools } = await client.listTools();
   const result = await client.callTool({ name: 'lookup-order', arguments: { id: 'A-1041' } });
   // result.isError: true if the tool failed — check before using result.content
   // result.structuredContent: present only if the tool declared an outputSchema
   // narrow with isCallToolResult(result) / isSpecType.X(result) — never the `in` operator (passthrough objects satisfy every member)

   const { resources } = await client.listResources();
   const { resourceTemplates } = await client.listResourceTemplates();
   const { contents } = await client.readResource({ uri: 'orders://recent' });

   const { prompts } = await client.listPrompts();
   const prompt = await client.getPrompt({ name: 'summarize-order', arguments: { id: 'A-1041' } });
   // prompt.messages — ready to send to a model

   const { completion } = await client.complete({
     ref: { type: 'ref/prompt', name: 'summarize-order' }, // or { type: 'ref/resource', uri: '...' }
     argument: { name: 'tone', value: 'f' },
   });
   ```

   - [ ] Success checks read `result.isError` directly instead of catching exceptions for standard tool responses; unknown/disabled tool names are caught as `ProtocolError(InvalidParams)`, handled separately.

6. **Graceful Terminate**: On every shutdown **and** error path, tear down cleanly to avoid dangling connections. Over **Streamable HTTP**, run `await transport.terminateSession()` (a no-op when the server issued no session ID) then `await client.close()`. Over **stdio** or in-memory, `await client.close()` alone is the whole teardown — there is no server-side session to terminate.

   - [ ] Sessions terminate gracefully on shutdown AND error paths: Streamable HTTP runs `terminateSession()` + `close()`; stdio/in-memory run `close()` alone.

## Optional Capabilities

### Authenticate the client

The transport `authProvider` option accepts `AuthProvider | OAuthClientProvider`. Pick by trust model:

- **Static bearer token, no OAuth flow** → minimal `AuthProvider`:

  ```ts
  const authProvider: AuthProvider = {
    token: () => getStoredToken(), // called before every request
    onUnauthorized: (ctx) => refresh(), // called once on 401, then the transport retries once
  };
  new StreamableHTTPClientTransport(url, { authProvider });
  ```

- **User present in a browser (`authorization_code`)** → `connect()` catches `UnauthorizedError` and triggers discovery + redirect; `finishAuth` runs on the **original** transport (a started transport can't be restarted):

  ```ts
  const transport = new StreamableHTTPClientTransport(url, { authProvider });
  try {
    await client.connect(transport);
  } catch (error) {
    if (!(error instanceof UnauthorizedError)) throw error;
    // SDK ran discovery and redirected the user to the authorization server
  }

  // Redirect callback leg:
  const params = new URL(callbackUrl).searchParams;
  if (params.get('state') !== authProvider.lastState) throw new Error('state mismatch'); // validate yourself
  try {
    await transport.finishAuth(params); // exchanges the code, saves tokens — on the original transport
    await client.connect(new StreamableHTTPClientTransport(url, { authProvider })); // fresh transport
  } catch (e) {
    if (e instanceof IssuerMismatchError) throw new Error('Authorization server mismatch');
    throw e;
  }
  ```

  > The SDK validates `iss` (RFC 9207) and throws `IssuerMismatchError` on mismatch. Never render the callback's `error`/`error_description` to the user — attacker-controlled.

- **Service-to-service or host-session exchange** → `ClientCredentialsProvider`, `PrivateKeyJwtProvider`, or `CrossAppAccessProvider` (all take `expectedIssuer?: string` — a mismatched discovery result throws `AuthorizationServerMismatchError`) — see [mcp-auth].

**Issuer stamping (SEP-2352)**: `auth()` stamps `issuer` onto every value passed to `saveTokens()`/`saveClientInformation()` and threads `{ issuer }` as `ctx` to those plus `tokens()`/`clientInformation()`. Round-trip the stored object verbatim — rebuilding it field-by-field and dropping `issuer` defeats the per-AS check. Key multi-AS storage on `ctx.issuer` (treat `ctx === undefined` as "return the most-recently-saved set" — the per-request `Authorization: Bearer` read calls `tokens()` with no `ctx`).

**Errors**: OAuth error classes: see [mcp-auth] "Error Reference". `InsufficientScopeError` (SEP-2350, extends `OAuthClientFlowError`) is a distinct **transport** class from `OAuthError(OAuthErrorCode.InsufficientScope)` thrown by server verifiers. `StreamableHTTPClientTransport`'s `onInsufficientScope` defaults to `'reauthorize'` (re-authorizes with the union of requested + challenged scope); set `'throw'` for `client_credentials`/m2m clients, where re-authorization can't widen scope. Step-up retries are capped by `maxStepUpRetries` (default 1).

### Subscribe to changes

On `2026-07-28`, change notifications arrive via `subscriptions/listen`:

```ts
client.setNotificationHandler('notifications/tools/list_changed', async () => {
  const { tools } = await client.listTools();
});

const subscription = await client.listen({
  toolsListChanged: true, // + promptsListChanged, resourcesListChanged
  resourceSubscriptions: ['config://app'],
});
await subscription.close();
const reason = await subscription.closed; // 'local' | 'graceful' | 'remote' — never rejects
```

The constructor's `listChanged` option (Step 2) opens the stream and re-fetches automatically — manual `setNotificationHandler` calls override it. Pre-2026-07-28 servers fall back to `subscribeResource`/`unsubscribeResource`; calling the wrong style for the server's era throws `METHOD_NOT_SUPPORTED_BY_PROTOCOL_VERSION`.

### Cache responses

Server freshness hints (SEP-2549) let cacheable calls (`listTools`, `listPrompts`, `listResources`, `listResourceTemplates`, `readResource`) serve from a local cache:

```ts
await client.listTools(); // network, cached
await client.listTools(); // served from cache
await client.listTools(undefined, { cacheMode: 'refresh' }); // refetch and re-store
await client.readResource({ uri }, { cacheMode: 'bypass' });
```

`ttlMs` caps at 24h (`MAX_CACHE_TTL_MS`); `responseCacheStore` swaps storage (default `InMemoryResponseCacheStore`, max 512 entries); `defaultCacheTtlMs` sets a default for servers without hints; change notifications auto-evict matching entries. **`cachePartition` is required whenever one store serves multiple users** — `'private'` entries must never cross partitions.

### Add HTTP middleware

Wrap the transport's `fetch` to inject headers, log, or retry:

```ts
import { applyMiddlewares, createMiddleware, withLogging } from '@modelcontextprotocol/client';

const tagRequests = createMiddleware(async (next, input, init) => {
  const headers = new Headers(init?.headers);
  headers.set('X-Request-Source', 'reports-cli');
  return next(input, { ...init, headers });
});

const transport = new StreamableHTTPClientTransport(url, {
  fetch: applyMiddlewares(tagRequests, withLogging({ statusLevel: 400 }))(fetch),
});
```

The last middleware passed to `applyMiddlewares` is outermost (sees the request first, the response last) — put retries first instead, closest to the network. Middleware must return a `Response` (`response.clone()` to read the body). Pass `withLogging()` a custom `logger` to keep stdout clean on stdio transports.

## Completion Criteria

To consider a client implementation complete, you must verify:

- [ ] ESM-only config is active in `tsconfig.json` (or CJS `require` resolves natively).
- [ ] Negotiation mode matches connection lifetime per Step 3 (`'auto'` only for long-lived connections).
- [ ] Client declares capacities (elicitation mandatory; sampling/roots only if used) in the constructor BEFORE registering handlers.
- [ ] Success checks read `result.isError` directly instead of catching exceptions for standard tool responses; unknown/disabled tool names are caught as `ProtocolError(InvalidParams)`, handled separately.
- [ ] Sessions terminate gracefully on shutdown AND error paths: Streamable HTTP runs `terminateSession()` + `close()`; stdio/in-memory run `close()` alone.
- [ ] Multi-user response caches set `cachePartition` so `'private'` entries never cross user/tenant boundaries.
- [ ] If OAuth is used: stored tokens/client info round-trip verbatim and are keyed by `ctx.issuer` (SEP-2352); the callback `state` is validated before `finishAuth`; `error`/`error_description` values are never rendered to the user.
- [ ] If subscribed, `subscription.close()` runs on every shutdown path (mirrors Step 6's transport teardown) so no listener is left dangling.
- [ ] Middleware order matches the network-proximity rule: retries sit innermost (closest to the network), logging/tagging outermost.

## See Also

- Error code lookups: [mcp-test]; live diagnosis: dispatch the mcp-debugger agent.
- Server-side token verification: [mcp-auth]
- SDK docs: https://ts.sdk.modelcontextprotocol.io/v2/

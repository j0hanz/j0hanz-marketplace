---
name: mcp-transport
description: Use when wiring, migrating, or reviewing how an MCP server or client built on the TypeScript SDK v2 talks over the wire - stdio, Streamable HTTP, legacy HTTP+SSE, or a custom Transport. Covers serveStdio, createMcpHandler, toNodeHandler, StdioClientTransport, StreamableHTTPClientTransport, SSEClientTransport, versionNegotiation, 2025-era vs 2026-07-28 clients, Mcp-Session-Id sessions, isLegacyRequest, Host/Origin (DNS rebinding) guards, multi-node notifications, and in-process transport tests.
---

# MCP Transport (TypeScript SDK v2)

A transport moves JSON-RPC messages; it never decides what the server does. In v2 the **entry point** owns the transport: hand it a **factory** that builds a fresh `McpServer`, and the entry decides the connection's **era**.

- An **era** is a behaviour family, not a version string. `legacy` covers `2024-10-07` through `2025-11-25`: the `initialize` handshake, sessions, unsolicited notifications. `modern` starts at `2026-07-28`: `server/discover`, a per-request `_meta` envelope, no sessions, and notifications only on a `subscriptions/listen` stream.
- Only the v2 entries (`serveStdio`, `createMcpHandler`) serve the modern era. Any hand-wired `*StreamableHTTPServerTransport` or `server.connect(new StdioServerTransport())` serves **legacy only**, and a modern or pinned client cannot reach it.

Docs root: `https://ts.sdk.modelcontextprotocol.io/v2/`. Every page is also served as `.md`. Era differences live only on `protocol-versions.md`: link there instead of restating them.

## 1. Pick the entry

| Situation                           | Server entry                                                    | Client transport                                                 |
| :---------------------------------- | :-------------------------------------------------------------- | :--------------------------------------------------------------- |
| Host spawns server as child process | `serveStdio(factory)` from `@modelcontextprotocol/server/stdio` | `StdioClientTransport` from `@modelcontextprotocol/client/stdio` |
| One endpoint, many remote clients   | `createMcpHandler(factory)` from `@modelcontextprotocol/server` | `StreamableHTTPClientTransport`                                  |
| Server only speaks old HTTP+SSE     | frozen `@modelcontextprotocol/server-legacy/sse` (bridge only)  | `SSEClientTransport` (fallback)                                  |
| Same process: tests, embedding      | `handler.fetch` as the client's `fetch`                         | `StreamableHTTPClientTransport` + `fetch` option                 |
| Channel SDK does not ship (WS, IPC) | custom `Transport` (section 8)                                  | same class                                                       |

WebSocket is not a spec transport, and v2 removed `WebSocketClientTransport`. Only peers using your exact class interoperate, so for remote reach pick Streamable HTTP first.

Need stdio and HTTP from one codebase? Share the factory and choose the entry with a flag or a separate bin. A stdio host spawns one process per client; if each process also listened on a port, the second would fail with `EADDRINUSE`.

## 2. Write the factory

```ts
import { McpServer } from '@modelcontextprotocol/server';

const pool = createPool(); // module scope: pools, caches, stores - built once

export function buildServer() {
  const server = new McpServer({ name: 'notes', version: '1.0.0' });
  server.registerTool(/* ... closes over pool ... */);
  return server; // a NEW instance every call
}
```

- The factory runs once per HTTP request, once per stdio connection, and sometimes for a probe instance the entry throws away. A factory that returns a shared pre-built instance gets connected twice and breaks. Register everything **inside** the factory.
- Keep the factory cheap and free of side effects. Shared state lives at module scope or in a real store; the instance holds nothing between requests.
- Over HTTP the factory receives `{ era, authInfo, requestInfo }` and can build per-caller instances from `authInfo`.

## 3. Serve stdio

```ts
const handle = serveStdio(buildServer); // legacy: 'serve' default; 'reject' = modern only
process.on('SIGINT', () => void handle.close());
```

- **stdout is the protocol channel.** Log with `console.error`. One `console.log` writes a line no JSON-RPC parser accepts. The same goes for any library logger, including the client `withLogging()` default.
- stdin EOF tears the connection down and aborts in-flight requests. Release keep-alive handles (timers, pools, watchers) in `server.server.onclose` so the process can exit.
- Test by hand with `npx @modelcontextprotocol/inspector node ./build/server.js`.

## 4. Serve HTTP and guard its edge

`createMcpHandler(factory, opts)` returns `{ fetch, close, notify, bus }`. **The handler trusts its caller**: it validates no `Host` header, no `Origin` header, and no token. Every mount puts those checks in front:

| Runtime                  | Mount                                                                                           | Host/Origin guard                                                                                                                                             |
| :----------------------- | :---------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Express / Hono / Fastify | `createMcpExpressApp()` (etc.) + `toNodeHandler(handler)`; Express passes `req.body` as 3rd arg | built in on localhost binds; on `0.0.0.0` pass `allowedHosts` (and `allowedOrigins`)                                                                          |
| plain `node:http`        | `toNodeHandler(handler)`, `.listen(port, '127.0.0.1')`                                          | `localhostHostValidation()` / `localhostOriginValidation()`, or `hostHeaderValidation(hosts)` / `originValidation(origins)` from `@modelcontextprotocol/node` |
| Workers / Deno / Bun     | `export default handler`                                                                        | wrap `fetch`: `hostHeaderValidationResponse(req, hosts) ?? originValidationResponse(req, origins) ?? handler.fetch(req)`                                      |

- Bind loopback unless remote clients need the port. Binding `0.0.0.0` drops the default DNS-rebinding protection, so list public hostnames explicitly and require auth.
- **Auth is pass-through.** Verify the bearer token in front (`requireBearerAuth({ verifier })` from `@modelcontextprotocol/express`, or your own check), then hand the result over with `handler.fetch(request, { authInfo })`. Under Node frameworks, `toNodeHandler` forwards `req.auth`. Tools read it as `ctx.http.authInfo`, the factory as `authInfo`. A check that only gates the request leaves handlers blind to the caller. See `mcp-auth` for the verifier.
- `responseMode`: the default answers JSON and upgrades to SSE only when a handler emits a notification before its result. `'json'` silently drops progress and log notifications. `subscriptions/listen` always streams.
- SSE heartbeat: `keepAliveMs` (default 15 s, `0` disables). It fixes `SSE stream disconnected: TypeError: terminated` behind idle-timeout proxies.

## 5. Legacy branch: only when 2025-era clients or v1 code exist

Pick the posture first:

| Need                                         | Do                                                                                                          |
| :------------------------------------------- | :---------------------------------------------------------------------------------------------------------- |
| Serve 2025 clients, no sessions needed       | Nothing. `createMcpHandler` defaults to `legacy: 'stateless'`; legacy `GET`/`DELETE` answer `405`           |
| Modern only                                  | `createMcpHandler(f, { legacy: 'reject' })` / `serveStdio(f, { legacy: 'reject' })`                         |
| Keep existing **sessionful** 2025 deployment | Route with `isLegacyRequest` in front of a strict handler (below)                                           |
| Clients that only speak HTTP+SSE             | Frozen `SSEServerTransport` from `@modelcontextprotocol/server-legacy/sse` on `GET /sse` + `POST /messages` |

```ts
import { createMcpHandler, isLegacyRequest } from '@modelcontextprotocol/server';
import { toWebRequest } from '@modelcontextprotocol/node';

const modern = createMcpHandler(buildServer, { legacy: 'reject' });

app.all('/mcp', async (req, res) => {
  // both helpers are async; pass the parsed body because express.json() drained the stream
  if (await isLegacyRequest(await toWebRequest(req, req.body), req.body))
    return legacySessionRoute(req, res); // existing sessions map
  return modernNode(req, res, req.body); // const modernNode = toNodeHandler(modern)
});
```

- **Never classify the era yourself.** "Has `Mcp-Session-Id`, or is `initialize`" misses cases and drifts from the SDK. `isLegacyRequest` is the entry's own classifier. Send every `false` to the strict handler, which owns the error answers for malformed modern requests.
- The legacy leg keeps the v1 pattern on `NodeStreamableHTTPServerTransport` (web runtimes use `WebStandardStreamableHTTPServerTransport`): a map of transports keyed by `Mcp-Session-Id`, built on `initialize` and stored in `onsessioninitialized`. It needs `404` for an unknown id (the client re-initializes), `400` for a missing id, an idle sweep that counts open responses as activity (otherwise a quiet `GET` notification stream gets reaped), a `MAX_SESSIONS` cap answering `503`, and every transport closed on shutdown. Full route: `serving/sessions-state-scaling.md`.
- Do not keep v1 `@modelcontextprotocol/sdk` around to borrow its SSE transport, and do not cast it with `as never`. The frozen copy in `server-legacy` exists for exactly this; it is deprecated, with removal planned in v3. Mount it with `createMcpExpressApp({ host, allowedHosts, jsonLimit: '4mb' })`.
- Migrating from v1? Run `npx @modelcontextprotocol/codemod@latest v1-to-v2 .` first, then `grep -rn '@mcp-codemod-error' .`. The codemod renames transports but leaves you on the legacy era. Moving the entry to `serveStdio` / `createMcpHandler` is the manual step that turns on 2026-07-28.

## 6. Connect a client

```ts
const client = new Client(
  { name: 'app', version: '1.0.0' },
  { versionNegotiation: { mode: 'auto' } },
);
await client.connect(new StreamableHTTPClientTransport(new URL(url)));
client.getProtocolEra(); // 'modern' | 'legacy'
```

Choose `versionNegotiation.mode` by client lifetime:

| Client                                 | Mode                                                                                      |
| :------------------------------------- | :---------------------------------------------------------------------------------------- |
| Long-lived host or agent               | `'auto'`: probes `server/discover`, falls back to `initialize`                            |
| Spawn-per-invocation CLI or debug tool | default (`'legacy'`), with `'auto'`/pin as explicit flag, or `'auto'` plus cached `prior` |
| Gateway or worker fleet                | probe once, then `connect(t, { prior: { kind: 'modern', discover } })`                    |
| Legacy is unacceptable                 | `{ pin: '2026-07-28' }`; never falls back, rejects `ERA_NEGOTIATION_FAILED`               |

- Why not `'auto'` on a CLI: on stdio the probe spawns an extra sibling process on every connect, and a legacy server that ignores unknown requests stalls `connect()` for the full probe timeout.
- Cached verdicts: key them on the auth context (credential hash) and date them. A stale **modern** verdict fails loudly; a stale **legacy** verdict succeeds silently forever, so expire it.
- **SSE fallback:** try Streamable HTTP; on failure, retry with `SSEClientTransport` on a **fresh** `Client`. Fall back only on a non-auth 4xx (for example `404`/`405`). A 401/403 is an auth wall: `SdkHttpError` with `ClientHttpAuthentication` / `ClientHttpForbidden`, or `InsufficientScopeError`. 5xx, timeouts and network errors are outages. None of these is transport or era evidence.
- **stdio child env:** `StdioClientTransport` passes only `getDefaultEnvironment()` by default. Add the keys the server needs: `env: { ...getDefaultEnvironment(), API_KEY }`. Never pass `process.env`; it leaks every secret to the child. On Windows, spawn `npx.cmd`, not `npx`.
- **Teardown:** on Streamable HTTP, call `await transport.terminateSession()` (a no-op without a session id), then `client.close()`. Stdio `close()` closes stdin, then sends SIGTERM, then SIGKILL. In-flight requests reject with `CONNECTION_CLOSED`.
- Gate calls on `getServerCapabilities()`. Put `getInstructions()` in the model's system prompt.
- Wrong-era calls fail locally with `METHOD_NOT_SUPPORTED_BY_PROTOCOL_VERSION`. For example, `listen()` is modern-only, and `subscribeResource()`/`ping()` are legacy-only.

## 7. State, scaling, shutdown

- The stateless default **is** the scaling story: N nodes behind any load balancer, no affinity.
- **Change notifications across nodes:** the default `ServerEventBus` is in-process, so `handler.notify.toolsChanged()` on node A never reaches a `subscriptions/listen` stream held by node B. Implement the bus over your pub/sub and give the **same** one to every node: `createMcpHandler(f, { bus })`. Its shape is `publish(event): void` plus `subscribe(listener): () => void`. Do not hand-roll a channel that calls `notify` per node; the bus is the seam. Tool definitions that change at runtime must also live in a shared store the factory reads.
- **Legacy resumability:** an `eventStore` (`storeEvent`, `replayEventsAfter`) on a sessionful transport replays after `Last-Event-ID`. Point every node at the same store.
- **Shutdown:** `await handler.close()` aborts in-flight exchanges, and later `fetch` calls throw. Use `handle.close()` for stdio. Close every stored legacy transport.

## 8. Custom transports

Implement `start`, `send` and `close`. The SDK installs `onmessage`, `onerror` and `onclose`. Rules the type checker cannot enforce:

- **Never call `start()` yourself.** `connect()` installs the callbacks, then starts the transport. A transport that starts first drops messages.
- **`close()` must end by firing `onclose`** exactly once, however the channel ended. The protocol layer tears down from it.
- Use **`onerror`** for out-of-band, non-fatal problems such as a malformed frame. **Throw from `send`** for failures the sender must see.
- **Byte streams:** frame with `ReadBuffer` (newline-delimited, skips non-JSON lines, 10 MB cap) and `serializeMessage`. Message-framed channels such as WebSocket send one JSON message per frame.
- Optional members are used only when present: `sessionId`, `setProtocolVersion`, `setSupportedProtocolVersions`, `hasPerRequestStream`. Set `hasPerRequestStream` only if each request gets its own underlying request, and forward `options.requestSignal`. Modern cancellation then aborts the signal instead of sending `notifications/cancelled`.
- Test by running the same client and server over `InMemoryTransport.createLinkedPair()` and over yours. Any difference is a bug in your transport.

## 9. Test without ports

```ts
const handler = createMcpHandler(buildServer);
const client = new Client({ name: 't', version: '1' }, { versionNegotiation: { mode: 'auto' } });
await client.connect(
  new StreamableHTTPClientTransport(new URL('http://test.local/mcp'), {
    fetch: (url, init) => handler.fetch(new Request(url, init)), // never dials
  }),
);
// ... assert on callTool results; afterEach: await client.close(); await handler.close();
```

- This exercises the deployed handler on the **modern** era. Do not hand-craft JSON-RPC POSTs: modern requests need the `_meta` envelope that `Client` builds.
- `InMemoryTransport.createLinkedPair()` connects **2025-era** instances only. Take both halves from the same package (`/client` or `/server`); two packages bundle separate copies.
- stdio has no in-process path. Spawn the built server with `StdioClientTransport`.

## Client fetch middleware

Use `fetch: applyMiddlewares(a, b, c)(fetch)` on an HTTP client transport. The **last** middleware listed is outermost, so put retries **first** (closest to the network). Middleware sees SDK-sent requests too (`initialize`, the probe). Return the `Response` untouched; read `response.clone()` if you need the body. `withOAuth` and `withLogging` ship built in; `withLogging` writes to stdout by default.

## Common mistakes

| Mistake                                                          | Fix                                                       |
| :--------------------------------------------------------------- | :-------------------------------------------------------- |
| Hand-wired `*StreamableHTTPServerTransport` "for modern clients" | `createMcpHandler`. Hand-wired transports are legacy-only |
| Era split by `Mcp-Session-Id` / `initialize` sniffing            | `isLegacyRequest` in front of `legacy: 'reject'` handler  |
| v1 SDK kept for SSE, `as never` cast                             | `@modelcontextprotocol/server-legacy/sse`                 |
| Factory returns one shared instance                              | Build a new `McpServer` per call                          |
| `console.log` in stdio server                                    | `console.error`                                           |
| `0.0.0.0` bind with no `allowedHosts` / guards                   | Host + Origin validation in front, plus auth              |
| Token checked but `authInfo` never forwarded                     | `handler.fetch(req, { authInfo })` / `req.auth`           |
| Redis listener calls `notify` per node                           | Shared `ServerEventBus` via `{ bus }`                     |
| `'auto'` default in spawn-per-call CLI                           | Default mode + flag, or cached `prior`                    |
| SSE fallback on any error                                        | Only non-auth 4xx; fresh `Client`                         |
| `env: process.env` for stdio child                               | `getDefaultEnvironment()` + named keys                    |
| Hand-crafted JSON-RPC to smoke-test modern                       | Real `Client` over `handler.fetch`                        |

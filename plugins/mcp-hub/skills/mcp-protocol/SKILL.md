---
name: mcp-protocol
description: 'Protocol: low-level MCP SDK v2 work—custom Server handlers, transports, raw wire data, or gateway/relay forwarding; high-level servers use mcp-server.'
user-invocable: false
metadata:
  category: technique
---

# MCP SDK v2 Protocol

Use [mcp-server](../mcp-server/SKILL.md) for standard tools, resources, prompts, hosted stdio/HTTP servers. This skill own boundaries need low-level `Server`: skip `McpServer` automatic validation, capability advertisement, error wrapping. Reference: https://ts.sdk.modelcontextprotocol.io/v2/

## Paths

Pick narrowest path that own integration. Combine paths only where same component implement both boundaries; each selected path's checks its completion criteria.

### Low-level server

**Wire low-level `Server`**: instantiate with explicit `capabilities`, register `tools/list`/`tools/call` by hand. Validate requested tool name and args before business logic; `Server` not derive either check from `tools/list`.

```ts
import { ProtocolError, ProtocolErrorCode, Server } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

const server = new Server({ name: 'catalog', version: '1.0.0' }, { capabilities: { tools: {} } });
const SearchArguments = z.object({ query: z.string().min(1) });

server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'search',
      description: 'Search catalog',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  ],
}));

server.setRequestHandler('tools/call', async (req) => {
  if (req.params.name !== 'search') {
    throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Unknown tool: ${req.params.name}`);
  }
  const args = SearchArguments.safeParse(req.params.arguments);
  if (!args.success) {
    throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'search requires a non-empty query');
  }
  const { query } = args.data;
  // …
});
```

> Throw `ProtocolError(InvalidParams)` for unknown tool or invalid call shape. Known tool's business failure returns `isError: true` (see [mcp-server](../mcp-server/SKILL.md) "Handle Errors").

- [ ] `capabilities` in second constructor arg declares every extension server advertises, matching request handlers; every low-level tool validates name and args against schema advertised by `tools/list`.

### Custom RPC

**Define custom methods**: use vendor namespace like `acme/search`, explicit `{ params, result }` schema. `Server` accepts same Standard Schema libraries as `McpServer` (Zod v4, ArkType, Valibot, `fromJsonSchema()`; see [mcp-server](../mcp-server/SKILL.md)).

```ts
import * as z from 'zod/v4';

const SearchParams = z.object({ query: z.string(), limit: z.number().int().default(10) });
const SearchResult = z.object({ items: z.array(z.string()) });

server.setRequestHandler(
  'acme/search',
  { params: SearchParams, result: SearchResult },
  async ({ query, limit }, ctx) => {
    await ctx.mcpReq.notify({
      method: 'acme/searchProgress',
      params: { stage: 'start', pct: 0 },
    });
    return { items: Array.from({ length: limit }, (_, i) => `${query}-${i}`) };
  },
);

// Client side
const result = await client.request(
  { method: 'acme/search', params: { query: 'mcp', limit: 3 } },
  SearchResult,
);
client.setNotificationHandler(
  'acme/searchProgress',
  { params: z.object({ stage: z.string(), pct: z.number() }) },
  (params) => console.log(params),
);
```

- [ ] Every custom RPC method and notification name carries unique vendor prefix (e.g. `acme/`), every custom request has explicit param and result schemas.

### Custom transport

**Build custom transport**: implement `start()`, `send()`, `close()`, forward `onclose`/`onerror`/`onmessage`.

```ts
import {
  ReadBuffer,
  serializeMessage,
  type JSONRPCMessage,
  type Transport,
  type TransportSendOptions,
} from '@modelcontextprotocol/server';
import type { Socket } from 'node:net';

class SocketTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;
  private readonly readBuffer = new ReadBuffer();
  constructor(private readonly socket: Socket) {}

  private reportError(error: unknown) {
    this.onerror?.(error instanceof Error ? error : new Error(String(error)));
  }

  async start() {
    this.socket.on('data', (chunk) => {
      try {
        this.readBuffer.append(chunk);
        let m;
        while ((m = this.readBuffer.readMessage()) !== null) this.onmessage?.(m);
      } catch (error) {
        this.reportError(error);
        this.socket.destroy();
      }
    });
    this.socket.on('close', () => this.onclose?.());
    this.socket.on('error', (error) => this.reportError(error));
  }
  async send(message: JSONRPCMessage, options?: TransportSendOptions) {
    try {
      this.socket.write(serializeMessage(message));
    } catch (error) {
      const transportError = error instanceof Error ? error : new Error(String(error));
      this.reportError(transportError);
      throw transportError;
    }
  }
  async close() {
    this.socket.end();
  }
}
```

- [ ] Socket and read-buffer errors invoke `onerror`; invalid or oversized input closes socket, synchronous `send()` failure rejects after reporting through `onerror`.
- [ ] `onclose` fires on termination; `server.connect(transport)` owns `transport.start()`.

### Era gateway

**Route protocol eras and gateways**: apply resource-server policy from [mcp-auth](../mcp-auth/SKILL.md) and Host/Origin validation before using `isLegacyRequest()` to split 2025-era clients (no per-request `_meta` envelope) from modern ones.

```ts
import {
  hostHeaderValidationResponse,
  isLegacyRequest,
  originValidationResponse,
} from '@modelcontextprotocol/server';

export default {
  async fetch(request: Request): Promise<Response> {
    const rejected =
      hostHeaderValidationResponse(request, allowedHosts) ??
      originValidationResponse(request, allowedOrigins);
    if (rejected) return rejected;
    const authInfo = await verifyAccessToken(request); // Resource-server policy from [mcp-auth].
    if (await isLegacyRequest(request)) {
      return legacyHandler.fetch(request, { authInfo }); // route 2025-era clients separately
    }
    return handler.fetch(request, { authInfo }); // modern handler dispatch
  },
};
```

> `isLegacyRequest()` returns Promise; await it. Gateways route through `fetch`; for in-process dispatch call `handler.fetch(new Request(...))` direct (harness patterns in [mcp-test](../mcp-test/SKILL.md)).

- [ ] Multi-client gateways verify access and validate Host/Origin before branching on awaited `isLegacyRequest()`; both era handlers receive same verified `authInfo`.
- [ ] Handler dispatch contains failures so long-lived stream continues.

### Raw wire data

**Parse raw wire schemas** (gateways, proxies, logs) with Zod constants from `@modelcontextprotocol/core` (needs `zod`):

```ts
import {
  CallToolResultSchema,
  JSONRPCMessageSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/core';

const parsed = CallToolResultSchema.safeParse(upstreamBody);
const message = JSONRPCMessageSchema.parse(JSON.parse(frame));
if ('method' in message && message.method === 'tools/call') {
  const call = CallToolRequestSchema.parse(message);
}
```

Naming: `<SpecType>Schema`, `<SpecType>RequestSchema`/`ResultSchema`/`NotificationSchema`, `*ParamsSchema`; OAuth add `OAuthTokensSchema`, `OAuthProtectedResourceMetadataSchema`, `OpenIdProviderDiscoveryMetadataSchema`. Types, guards, error classes live in `server`/`client`, not `core`.

- [ ] Every raw JSON value validated by matching `@modelcontextprotocol/core` schema before downstream use.

### Fleet discovery

**Persist discovery for worker fleets**: probe once, persist era verdict with short TTL, let workers adopt valid verdict with zero discovery round trips per worker.

```ts
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

// Bootstrap probe
const bootstrap = new Client(
  { name: 'gateway', version: '1.0.0' },
  { versionNegotiation: { mode: 'auto' } },
);
await bootstrap.connect(new StreamableHTTPClientTransport(url));
const discover = bootstrap.getDiscoverResult();
const cachedPrior = {
  prior: discover ? { kind: 'modern', discover } : { kind: 'legacy' },
  expiresAt: Date.now() + 5 * 60_000,
};
await savePriorForAuthorizationContext(JSON.stringify(cachedPrior));

// Workers adopt persisted state
const worker = new Client(
  { name: 'worker', version: '1.0.0' },
  { versionNegotiation: { mode: 'auto' } },
);
const cached = JSON.parse(await loadPriorForAuthorizationContext());
const prior = cached.expiresAt > Date.now() ? cached.prior : await refreshPrior(url);
await worker.connect(new StreamableHTTPClientTransport(url), {
  prior, // PriorDiscovery verdict — not the raw DiscoverResult
});
```

> `getDiscoverResult()` undefined for successful legacy probe, so persist `{ kind: 'legacy' }` instead of parsing absent result. `refreshPrior()` repeats bootstrap probe, replaces expired cache. Incompatible `prior` rejects with `SdkError(SdkErrorCode.EraNegotiationFailed)` before transport start; catch it, delete cached verdict, start fresh probe.

- [ ] `PriorDiscovery` state keyed by authorization context, has bounded TTL, persists explicit legacy verdict, re-probes after expiry or `EraNegotiationFailed`.
- [ ] Prior-connected workers call `listen()` before relying on `listChanged`.

### Gateway forwarding

**Forward arbitrary methods safely** (gateways, proxies relaying methods they not own): pass explicit result schema, re-emit upstream JSON-RPC errors as `new ProtocolError(code, message, data?)` (narrow with `ProtocolError.isInstance(err)` first if upstream error maybe not already one).

```ts
import { JSONRPCResultResponseSchema } from '@modelcontextprotocol/core';
const result = await upstream.request({ method, params }, JSONRPCResultResponseSchema); // generic result envelope — validates the JSON-RPC result, not a method-specific shape
```

Schema-less call to **spec** method now enforces spec result schema — non-conforming upstream result rejects local with `SdkError(SdkErrorCode.InvalidResult)`. Schema-less call to **non-spec** method throws `TypeError` at call site (`'…' is not a spec method; pass a result schema`) — always pass one for those. For byte-exact forwarding (member order preserved), pass accept-anything Standard Schema instead of spec schema.

> Legacy `-32002` normalizes to `-32602` at encode; typed subclasses drop extra upstream `data` keys. In process using both `@modelcontextprotocol/client` and `@modelcontextprotocol/server`, `instanceof` **does** cross bundles on brand-aware releases; `ProtocolError.isInstance(err)` reads same brand. Match `error.code`/`error.status` only for pre-brand copies, mixed-version rollouts, or errors crossing worker/`structuredClone` boundary — that drops symbol-keyed brand.

- [ ] Every forwarded call carries explicit result schema (spec or accept-anything).
- [ ] Re-emitted upstream errors use `ProtocolError.isInstance(err)` to narrow before re-throwing.

## Related

- Testing & debugging custom transports/gateways: [mcp-test](../mcp-test/SKILL.md)
- Gateway authentication boundary controls: [mcp-auth](../mcp-auth/SKILL.md)

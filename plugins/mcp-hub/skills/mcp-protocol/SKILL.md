---
name: mcp-protocol
description: Use when working with low-level MCP v2 protocol, custom transports, raw wire messages, gateways, or the low-level Server class — not the high-level McpServer (see mcp-server).
user-invocable: false
metadata:
  category: technique
---

# MCP Protocol

Prefer `McpServer`; drop to the low-level `Server` only for custom RPC methods, a hand-rolled transport, or gateway/relay routing across protocol eras — it skips automatic validation, capability advertisement, and error wrapping. Docs: https://ts.sdk.modelcontextprotocol.io/v2/

## Steps

1. **Wire the low-level `Server`**: instantiate with explicit `capabilities`, then register `tools/list`/`tools/call` by hand.

   ```ts
   import { Server } from '@modelcontextprotocol/server';

   const server = new Server(
     { name: 'catalog', version: '1.0.0' },
     { capabilities: { tools: {} } },
   );

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
     const { query } = req.params.arguments as { query: string };
     if (!query) {
       return { content: [{ type: 'text', text: 'query required' }], isError: true }; // business failure
     }
     // …
   });
   ```

   > Unknown/disabled tool names reject with `ProtocolError(InvalidParams)` before `tools/call` runs — do not handle that case here (see [mcp-server errors](../mcp-server/references/errors.md)). The `isError: true` branch above is a _known_ tool's business failure, not a protocol error.
   - [ ] `capabilities` in the second constructor argument declares every extension the server advertises — none left implicit.

2. **Define custom methods**: prefix with a vendor namespace (`acme/search`, never a bare verb) and pass an explicit `{ params, result }` schema — same Standard Schema libraries as `McpServer` (Zod v4, ArkType, Valibot, `fromJsonSchema()`; see [mcp-server]).

   ```ts
   import { z } from 'zod';

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

   - [ ] Every custom RPC method and notification name carries a unique vendor prefix (e.g. `acme/`) — no bare method names.

3. **Build a custom transport**: implement `start()`, `send()`, `close()`, and forward `onclose`/`onerror`/`onmessage`.

   ```ts
   import type {
     JSONRPCMessage,
     Transport,
     TransportSendOptions,
   } from '@modelcontextprotocol/server';

   class SocketTransport implements Transport {
     onclose?: () => void;
     onerror?: (error: Error) => void;
     onmessage?: (message: JSONRPCMessage) => void;
     private readonly readBuffer = new ReadBuffer();
     constructor(private readonly socket: Socket) {}

     async start() {
       this.socket.on('data', (chunk) => {
         this.readBuffer.append(chunk);
         let m;
         while ((m = this.readBuffer.readMessage()) !== null) this.onmessage?.(m);
       });
       this.socket.on('close', () => this.onclose?.());
     }
     async send(message: JSONRPCMessage, options?: TransportSendOptions) {
       this.socket.write(serializeMessage(message));
     }
     async close() {
       this.socket.end();
     }
   }
   ```

   - [ ] `send()` throws on failure and routes it through `onerror` — never swallowed.
   - [ ] `onclose` fires on termination; callers invoke only `.connect()` — never call `.start()` directly.

4. **Route protocol eras and gateways**: use `isLegacyRequest()` to split 2025-era clients (no per-request `_meta` envelope) from modern ones before dispatch.

   ```ts
   import { isLegacyRequest } from '@modelcontextprotocol/server';

   export default {
     async fetch(request: Request): Promise<Response> {
       if (await isLegacyRequest(request)) {
         return legacyHandler.fetch(request); // route 2025-era clients separately
       }
       return handler.fetch(request, { authInfo: getAuthInfo(request) }); // modern handler dispatch
     },
   };
   ```

   > `isLegacyRequest()` returns a Promise — always `await` it. For single-message in-process dispatch, `invoke(server, message, ctx)` exists, but most servers should still route through `fetch`.
   - [ ] Multi-client gateways branch on `isLegacyRequest()` instead of assuming a single protocol era.
   - [ ] Handler dispatch is wrapped so an uncaught failure never interrupts a long-lived stream.

5. **Parse raw wire schemas** (gateways, proxies, logs) with the Zod constants from `@modelcontextprotocol/core` (requires the `zod` dependency):

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

   Naming: `<SpecType>Schema`, `<SpecType>RequestSchema`/`ResultSchema`/`NotificationSchema`, `*ParamsSchema`; OAuth adds `OAuthTokensSchema`, `OAuthProtectedResourceMetadataSchema`, `OpenIdProviderDiscoveryMetadataSchema`. Types, guards, and error classes live in `server`/`client`, not `core`.

   - [ ] Raw JSON is validated against the matching `@modelcontextprotocol/core` schema before being trusted downstream.

6. **Persist discovery for worker fleets**: probe once, then let workers adopt the persisted verdict — zero round trips per worker.

   ```ts
   import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

   // Bootstrap probe
   const bootstrap = new Client(
     { name: 'gateway', version: '1.0.0' },
     { versionNegotiation: { mode: 'auto' } },
   );
   await bootstrap.connect(new StreamableHTTPClientTransport(url));
   const persisted = JSON.stringify(bootstrap.getDiscoverResult());

   // Workers adopt persisted state
   const worker = new Client({ name: 'worker', version: '1.0.0' });
   const discover = JSON.parse(persisted); // bootstrap.getDiscoverResult()
   await worker.connect(new StreamableHTTPClientTransport(url), {
     prior: { kind: 'modern', discover }, // PriorDiscovery verdict — not the raw DiscoverResult
   });
   // For a server known to be pre-2026: prior: { kind: 'legacy' } skips the probe.
   ```

   > `await client.discover()` re-probes; a default connect never probes (`getDiscoverResult()` stays `undefined`). An incompatible `prior` rejects with `SdkError(SdkErrorCode.EraNegotiationFailed)` before the transport starts — catch it and fall back to a fresh probe.
   - [ ] `DiscoverResult`/`PriorDiscovery` state is keyed by authorization context — never shared across principals.
   - [ ] Prior-connected workers call `listen()` before relying on `listChanged`; it otherwise stays silent.

7. **Forward arbitrary methods safely** (gateways/proxies relaying methods they don't own): pass an explicit result schema, and re-emit upstream JSON-RPC errors through `ProtocolError.fromError`.

   ```ts
   import { ResultSchema } from '@modelcontextprotocol/core';
   const result = await upstream.request({ method, params }, ResultSchema); // v1-identical passthrough
   ```

   A schema-less call to a **spec** method now enforces the spec result schema — a non-conforming upstream result rejects locally with `SdkError(SdkErrorCode.InvalidResult)`. A schema-less call to a **non-spec** method throws `TypeError` at the call site (`'…' is not a spec method; pass a result schema`) — always pass one for those. For byte-exact forwarding (member order preserved), pass an accept-anything Standard Schema instead of a spec schema.

   > Legacy `-32002` normalizes to `-32602` at encode; typed subclasses drop extra upstream `data` keys. In a process using both `@modelcontextprotocol/client` and `@modelcontextprotocol/server`, `instanceof` does not cross the bundles — match on `error.code`/`error.status` instead.
   - [ ] Every forwarded call carries an explicit result schema (spec or accept-anything) — none left schema-less.
   - [ ] Re-emitted upstream errors use `throw ProtocolError.fromError(code, message, data)`, not a plain `{ code, message, data }` object.

## Related

- Testing & debugging custom transports/gateways: [mcp-test]
- Gateway authentication boundary controls: [mcp-auth]

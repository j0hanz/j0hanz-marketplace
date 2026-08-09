---
description: Reference for raw wire schemas and gateway/worker-fleet patterns using DiscoverResult.
metadata:
  tags: [wire-schemas, gateway, routing]
  source: internal
---

# Wire Schemas & Gateway Patterns

## Wire schemas (`@modelcontextprotocol/core`)

For code handling raw JSON (gateways, proxies, logs). SDK validates against these Zod constants (requires `zod` dependency):

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

Naming conventions follow `<SpecType>Schema`, `<SpecType>RequestSchema`/`ResultSchema`/`NotificationSchema`, and `*ParamsSchema`. OAuth uses schemas like `OAuthTokensSchema`, `OAuthProtectedResourceMetadataSchema`, and `OpenIdProviderDiscoveryMetadataSchema`. TypeScript types, guards, and error classes reside in `server`/`client`, not `core`.

## Gateways & worker fleets

Probe a server once; other clients connect with zero round trips:

```ts
// Bootstrap probe
const bootstrap = new Client(
  { name: 'gateway', version: '1.0.0' },
  { versionNegotiation: { mode: 'auto' } },
);
await bootstrap.connect(new StreamableHTTPClientTransport(url));
const persisted = JSON.stringify(bootstrap.getDiscoverResult());

// Workers adopt persisted state
const worker = new Client({ name: 'worker', version: '1.0.0' });
await worker.connect(new StreamableHTTPClientTransport(url), { prior: JSON.parse(persisted) });
```

- `await client.discover()` re-probes; default connects don't probe (`getDiscoverResult()` is `undefined`).
- **Do not share `DiscoverResult` across principals** — key by authorization context.
- Prior-connected clients are request-only until `listen()` is called; `listChanged` stays silent.
- Incompatible `prior` rejects with an `SdkError` whose code is `SdkErrorCode.EraNegotiationFailed` before transport starts — fall back to probe and re-persist.

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
const discover = JSON.parse(persisted); // bootstrap.getDiscoverResult()
await worker.connect(new StreamableHTTPClientTransport(url), {
  prior: { kind: 'modern', discover }, // PriorDiscovery verdict — not the raw DiscoverResult
});
// For a server known to be pre-2026: prior: { kind: 'legacy' } skips the probe.
```

- `await client.discover()` re-probes; default connects don't probe (`getDiscoverResult()` is `undefined`).
- **Do not share `DiscoverResult` across principals** — key by authorization context.
- Prior-connected clients are request-only until `listen()` is called; `listChanged` stays silent.
- Incompatible `prior` rejects with an `SdkError` whose code is `SdkErrorCode.EraNegotiationFailed` before transport starts — fall back to probe and re-persist.

## Forwarding arbitrary methods (gateways / proxies)

- A schema-less spec-method call now **enforces** the spec result schema; a non-conforming upstream result is rejected locally with `SdkError(SdkErrorCode.InvalidResult)` and a conforming one is re-serialized in schema key order. A schema-less call for a **non-spec** method throws `TypeError` at the call site (`'…' is not a spec method; pass a result schema`). A relay forwarding `{ method, params }` it does not understand must keep an explicit result schema:

  ```ts
  import { ResultSchema } from '@modelcontextprotocol/core';
  const result = await upstream.request({ method, params }, ResultSchema); // v1-identical passthrough
  ```

- For byte-exact forwarding (member order preserved), pass your own accept-anything Standard Schema instead.
- Inbound half — re-emitting an upstream JSON-RPC error from your own handler: `throw ProtocolError.fromError(code, message, data)`; the encode seam serializes it back to the wire shape. Legacy `-32002` is normalized to `-32602` at encode; typed subclasses keep only their schema-defined `data` members (extra upstream data keys are dropped). Throwing a plain `{ code, message, data }` happens to work today but is unspecified — prefer `fromError`.
- Dual-package boundary: in a process using both `@modelcontextprotocol/client` and `@modelcontextprotocol/server`, `instanceof` does not cross the bundles — match on `error.code` / `error.status` or use `ProtocolError.fromError`.

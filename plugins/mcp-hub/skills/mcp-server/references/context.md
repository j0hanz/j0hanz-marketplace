---
description: >-
  Detailed API reference and list of properties available on the handler context (ctx.mcpReq, ctx.http, etc.).
metadata:
  tags: [context, context-api, handler]
  source: internal
---

# Handler context (`ctx`)

Every handler receives context as second argument:

| Member                                         | Purpose                                                                                |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| `ctx.mcpReq.signal`                            | `AbortSignal` — aborts on client cancel/disconnect; check in loops, forward to `fetch` |
| `ctx.mcpReq.id` / `ctx.mcpReq._meta`           | JSON-RPC request id / request `_meta` (e.g. `progressToken`)                           |
| `ctx.mcpReq.notify(n)` / `ctx.mcpReq.send(r)`  | Send notification / request tied to this request                                       |
| `ctx.mcpReq.elicitInput(params)`               | Ask user mid-call (2025-era; throws on 2026-era)                                       |
| `ctx.mcpReq.inputResponses` / `requestState()` | 2026-era multi-round-trip surfaces                                                     |
| `ctx.mcpReq.envelope`                          | Per-request client identity & capabilities (2026-era; legacy: `getClientVersion()`)    |
| `ctx.sessionId`                                | Session id when transport has one                                                      |
| `ctx.http?.authInfo` / `ctx.http?.req`         | Verified `AuthInfo` / inbound `Request` (HTTP only — `undefined` on stdio)             |

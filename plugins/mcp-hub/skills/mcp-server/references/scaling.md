---
description: Guide to session management, horizontal scaling, Event Bus, and change notifications.
metadata:
  tags: [scaling, event-bus, notifications, sessions]
  source: internal
---

# Sessions, State & Scaling

## Sessions, State, and Resumability

- **Stateless Default**: Fresh instance per request, nothing held → any load balancer, no affinity.
- **Sessions (2025-era only)**: Hand-wire `NodeStreamableHTTPServerTransport` with `sessionIdGenerator` and keep a `Map<sessionId, transport>`.
  > Sessions (`Mcp-Session-Id`, `eventStore` replay) belong only to the 2025-era hand-wired transport. The 2026-07-28 revision is per-request — state lives in `requestState`, not a session.
- **Resumability**: Pass an `eventStore` (`storeEvent(streamId, message)` and `replayEventsAfter(lastEventId, { send })`) to allow clients to reconnect via `Last-Event-ID`.
- **Cross-node Notifications**: Implement a custom `ServerEventBus` (`publish`, `subscribe`) over external pub/sub (e.g. Redis) and pass the instance to `createMcpHandler`: `createMcpHandler(buildServer, { bus: redisBus })`.

## Notifications

One-way server→client messages to invalidate client caches.
Most servers notify automatically when using a registration handle (`update()`, `enable()`, `disable()`, `remove()`).

Behind `createMcpHandler` (where instances are stateless per-request), publish through the handler facade:

```ts
handler.notify.resourceUpdated('config://app');
handler.notify.toolsChanged();
handler.notify.promptsChanged();
handler.notify.resourcesChanged();
```

On stdio, calling `server.send*` directly routes messages onto the stdio subscription stream.

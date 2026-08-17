# Change subscriptions

Use this reference when a client needs server-list changes or resource listeners.

For protocol `2026-07-28`, use `subscriptions/listen`:

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

The constructor's `listChanged` option opens the stream and re-fetches automatically; a manual `setNotificationHandler` overrides it. Pre-`2026-07-28` servers use `subscribeResource`/`unsubscribeResource`; an era mismatch rejects with an `SdkError` whose code is `METHOD_NOT_SUPPORTED_BY_PROTOCOL_VERSION` (enum `SdkErrorCode.MethodNotSupportedByProtocolVersion`).

- [ ] The subscription style matches the server era and every shutdown path calls `subscription.close()`.

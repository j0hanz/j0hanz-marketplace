# Change subscriptions

Use ref when client need server-list changes or resource listeners.

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

Constructor's `listChanged` option opens stream, re-fetches auto; manual `setNotificationHandler` overrides it. Pre-`2026-07-28` servers use `subscribeResource`/`unsubscribeResource`; era mismatch rejects with `SdkError` code `METHOD_NOT_SUPPORTED_BY_PROTOCOL_VERSION` (enum `SdkErrorCode.MethodNotSupportedByProtocolVersion`).

- [ ] Subscription style match server era, every shutdown path call `subscription.close()`.

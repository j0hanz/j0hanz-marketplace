---
name: mcp-client
description: 'Use when writing or reviewing MCP client code on TypeScript SDK v2 that calls a server (callTool, readResource, getPrompt, complete, listTools), answers server requests (elicitation/create, sampling, roots/list), subscribes to changes (listen, subscribeResource, listChanged), or caches responses.'
---

# MCP client

A connected `Client` from `@modelcontextprotocol/client` does three jobs: it calls the server, it answers requests the server sends back, and it reacts to change notifications. Connecting and choosing an era belong to `mcp-transport`; signing in belongs to `mcp-auth`. Everything here runs on a client that is already connected.

## Call the server

```ts
const { tools } = await client.listTools(); // every page, aggregated
const result = await client.callTool(
  { name: 'lookup-order', arguments: { id: 'A-1041' } },
  { timeout: 120_000, signal: controller.signal },
);
if (result.isError) {
  // the tool failed; content[0].text says why, and the model should read it
}
const { contents } = await client.readResource({ uri: 'orders://recent' });
const { messages } = await client.getPrompt({
  name: 'summarize-order',
  arguments: { id: 'A-1041' },
});
const { completion } = await client.complete({
  ref: { type: 'ref/prompt', name: 'summarize-order' },
  argument: { name: 'tone', value: 'f' },
});
```

- **Check `isError` before trusting `content`.** A failed tool call is a result, not a throw, and so is a call whose arguments the input schema rejected. Only protocol-level failures (unknown tool, timeout) throw.
- `structuredContent` is typed `unknown`: check it is present and narrow it before use. When an earlier `listTools()` gave the client the tool's `outputSchema`, `callTool` validates `structuredContent` against it and rejects a result that does not match.
- `listTools`, `listPrompts`, `listResources` and `listResourceTemplates` follow `nextCursor` themselves and return one aggregated list. Passing `{ cursor }` returns exactly that one raw page. `listMaxPages` (default 64; `0` removes the cap) stops a pagination loop that never ends, with `SdkError` `LIST_PAGINATION_EXCEEDED`.
- For a parameterized URI, take a template from `listResourceTemplates()`, expand it, and pass the result to `readResource`.
- Gate optional calls on `client.getServerCapabilities()`, and put `client.getInstructions()` in the model's system prompt.

Every verb takes request options as its second argument:

| Option                   | Effect                                                    |
| :----------------------- | :-------------------------------------------------------- |
| `timeout`                | Per-request timeout, default 60 000 ms                    |
| `signal`                 | `AbortSignal` that cancels the request                    |
| `onprogress`             | Receives each `notifications/progress` for this call      |
| `resetTimeoutOnProgress` | Restarts `timeout` on every progress update               |
| `maxTotalTimeout`        | Absolute cap, even with progress resets                   |
| `cacheMode`              | `'use'` / `'refresh'` / `'bypass'` on the cacheable verbs |

## Tell the failures apart

| What came back              | Meaning                                          | Do                                                           |
| :-------------------------- | :----------------------------------------------- | :----------------------------------------------------------- |
| Result with `isError: true` | The tool ran and failed, or rejected arguments   | Hand the text to the model                                   |
| Throws `ProtocolError`      | The server rejected the request (`code`, `data`) | Fix the request; `-32602` = bad params or a missing resource |
| Throws `SdkError`           | Local failure; branch on `code`                  | See below                                                    |
| Throws `SdkHttpError`       | HTTP status from the transport                   | Auth wall or outage; see `mcp-auth`                          |

`SdkErrorCode` members you will branch on: `REQUEST_TIMEOUT`, `CONNECTION_CLOSED`, `NOT_CONNECTED`, `CAPABILITY_NOT_SUPPORTED`, `INPUT_REQUIRED_ROUNDS_EXCEEDED`, `LIST_PAGINATION_EXCEEDED`, `METHOD_NOT_SUPPORTED_BY_PROTOCOL_VERSION`. Accept `-32002` as well as `-32602` for a missing resource: servers built on older SDKs still send it.

## Answer requests from the server

Declare each capability in the `Client` constructor. A server only sends a request the client declared, and the SDK enforces that on both sides.

```ts
const client = new Client(
  { name: 'my-host', version: '1.0.0' },
  {
    capabilities: { elicitation: { form: {}, url: {} } },
    inputRequired: { maxRounds: 3 }, // default 10
  },
);

client.setRequestHandler('elicitation/create', async (request, ctx) => {
  if (request.params.mode === 'url') {
    // open request.params.url in the user's browser; accept = the user agreed to open it
    return { action: 'accept' };
  }
  // anything else is a form: render request.params.requestedSchema
  return { action: 'accept', content: await showForm(request.params, ctx.mcpReq.signal) };
});
```

- **Register each handler once.** The same handler answers a request the server pushes (2025 era) and a request the SDK fulfils for you inside a `callTool()` round (2026-07-28 `input_required`). Your code never sees the difference.
- **Branch on `mode === 'url'`, and treat everything else as a form.** Form requests sent before `mode` existed omit it. Never test `mode === 'form'`.
- `elicitation: {}` declares form mode only; list `url: {}` explicitly to receive URL requests. `getSupportedElicitationModes(caps)` turns any capability object into `{ supportsFormMode, supportsUrlMode }`.
- `elicitation: { form: { applyDefaults: true } }` (an SDK flag, not a protocol capability) fills defaulted fields the user left empty before the answer goes back.
- `action` is the user's choice: `'accept'` carries `content`; `'decline'` and `'cancel'` carry nothing. Show the user who is asking and what for. Never auto-accept on the user's behalf.
- Past `inputRequired.maxRounds` the call rejects with `INPUT_REQUIRED_ROUNDS_EXCEEDED`. `autoFulfill: false` turns the automatic loop off: a call that needs input rejects on its first round, and you drive the rounds yourself.
- **Sampling** (`sampling/createMessage`, return `{ model, role, content }`) and **roots** (`roots/list`, return `{ roots }` of `file://` URIs) are deprecated as of 2026-07-28 (SEP-2577). Keep their handlers only for servers that have not migrated. Declare `roots` before registering its handler, or `setRequestHandler('roots/list', …)` throws. Roots are advisory: the SDK never enforces them on either side.

## React to changes

Notifications from either era dispatch through `setNotificationHandler`. Register the handlers first; the delivery path is an era question.

```ts
client.setNotificationHandler('notifications/resources/updated', async (n) => {
  const { contents } = await client.readResource({ uri: n.params.uri });
  render(n.params.uri, contents);
});

if (client.getProtocolEra() === 'modern') {
  const sub = await client.listen({
    toolsListChanged: true,
    resourceSubscriptions: ['config://app'],
  });
  // sub.honoredFilter = the part the server agreed to deliver
  const reason = await sub.closed; // 'local' | 'graceful' | 'remote'; never rejects
} else {
  await client.subscribeResource({ uri: 'config://app' });
}
```

- `listen()` is 2026-07-28-only and `subscribeResource()` / `unsubscribeResource()` are 2025-only. The wrong one rejects locally with `METHOD_NOT_SUPPORTED_BY_PROTOCOL_VERSION`.
- Filter fields: `toolsListChanged`, `promptsListChanged`, `resourcesListChanged`, `resourceSubscriptions` (URIs). The server narrows them to its capabilities; read `honoredFilter`, not your own filter.
- The SDK never re-listens. Re-listen, with a backoff, only when `closed` resolves `'remote'`; stop on `'local'` and `'graceful'`.
- The `listChanged` client option opens and manages the stream for you (`autoOpenedSubscription`), re-fetches the list on every change, and calls `onChanged(error, items)`. It registers its own handler during `connect()`, and the last registration wins: a manual `setNotificationHandler` for the same type added after connecting silently disables it.

## Response cache

Every `Client` holds a response cache; the server's hint decides what it may serve.

- `listTools`, `listPrompts`, `listResources`, `listResourceTemplates` and `readResource` serve a still-fresh entry without a round trip. The server sets `ttlMs` and `cacheScope` (a 2026-07-28 surface); without a hint, `ttlMs` is `0` and nothing is served from cache. The client caps any `ttlMs` at 24 hours.
- `cacheMode: 'refresh'` always refetches and stores; `'bypass'` neither reads nor writes.
- `list_changed` and `notifications/resources/updated` evict the matching entries.
- **A shared `responseCacheStore` serving more than one user needs `cachePartition`** set to a stable identity of the auth context. Without it, one user's `'private'` resource bodies can be served to another.
- `defaultCacheTtlMs` opts in to caching against servers that send no hints, including every 2025-era server.

## Common mistakes

| Mistake                                                        | Fix                                                            |
| :------------------------------------------------------------- | :------------------------------------------------------------- |
| `structuredContent` used as a typed value                      | Narrow it from `unknown` first                                 |
| Hand-written `nextCursor` loop around `listTools()`            | It already aggregates; pass `{ cursor }` only for one raw page |
| Separate handlers per era                                      | One handler answers both delivery paths                        |
| `listen()` on a 2025 connection, or the reverse                | Branch on `getProtocolEra()`                                   |
| Manual `list_changed` handler next to the `listChanged` option | Use one or the other                                           |
| Shared cache store without `cachePartition`                    | Partition by auth subject                                      |
| Treating `-32602` as the only not-found code                   | Also accept `-32002` from older servers                        |

## Review checklist

- [ ] `structuredContent` narrowed from `unknown`
- [ ] Capabilities declared in the constructor match the handlers registered
- [ ] Elicitation handler branches on `'url'`, shows who asks, and never auto-accepts
- [ ] `SdkError` branches keyed on `code`; `ProtocolError` read for `code` and `data`
- [ ] Change subscriptions branch on era; re-listen only on `'remote'`
- [ ] A shared cache store has `cachePartition`
- [ ] No new sampling or roots dependencies (deprecated, SEP-2577)

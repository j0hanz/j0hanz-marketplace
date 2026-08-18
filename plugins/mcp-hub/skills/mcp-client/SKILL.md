---
name: mcp-client
description: 'Connect MCP SDK v2 clients, invoke server features, add browser authorization_code, subscribe to changes, cache responses, or wrap HTTP fetch; service credentials use mcp-auth, custom transports use mcp-protocol.'
user-invocable: false
metadata:
  category: technique
---

# MCP SDK v2 clients

Covers `@modelcontextprotocol/client` `2.0.0`.

## Construct and run the client

### Configure the runtime

Standardize to ESM (`"type": "module"` in `package.json`, `"NodeNext"` resolutions in `tsconfig.json`). v2 ships CJS too — `require()` resolves native.

- [ ] ESM settings active, or implementation deliberately uses native CJS resolution.

### Initialize the client

Create `new Client({...})` with only capabilities client implements. Sampling (`createMessage`) and roots (`roots/list`) deprecated by SEP-2577; declare only for legacy support, pass paths through tool arguments, resource URIs, or host config instead. Add elicitation only with matching `elicitation/create` handler from [mcp-elicitation](../mcp-elicitation/SKILL.md).

```ts
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const client = new Client(
  { name: 'my-client', version: '1.0.0' },
  {
    capabilities: {
      sampling: {}, // deprecated — declare only for legacy sampling
    },
    versionNegotiation: { mode: 'auto' },
    listChanged: { tools: { onChanged } },
    listMaxPages: 64,
    responseCacheStore,
    cachePartition,
    defaultCacheTtlMs,
  },
);
```

- [ ] Constructor capabilities precede every handler registration; each declared capability has matching handler/feature; deprecated capabilities appear only for required legacy support.

### Connect with the matching transport

Use `StreamableHTTPClientTransport` default:

```ts
const transport = new StreamableHTTPClientTransport(new URL('http://localhost:3000/mcp'));
await client.connect(transport);
```

Use `StdioClientTransport` from `@modelcontextprotocol/client/stdio` for stdio. SSE-only legacy server uses `SSEClientTransport` after Streamable HTTP fails.

For spawn-per-invocation stdio wrapper, pin era with `versionNegotiation: { mode: { pin: '2026-07-28' } }` for modern protocol or `{ mode: 'legacy' }` for legacy. Cold spawns stall with `mode: 'auto'`; reserve auto negotiation for long-lived connections.

- [ ] Transport matches server; `mode: 'auto'` used only for long-lived connection.

### Register declared handlers

Register every advertised handler before `connect()` so arriving server request always has owner. Register `sampling/createMessage` or `roots/list` only when its deprecated capability declared. For `elicitation/create`, use [mcp-elicitation](../mcp-elicitation/SKILL.md) "Register owned clients before calls."

- [ ] Every registered handler has declared capability, ready before `connect()`.

### Invoke server features

No-argument `listTools()`, `listPrompts()`, `listResources()` aggregate every page; pass `{ cursor }` for one page. Treat `result.isError` as normal tool failure signal. Unknown/disabled tool names reject with `ProtocolError(InvalidParams)`; handle separate (see [mcp-server](../mcp-server/SKILL.md) "Handle Errors").

```ts
const { tools } = await client.listTools();
const result = await client.callTool({ name: 'lookup-order', arguments: { id: 'A-1041' } });
// Check result.isError before consuming result.content.
// result.structuredContent exists only with a declared outputSchema.
// Narrow with isCallToolResult(result) / isSpecType.X(result), not `in`.

const { resources } = await client.listResources();
const { resourceTemplates } = await client.listResourceTemplates();
const { contents } = await client.readResource({ uri: 'orders://recent' });

const { prompts } = await client.listPrompts();
const prompt = await client.getPrompt({ name: 'summarize-order', arguments: { id: 'A-1041' } });
// prompt.messages are ready for a model.

const { completion } = await client.complete({
  ref: { type: 'ref/prompt', name: 'summarize-order' }, // or { type: 'ref/resource', uri: '...' }
  argument: { name: 'tone', value: 'f' },
});
```

- [ ] Tool handling distinguishes `result.isError` business failures from rejected `ProtocolError(InvalidParams)` calls; type narrowing uses SDK guards, not `in`.

### Close every connection

On shutdown/error paths, call `await transport.terminateSession()` then `await client.close()` for Streamable HTTP. `terminateSession()` harmless without server-issued session ID. Stdio and in-memory transports use `await client.close()` alone.

- [ ] Every shutdown/error path closes client; Streamable HTTP also terminates session first.

## Add a needed capability

### Authenticate the client

Static bearer tokens or browser `authorization_code`: follow [client authentication](authentication.md). Service credentials + host-session exchange: [mcp-auth](../mcp-auth/SKILL.md).

### Subscribe to changes

Server change notifications or resource listeners: follow [change subscriptions](subscriptions.md).

### Cache responses

Local caching of list/resource responses: follow [response caching](response-cache.md).

### Add HTTP middleware

HTTP headers, logs, retries: follow [fetch middleware](http-middleware.md).

## See Also

- Error-code lookup: [mcp-test](../mcp-test/SKILL.md); runtime diagnosis: dispatch `mcp-debugger`.
- Server token verification: [mcp-auth](../mcp-auth/SKILL.md).
- SDK docs: https://ts.sdk.modelcontextprotocol.io/v2/

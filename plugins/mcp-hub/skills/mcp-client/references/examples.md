---
description: >-
  Reference implementation for client connection setup and calling tools/resources/prompts.
metadata:
  tags: [examples, client, connection, middleware]
  source: internal
---

# MCP Client Build Examples

## Constructor & connect

```ts
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const client = new Client(
  { name: 'my-client', version: '1.0.0' },
  {
    // Options
    capabilities: {
      elicitation: { form: {}, url: {} },
      sampling: {}, // deprecated — declare only if you need legacy sampling
    },
    versionNegotiation: { mode: 'auto' },
    listChanged: { tools: { onChanged } },
    inputRequired: { maxRounds: 10, autoFulfill: true },
    listMaxPages: 64,
    responseCacheStore,
    cachePartition,
    defaultCacheTtlMs,
  },
);

await client.connect(new StreamableHTTPClientTransport(new URL('http://localhost:3000/mcp')));
```

> `sampling` is deprecated; prefer elicitation. `roots` likewise deprecated.

> **Other transports:** `StdioClientTransport` (from `@modelcontextprotocol/client/stdio`) for local servers; `SSEClientTransport` (from `@modelcontextprotocol/client`) as a fallback for SSE-only servers — try `StreamableHTTPClientTransport` first, retry with `SSEClientTransport` on failure.

## Calling Tools and Resources

```ts
const { tools } = await client.listTools();
const result = await client.callTool({ name: 'lookup-order', arguments: { id: 'A-1041' } });
// result.content: block array
// result.isError: true if tool failed (check before using content)
// result.structuredContent: unknown; present if outputSchema declared

const { resources } = await client.listResources();
const { resourceTemplates } = await client.listResourceTemplates();
const { contents } = await client.readResource({ uri: 'orders://recent' });

const { prompts } = await client.listPrompts();
const prompt = await client.getPrompt({ name: 'summarize-order', arguments: { id: 'A-1041' } });
// prompt.messages — ready to send to a model

const { completion } = await client.complete({
  ref: { type: 'ref/prompt', name: 'summarize-order' }, // or { type: 'ref/resource', uri: 'repo://{repo}/readme' }
  argument: { name: 'tone', value: 'f' },
});
```

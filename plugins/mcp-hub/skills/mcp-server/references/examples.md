---
description: MCP server code examples for stdio/HTTP, tools, resources, and completions.
metadata:
  tags: [examples, server, tools, resources]
  source: internal
---

# MCP Server Build Examples

## Constructor Options

```ts
const server = new McpServer(
  { name: 'catalog', version: '1.0.0' },
  {
    capabilities: { logging: {}, resources: { subscribe: true } },
    instructions: 'Call list-trips before book-trip.',
    enforceStrictCapabilities: true,
  },
);
```

> `capabilities: { logging: {} }` enables **deprecated** MCP logging subsystem (SEP-2577); prefer `console.error` (stderr) or OpenTelemetry for new servers. `resources: { subscribe: true }` not deprecated.

## Quick Start

```ts
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
serveStdio(() => {
  const server = new McpServer({ name: 'weather', version: '1.0.0' });
  server.registerTool(
    'get-forecast',
    { description: 'Get forecast', inputSchema: z.object({ city: z.string() }) },
    async ({ city }) => ({ content: [{ type: 'text', text: `Sunny in ${city}` }] }),
  );
  return server;
});
```

> **Standard Schema:** `inputSchema`/`outputSchema` also accept ArkType schemas as-is, Valibot via `toStandardJsonSchema` from `@valibot/to-json-schema` (passed directly), or raw JSON Schema via `fromJsonSchema`.

## Tool Registration

```ts
server.registerTool(
  'search',
  {
    title: 'Search catalog',
    description: 'Search catalog',
    inputSchema: z.object({
      query: z.string().describe('Query'),
      limit: z.number().int().max(50).optional(),
    }),
    outputSchema: z.object({ names: z.array(z.string()) }),
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  async ({ query, limit }) => {
    const names = ['Product A', 'Product B'];
    return { content: [{ type: 'text', text: names.join('\n') }], structuredContent: { names } };
  },
);
```

## Resource Registration

```ts
import { ResourceTemplate } from '@modelcontextprotocol/server';
server.registerResource(
  'user-profile',
  new ResourceTemplate('users://{userId}/profile', {
    list: undefined,
    complete: { userId: async (v) => lookupIds(v) },
  }),
  { description: 'Profile', mimeType: 'application/json' },
  async (uri, { userId }) => ({
    contents: [{ uri: uri.href, text: JSON.stringify({ userId, plan: 'pro' }) }],
  }),
);
```

## Prompt Registration

```ts
server.registerPrompt(
  'review-code',
  {
    title: 'Code Review',
    description: 'Review code',
    argsSchema: z.object({ code: z.string().describe('Code') }),
  },
  ({ code }) => ({
    messages: [
      { role: 'user', content: { type: 'text', text: `Review:\n\n${code}` } },
      { role: 'assistant', content: { type: 'text', text: 'The one-line cause:' } },
    ],
  }),
);
```

## Argument Completion

```ts
import { completable } from '@modelcontextprotocol/server';
argsSchema: z.object({
  repo: completable(z.string(), async (val) =>
    (await listRepos()).filter((r) => r.startsWith(val)),
  ),
  branch: completable(z.string(), async (val, ctx) => {
    const repo = ctx?.arguments?.repo;
    return repo ? branchesFor(repo).filter((b) => b.startsWith(val)) : [];
  }),
});
```

## Stdio Serving

```ts
const handle = serveStdio(() => buildServer());
console.error('listening on stdio'); // stderr — NEVER console.log
process.on('SIGINT', () => void handle.close());
```

## HTTP Serving

```ts
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
const handler = createMcpHandler(() => {
  const server = new McpServer({ name: 'notes', version: '1.0.0' });
  return server;
});
export default handler; // Web standard runtime (Workers, Deno, Bun)
```

**Plain node:http mounting:**

```ts
import { createServer } from 'node:http';
import { toNodeHandler } from '@modelcontextprotocol/node';
createServer(toNodeHandler(handler)).listen(3000);
```

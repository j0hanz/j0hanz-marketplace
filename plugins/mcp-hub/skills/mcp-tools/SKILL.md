---
name: mcp-tools
description: Use when building, adopting, or reviewing tools on an MCP server built on the TypeScript SDK v2 (registerTool, inputSchema, outputSchema, structuredContent, annotations, isError vs protocol errors, maxToolInputElements), or when auditing tool handlers for contract violations.
---

# MCP tools

One Zod schema does three jobs: the JSON Schema `tools/list` advertises, argument validation before the handler runs, and the handler's argument types. In SDK v2 (`@modelcontextprotocol/server`), `inputSchema` is a `z.object(...)` from `zod/v4` — never a raw shape, never `inputSchema: {}`.

## Register

```ts
import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

const server = new McpServer({ name: 'orders', version: '1.0.0' });

server.registerTool(
  'search-orders',
  {
    description: 'Search orders by id substring, case-insensitive',
    inputSchema: z.object({
      query: z.string().min(1).describe('Substring of order id'),
      limit: z.number().int().max(200).optional(),
    }),
    outputSchema: z.object({
      orders: z.array(z.object({ id: z.string(), total: z.number() })),
    }),
  },
  async ({ query, limit }) => {
    const hits = findOrders(query).slice(0, limit ?? 50);
    return {
      content: [
        {
          type: 'text',
          text: hits.map((o) => `${o.id}:${o.total}`).join('\n'),
        },
      ],
      structuredContent: { orders: hits },
    };
  },
);
```

- A no-argument tool **omits** `inputSchema` entirely.
- v1 `server.tool(...)` is gone: `registerTool(name, config, handler)`.
- Invalid arguments never reach the handler. The client receives an ordinary tool result with `isError: true` and a message naming the failed constraint — not a JSON-RPC error. The model reads it and retries.

## Error channels

Pick by audience. A **tool error** is a successful JSON-RPC result with `isError: true` that the model reads and recovers from. A **protocol error** is a JSON-RPC error response the model never sees.

| Handler                               | Only channel   | Rule                                                                                                                                                           |
| :------------------------------------ | :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tool (`registerTool`)                 | Tool error     | SDK converts **every** throw — including a thrown `ProtocolError` — into `isError: true`. Code and `data` are lost; only `message` survives as `content` text. |
| Resource, prompt, completion callback | Protocol error | No `isError` channel exists. Throw `ProtocolError(code, message, data?)` or a typed subclass.                                                                  |

The one exception that escapes a tool handler: `UrlElicitationRequiredError` (-32042), so the host can open the URL. There is no v1-style `McpError` escape hatch — do not invent one.

**Tool failure the model can fix** — missing record, bad value, transient fault: return `isError: true` with the recovery hint in `text`, the only thing the model has to work with:

```ts
return {
  content: [{ type: 'text', text: `No order "${id}". Known ids: ${ids.join(', ')}` }],
  isError: true,
};
```

`outputSchema` validation is skipped on any `isError` result.

**Resource/prompt/completion failure the caller's code must handle** — throw a typed subclass; it picks the code and packs `data`:

- `ResourceNotFoundError(uri)` — a `resources/read` miss. Wire code `-32602` with `data.uri`. The SDK **never emits** `-32002`; that member is receive-tolerated only. Do not construct `ProtocolError(ResourceNotFound, ...)` by hand.
- `UnsupportedProtocolVersionError({ supported, requested })` — `-32022`.
- `MissingRequiredClientCapabilityError({ requiredCapabilities })` — `-32021`.
- Match these by `code` and `data` shape when a peer may run a pre-brand SDK copy or hands you a plain wire shape. On brand-aware releases, `instanceof` and the static guards (`ProtocolError.isInstance(err)`) also match across separately bundled copies.

## Wire codes (`ProtocolErrorCode`)

| Member                            | Code     | Meaning                                           |
| :-------------------------------- | :------- | :------------------------------------------------ |
| `ParseError`                      | `-32700` | Message was not valid JSON                        |
| `InvalidRequest`                  | `-32600` | Not a valid JSON-RPC request                      |
| `MethodNotFound`                  | `-32601` | No handler for the method                         |
| `InvalidParams`                   | `-32602` | Params wrong; also the `resources/read` miss code |
| `InternalError`                   | `-32603` | Handler threw a non-`ProtocolError`               |
| `ResourceNotFound`                | `-32002` | Receive-tolerated only — never emitted            |
| `MissingRequiredClientCapability` | `-32021` | Client did not declare a required capability      |
| `UnsupportedProtocolVersion`      | `-32022` | Version unknown or unsupported                    |
| `UrlElicitationRequired`          | `-32042` | Tool needs the user to visit a URL                |

## Structured output

`outputSchema` + `structuredContent` give machine-readable results, validated before they leave the server; `content` stays alongside for clients that cannot read structured output. `tools/list` advertises the derived output schema. Wire encoding differs by protocol era — see `mcp-transport`.

`content` blocks are `text`, `image` and `audio` (base64 `data` + `mimeType`), `resource` (a resource's contents embedded inline, no `resources/read` round trip), and `resource_link` (names a resource by `uri` without its bytes). One result can mix them.

## Annotations

`title` is the display name; `annotations` (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) are behavior hints for the client — never change how the SDK runs the tool. Clients use them to auto-approve read-only tools and confirm destructive ones.

## Argument size limits

`maxToolInputElements` — constructor option, **off by default**, must be ≥ 1 or `Infinity`. Caps combined array elements and object members in one call's `arguments`. A call over the limit returns `isError: true` naming the limit, before the schema runs, and other calls keep working:

```ts
const server = new McpServer(
  { name: 'orders', version: '1.0.0' },
  { maxToolInputElements: 10_000 },
);
```

Name is exact: `maxToolInputElements`, not `inputArgumentMaximum` or any cousin. The transport's `maxRequestBodySize` (4 MiB default) is the primary size limit; this is the finer element-count limit. Independently: bound every array in `inputSchema` with `.max()`.

## Common mistakes

| Mistake                                                    | Reality                                                                               |
| :--------------------------------------------------------- | :------------------------------------------------------------------------------------ |
| Throw `ProtocolError` from a tool handler to fail the call | SDK converts it to `isError: true`; code and `data` lost, model sees only the message |
| `ProtocolError(ResourceNotFound, ...)` for a read miss     | Throw `ResourceNotFoundError(uri)` — sends `-32602`; `-32002` is never emitted        |
| Invalid args reported as JSON-RPC error                    | Ordinary `isError: true` tool result; handler never runs                              |
| `zod` declared as `^3.x` in `package.json`                 | Declare `zod ^4.2.0`; a zod-3 range typechecks, then `tools/list` errors at runtime   |
| `zod` 4.0–4.1                                              | 4.2+: older versions fall back with a warning and drop every `.describe()`            |
| `inputSchema: {}` for a no-arg tool                        | Omit `inputSchema`                                                                    |

## Review checklist

- [ ] `package.json` declares `zod ^4.2.0`; every `inputSchema` is `z.object(...)`; no-arg tools omit it
- [ ] Tool handlers use only `isError: true` / throws; no hand-built `ProtocolError` in tools
- [ ] `isError` text names the fix (valid ids, expected range) — the model's only recovery material
- [ ] Resource/prompt/completion callbacks throw typed subclasses, not bare `ProtocolError`
- [ ] Error codes matched by `code` + `data` shape wherever a peer may run a pre-brand SDK copy

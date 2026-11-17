---
name: mcp-resources
description: 'Use when building or reviewing an MCP server that exposes read-only data or user-picked prompts: deciding resource vs tool vs prompt, registering resources and URI templates with the TypeScript SDK (registerResource, ResourceTemplate, resources/list, resources/read), registering prompts (registerPrompt, argsSchema, completable), implementing resource subscriptions or change notifications across 2025-era and 2026-07-28 protocol revisions, securing file-backed resource templates against path traversal, or auditing resource handlers for contract violations (error codes, empty contents, pagination, cursor stability).'
---

# MCP Resources

A **resource** is read-only data a client lists, reads, and attaches as model context. The core decision is the **control split**: who decides the data gets used.

| Primitive | Who controls it                       | Use for                                          |
| --------- | ------------------------------------- | ------------------------------------------------ |
| Resource  | Application / user (attaches context) | Read-only context: files, schemas, configs, docs |
| Tool      | Model (decides to call)               | Actions, anything that writes or triggers        |
| Prompt    | User (picks from a menu)              | Canned instruction workflows                     |

The model never calls a resource; the host app attaches it. If the model must pull data mid-task, that is a tool, even when the data is read-only.

## Design recipe: expose both surfaces

For one data store, register a resource **and** a thin read tool over it. The resource serves hosts that attach context (Claude Code `@server:uri` mentions, resource pickers). The tool serves agent harnesses where the model fetches content itself. Same store, two doors, a few lines each. Skip the resource surface and you strand hosts that surface resources; skip the tool and you strand harnesses that do not. Search or an index over the store is a tool, not a resource: the model initiates it.

Host reality as of 2026-11 (re-verify before relying on a row):

| Host                                  | Resources surfaced                                          | Caveats                                                                |
| ------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| Claude Code                           | Yes: `@server:uri` mentions + auto-provided list/read tools | Non-interactive mode refreshes only the tool list on `list_changed`    |
| Claude Desktop / claude.ai connectors | Yes (text + binary)                                         | No resource subscriptions; ~150k char result cap, 240s timeout         |
| VS Code / Copilot                     | Reads for MCP Apps only                                     | No resource browser for native servers; return content in tool results |
| Cursor                                | Yes                                                         | none                                                                   |
| ChatGPT, Zed, Windsurf                | No                                                          | Tools only                                                             |
| Cline, Goose                          | Yes                                                         | none                                                                   |

Scale: about 50 of about 170 tracked clients claim resource support. The dual-surface recipe makes this table survivable.

## Registering resources (TS SDK v2)

```ts
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/server';

const server = new McpServer({ name: 'docs', version: '1.0.0' });

// Fixed URI
server.registerResource(
  'config',
  'config://app',
  { title: 'App Config', mimeType: 'application/json' },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'application/json', text: readConfig() }],
  }),
);

// URI template: vars arrive parsed as the callback's second argument
server.registerResource(
  'doc',
  new ResourceTemplate('docs://{file}', { list: undefined }),
  { description: 'A markdown page', mimeType: 'text/markdown' },
  async (uri, { file }) => ({
    contents: [{ uri: uri.href, text: await loadPage(file) }],
  }),
);
```

- `list` is a required key of the template options. A callback returning `{ resources: [...] }` merges the instances into `resources/list`. Pass `undefined` when the instances are unbounded: the template still appears in `resources/templates/list`, so a client that knows the variable builds the URI itself.
- A simple `{var}` matches one segment only (no `/`), so a nested path like `guides/setup.md` never matches and reads as not-found. Use reserved expansion `{+var}` for multi-segment paths.
- `complete` adds per-variable autocomplete: a map of variable name to `async (value, context?) => string[]`. Return the full match list; the SDK truncates to 100 and fills `total`/`hasMore`. `context?.arguments` carries the other variables already filled in; return `[]` when it is missing, never throw.
- Contents items carry `text` or base64 `blob`, plus a per-item `mimeType`. One read may return several items. Set `mimeType` explicitly (`application/json`, `text/markdown`); nothing infers it.
- `McpServer` advertises `resources: { listChanged: true }` on its own. `registerResource` and the returned handle's `update`/`remove`/`enable`/`disable` send `notifications/resources/list_changed` automatically. Call `server.sendResourceListChanged()` only when the set changes for a reason the registry cannot see.
- SDK v1.x (maintenance line, `@modelcontextprotocol/sdk`) uses `server.resource(...)` from `server/mcp.js`, and its subscribe handlers take `SubscribeRequestSchema` from `types.js`. v2 handlers take method strings, and `subscribe: true` must be declared explicitly. Mixing the two vocabularies from memory is the most common hallucination here.

## File-backed resources: resolve, then contain

A template variable is client-controlled input. `..` arrives raw and percent-encoded, and a symlink inside the root can point outside it. String checks on the raw value miss both, so compare resolved real paths:

```ts
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

const DOCS_ROOT = path.resolve('./docs');

async (uri, { file }) => {
  const requested = await realpath(path.join(DOCS_ROOT, String(file)));
  if (!requested.startsWith(DOCS_ROOT + path.sep)) {
    throw new Error(`${uri.href} resolves outside the docs root`);
  }
  return {
    contents: [{ uri: uri.href, text: await readFile(requested, 'utf8') }],
  };
};
```

`realpath` collapses `..` and symlinks to what is actually on disk, and the prefix check then rejects anything that escaped. `realpath` throws for a nonexistent path, which surfaces as a protocol error: the right outcome. This is the SDK docs' reference pattern, not optional hardening. When the store is a fixed map keyed by ID, an exact-key lookup removes the path question entirely; resolve-then-contain is for variables that build real paths.

URI rules:

- Use a custom scheme (`docs://`, `db://`) for anything your server serves. Reserve `https://` for content the client can fetch directly itself: publishing `https://` URIs the client cannot reach strands it.
- Use `file://` for filesystem-like resources; custom schemes must comply with RFC 3986.
- A resource URI is a bearer identifier. If URIs embed user or session IDs, bind them server-side to the authenticated user and re-check authorization on every read; possessing a URI is not authentication.

## Subscriptions: two protocol eras

The subscription mechanism is the biggest breaking change in the spec. Gate on the negotiated era; never assume one mechanism is universal.

|                    | 2025 revisions (…2025-11-25)                  | 2026-07-28                                                    |
| ------------------ | --------------------------------------------- | ------------------------------------------------------------- |
| Client opt-in      | `resources/subscribe` / `unsubscribe` per URI | `subscriptions/listen` stream, `resourceSubscriptions` filter |
| Server bookkeeping | You track the subscribed set per connection   | You do not; the entry filters delivery by URI                 |
| Update delivery    | To subscribers only; unsolicited is wrong     | Onto the client's listen stream, `subscriptionId`-tagged      |

Dual-era pattern over stdio (the SDK routes the verbs; the bookkeeping is yours):

```ts
function buildServer(reqCtx: McpRequestContext): McpServer {
  const server = new McpServer(
    { name: 'docs', version: '1.0.0' },
    { capabilities: { resources: { subscribe: true } } },
  );

  const subscribed = new Set<string>(); // per connection: dies with the instance
  server.server.setRequestHandler('resources/subscribe', (req) => {
    subscribed.add(req.params.uri);
    return {};
  });
  server.server.setRequestHandler('resources/unsubscribe', (req) => {
    subscribed.delete(req.params.uri);
    return {};
  });

  const pageChanged = (uri: string) =>
    (reqCtx.era === 'modern' || subscribed.has(uri)) &&
    server.server.sendResourceUpdated({ uri }).catch(() => {});
  return server;
}
```

Rules that hold in both eras:

- Track subscriptions per connection: the `Set` lives inside the factory-built instance and never leaks across connections.
- Gate per-URI sends on `reqCtx.era === 'modern' || subscribed.has(uri)`. On modern connections the subscribe set stays empty and `serveStdio` routes `sendResourceUpdated` onto matching listen streams; on 2025-era connections send only to subscribers.
- Over HTTP behind `createMcpHandler`, the `McpServer` instance is per-request, so long-lived state dies with it. Publish through `handler.notify.resourceUpdated(uri)` instead of the instance. The stateless legacy posture can never deliver subscriptions: `resources/subscribe` succeeds and the `Set` is discarded.
- Coalesce bursts (editors fire several events per save), and treat every notification as best-effort: clients must still re-read to be sure.
- Content changes are `notifications/resources/updated`; changes to which resources exist are `notifications/resources/list_changed`. Never use one for the other.

## List, read, and error contracts

- Read callbacks run only on `resources/read`, list callbacks only on `resources/list`. Keep both cheap: a list returns metadata only (`uri`, `name`, `title`, `mimeType`, `size`), never bodies. Expose a thousand resources and pay only for the ones read; a list callback that walks the whole store pays on every list.
- For unbounded or huge stores, do not list everything: list a bounded index (recent, categories) and serve the rest through templates plus a search tool.
- If you implement `resources/list` pagination yourself: cursors are opaque strings the client must not parse; keep them stable against set changes (an offset into a mutable array is not stable); a missing `nextCursor` means the end; an invalid cursor is `-32602`, not an empty page. The SDK v2 high-level registry's auto-installed `resources/list` ignores cursors entirely (verified 2.4.0), so real pagination means replacing it with `server.server.setRequestHandler('resources/list', ...)` after registration.
- Not-found is a protocol error, never an empty `contents` array: empty reads as success with no content. Throw `ResourceNotFoundError(uri)` (exported from the package root). The SDK answers it with `-32602` and the URI in `data` on **every** protocol revision; it never emits `-32002`, which stays importable only so clients can recognise it from older peers. A plain `Error` surfaces as `-32603`. Either way, mask internal details in the message: file paths and stack fragments go to the stderr log, not into model context.
- Put binary content base64 in `blob`; never inline raw bytes.
- stdio servers log to stderr only; stdout is the protocol channel. Test with MCP Inspector before wiring a host.

## Prompts

A **prompt** is a message template the user picks by name (slash command, menu entry). Register it with `registerPrompt(name, config, callback)`; `argsSchema` is one `z.object(...)` that drives the advertised argument list, validation, and the callback's types.

```ts
import { completable, McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

server.registerPrompt(
  'review-code',
  {
    title: 'Code Review',
    description: 'Review code for best practices',
    argsSchema: z.object({
      language: completable(z.string().describe('Programming language'), (value) =>
        ['typescript', 'python', 'go'].filter((l) => l.startsWith(value)),
      ),
      code: z.string().describe('The code to review'),
    }),
  },
  ({ language, code }) => ({
    messages: [
      {
        role: 'user' as const,
        content: { type: 'text' as const, text: `Review this ${language} code:\n\n${code}` },
      },
    ],
  }),
);
```

- `.describe()` becomes the argument description `prompts/list` shows next to the input field.
- Each message has `role: 'user' | 'assistant'` and one `content` block (`text`, `image`, `audio`, `resource`, `resource_link`). A trailing `assistant` message seeds the start of the reply.
- Embed a registered resource with `type: 'resource'` to deliver it inline, with no `resources/read` round trip.
- `completable(schema, cb)` adds autocomplete to one prompt argument; `cb(value, context?)` gets the other filled-in arguments as `context.arguments`. The first `completable` registers the `completion/complete` handler and advertises the `completions` capability. Resource template variables use the template's `complete` map instead.
- Prompt callbacks have no `isError` channel: throw `ProtocolError` (or a typed subclass) for a bad request.

## Review checklist

- [ ] Read-only context exposed as a resource (not only tools); a read tool exists too if agents must pull mid-task
- [ ] Not-found throws `ResourceNotFoundError`; no empty `contents` array; nothing hardcodes `-32002`
- [ ] List is metadata-only and cheap; bounded or paginated; cursors stable
- [ ] Subscriptions: `subscribe: true` declared, set tracked per connection, sends gated on era, coalesced
- [ ] `https://` URIs only for client-fetchable content; custom schemes elsewhere
- [ ] URIs carrying user or session IDs re-check authorization per read
- [ ] `mimeType` set explicitly on registrations and contents
- [ ] Prompts: `argsSchema` is a `z.object`, every argument has `.describe()`, completion callbacks never throw
- [ ] stdio: logs to stderr; verified in MCP Inspector

## Common mistakes

| Mistake                                 | Rationalization to reject                     | Fix                                                                  |
| --------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------- |
| Everything is a tool                    | "tools always work, resource support varies"  | Dual surface; the host table is dated and moving                     |
| `resources/subscribe` assumed universal | "it is core spec, both eras speak it"         | Removed in 2026-07-28; gate on `reqCtx.era`                          |
| Hardcoded `-32002` for not-found        | "the spec reserves it for not-found"          | Throw `ResourceNotFoundError`; the SDK sends `-32602` in every era   |
| v1 API recalled as current              | "`server.resource` is stable across versions" | v2: `registerResource`, method-string handlers, explicit `subscribe` |
| Heavy work in list callbacks            | "clients need the full picture"               | Metadata-only list; templates and reads carry the payload            |
| Unbounded list of thousands             | "clients paginate anyway"                     | Bounded index + templates + search tool                              |

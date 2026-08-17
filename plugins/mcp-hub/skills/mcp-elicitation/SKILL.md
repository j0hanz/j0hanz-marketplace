---
name: mcp-elicitation
description: Use when implementing mid-call user interaction, prompt autocomplete, progress tracking, or cancellation in the TypeScript SDK v2.
user-invocable: false
metadata:
  category: technique
---

# MCP Elicitation & Mid-Call Interaction

Covers `@modelcontextprotocol/server` v2 mid-call interaction. Ref: https://ts.sdk.modelcontextprotocol.io/v2/

Modern (2026-era) connections use stateless, multi-round `inputRequired(...)` returns instead of blocking the handler thread; legacy (2025-era) connections use blocking `elicitInput()`. Only the ask-user mechanism differs across eras — progress (`notify`) and cancellation (`signal`) are identical in both. The SDK bridges modern servers to legacy clients automatically when `inputRequired.legacyShim` is enabled (default `true`).

## When to Use

- Tool needs mid-call operator input, confirmation, or progress tracking.
- Client needs to register auto-fulfillment handlers.
- Prompt arguments require dynamic autocompletion.

## Steps

### Client: register the handler first

Clients must register the `elicitation/create` handler at construction — nothing below works until this exists. Set `inputRequired: { maxRounds }` to bound auto-fulfillment round trips. Client default is 10; the server-side `ServerOptions.inputRequired.maxRounds` defaults to a tighter 8, since the legacy shim holds a live wire request open while waiting.

```ts
const client = new Client(
  { name: 'client', version: '1.0' },
  {
    capabilities: { elicitation: { form: {}, url: {} } },
    inputRequired: { maxRounds: 10 },
  },
);
client.setRequestHandler('elicitation/create', async (req) => {
  if (req.params.mode === 'url') return { action: 'accept' };
  return { action: 'accept', content: { confirmed: true } };
});
```

### Server: mid-call interaction

1. **Check responses before eliciting**: before returning `inputRequired`, check `ctx.mcpReq.inputResponses` — the client re-runs the whole call from the top once the user answers, so already-answered fields must not be re-requested. Read accepted values with `acceptedContent(ctx.mcpReq.inputResponses, key, schema)` (returns `undefined` if missing, declined, or cancelled); inspect the raw action (`accept`/`decline`/`cancel`) with `inputResponse(...)` first, and bail out on `decline`/`cancel` instead of re-prompting — else a declined field loops forever.

   ```ts
   server.registerTool(
     'deploy',
     { inputSchema: z.object({ env: z.string() }) },
     async ({ env }, ctx) => {
       const state = inputResponse(ctx.mcpReq.inputResponses, 'confirm');
       if (state?.action === 'decline' || state?.action === 'cancel') {
         return { content: [{ type: 'text', text: 'Deploy cancelled' }] };
       }
       const confirmed = acceptedContent(
         ctx.mcpReq.inputResponses,
         'confirm',
         z.object({ confirm: z.boolean() }),
       )?.confirm;
       if (confirmed) return { content: [{ type: 'text', text: 'Deployed' }] };
       return inputRequired({
         inputRequests: {
           confirm: inputRequired.elicit({
             message: `Deploy?`,
             requestedSchema: { type: 'object', properties: { confirm: { type: 'boolean' } } },
           }),
         },
       });
     },
   );
   ```

2. **Pick the request builder**: `inputRequired.elicit()` (form fields) and `inputRequired.elicitUrl()` (URL redirect, e.g. OAuth) are current — prefer them for new code. `inputRequired.createMessage()` (deprecated sampling) and `inputRequired.listRoots()` (deprecated roots) exist only to migrate old embedded flows.

3. **Carry cross-round state in `requestState`, never in memory**: for sequential rounds, mint an opaque string with an HMAC codec and return it on `requestState`; read it back with `ctx.mcpReq.requestState<State>()`. It round-trips through the client byte-for-byte, so it is **attacker-controlled** — keep it signed (not encrypted) and never place secrets in it. Tampered or expired state answers `-32602 Invalid or expired requestState` and never reaches the handler.

   ```ts
   const codec = createRequestStateCodec<{ step: string }>({
     key: crypto.getRandomValues(new Uint8Array(32)),
     ttlSeconds: 600,
   });
   const app = new McpServer(
     { name: 'app', version: '1.0' },
     { requestState: { verify: codec.verify } },
   );
   // Inside a tool handler registered on `app`:
   return inputRequired({
     inputRequests: { scope: inputRequired.elicit({/* … */}) },
     requestState: await codec.mint({ step: 'confirmed' }),
   });
   ```

4. **Emit progress**: call `ctx.mcpReq.notify(...)` with a `notifications/progress` message keyed on `progressToken`; `progress` must strictly increase across updates for the same token.

   ```ts
   async ({ files }, ctx) => {
     const tok = ctx.mcpReq._meta?.progressToken;
     for (let i = 0; i < files.length; i++) {
       if (tok)
         await ctx.mcpReq.notify({
           method: 'notifications/progress',
           params: { progressToken: tok, progress: i + 1, total: files.length },
         });
     }
     return { content: [{ type: 'text', text: 'Done' }] };
   };
   ```

5. **Guard cancellation**: pass `ctx.mcpReq.signal` to database or HTTP calls, and check `signal.aborted` inside recursive functions or loop conditions — the v2 transport aborts in-flight handlers on close.

6. **Autocomplete prompt arguments**: wrap fields of a prompt's `argsSchema` in `completable(...)` to register autocomplete handlers. Resource template variables use the template's own `complete` map instead, not `completable`.

   ```ts
   import { completable } from '@modelcontextprotocol/server';
   server.registerPrompt(
     'review',
     {
       argsSchema: z.object({
         lang: completable(z.string(), (val) =>
           ['ts', 'js', 'py'].filter((l) => l.startsWith(val)),
         ),
       }),
     },
     ({ lang }) => ({
       messages: [{ role: 'user', content: { type: 'text', text: `Review ${lang}` } }],
     }),
   );
   ```

## Legacy Path (2025-era connections only)

`ctx.mcpReq.elicitInput()` **throws on 2026-era connections regardless of the shim** — `legacyShim` runs the other direction: it serves modern `inputRequired(...)` returns to 2025-era clients by pushing real `elicitation/create` requests, it does not make `elicitInput()` work on modern connections. Requires the client's `elicitation` capability. Form mode is for standard inputs — never request secrets (credentials, API keys) via forms. URL mode redirects the user outside the chat (e.g. OAuth login). `requestedSchema` defaults to JSON Schema 2020-12; declare `$schema` for a ported draft-07 schema.

```ts
const result = await ctx.mcpReq.elicitInput({
  mode: 'form',
  message: `Rate topic`,
  requestedSchema: {
    type: 'object',
    properties: { rating: { type: 'number' } },
    required: ['rating'],
  },
});
if (result.action === 'accept') {
  return { content: [{ type: 'text', text: `Recorded: ${JSON.stringify(result.content)}` }] };
}
```

> **v2 typing:** `ElicitResult.content` values are `string | number | boolean | string[]`. A handler returning arbitrary objects fails to compile and fails schema validation (`-32602`).

## Deprecated (SEP-2577)

- **Sampling** (`ctx.mcpReq.requestSampling`) routed an LLM call through the client — migrate by calling the LLM provider's API directly from the server. Functional ≥ 12 months on 2025-era connections; throws on 2026-era.
- **MCP logging** (`ctx.mcpReq.log(level, data)`) — prefer stderr or OpenTelemetry instead.

## Completion Criteria

To consider elicitation and mid-call interaction complete, you must verify:

- [ ] No mid-call tool handlers block threads or run synchronously while awaiting user actions.
- [ ] Every `inputRequired` return checks `ctx.mcpReq.inputResponses` first, so answered fields are never re-requested.
- [ ] The `requestState` codec is wired (HMAC-verified) and no secrets are placed in the attacker-controlled `requestState` payload.
- [ ] All forms, input widgets, and prompt arguments are clear, validated, and do NOT request credentials or access key secrets.
- [ ] `signal.aborted` is checked on every iteration of loops or long database inquiries.
- [ ] New interaction flows return modern `inputRequired` descriptors; legacy `elicitInput()` is used only where a connection is confirmed 2025-era.
- [ ] No deprecated sampling (`requestSampling`) or MCP logging (`log`) call remains — replaced with a direct LLM call and stderr/OpenTelemetry respectively.

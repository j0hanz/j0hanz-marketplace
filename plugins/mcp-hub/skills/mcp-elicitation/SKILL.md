---
name: mcp-elicitation
description: Elicitation: MCP SDK v2 user-input rounds, prompt completion, progress, or cancellation.
user-invocable: false
metadata:
  category: technique
---

# MCP Elicitation

Implement mid-call interaction with `@modelcontextprotocol/server` v2. Reference: https://ts.sdk.modelcontextprotocol.io/v2/

**Era gotcha.** Modern (2026) handlers return stateless, multi-round `inputRequired(...)` descriptors; 2025 handlers await blocking `elicitInput()`. `elicitInput()` throws on modern connections. With its default `legacyShim: true`, the SDK delivers modern `inputRequired(...)` returns to 2025 clients by issuing `elicitation/create`; it does not enable `elicitInput()` for modern clients. Progress (`notify`) and cancellation (`signal`) work in both eras.

## Steps

1. **Register owned clients before calls**: Advertise elicitation capabilities, bound auto-fulfillment with `inputRequired.maxRounds`, and handle `elicitation/create` at construction. The client default is 10 rounds; `ServerOptions.inputRequired.maxRounds` defaults to 8 because the legacy shim keeps a wire request open.

   ```ts
   const client = new Client(
     { name: 'client', version: '1.0' },
     {
       capabilities: { elicitation: { form: {} } },
       inputRequired: { maxRounds: 10 },
     },
   );
   client.setRequestHandler('elicitation/create', async (req) => {
     if (req.params.mode !== 'form') return { action: 'decline' };
     const content = await renderAndValidateJsonSchemaForm(
       req.params.message,
       req.params.requestedSchema,
     );
     return content === undefined ? { action: 'decline' } : { action: 'accept', content };
   });
   ```

   `renderAndValidateJsonSchemaForm()` renders the requested schema and resolves only validated content; `undefined` means the user declined. Add URL capability and an owned URL handler only when the client can complete that flow.

   **Done:** Every owned client that serves interaction advertises only supported modes, has a bounded handler, and returns content validated against the requested schema.

2. **Make modern tool calls replay-safe**: Each answer restarts the tool from its beginning. Read `ctx.mcpReq.inputResponses` before returning `inputRequired`; use `acceptedContent(..., key, schema)` for accepted content and `inputResponse(...)` to exit cleanly on `decline` or `cancel`.

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
             message: 'Deploy?',
             requestedSchema: { type: 'object', properties: { confirm: { type: 'boolean' } } },
           }),
         },
       });
     },
   );
   ```

   Use `inputRequired.elicit()` for form fields and `inputRequired.elicitUrl()` for redirects such as OAuth. Migrate embedded sampling and roots flows away from deprecated `inputRequired.createMessage()` and `inputRequired.listRoots()`.

   **Done:** Every modern interaction reads prior responses, returns each accepted path once, and terminates every decline or cancellation path.

3. **Carry sequential state in signed `requestState`**: Return an opaque, HMAC-signed state value and read it through `ctx.mcpReq.requestState<State>()`. The client round-trips this value byte-for-byte, so keep secrets out of it and reject tampered or expired values with `-32602 Invalid or expired requestState`.

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

   **Done:** Every multi-round flow stores its state in a verified codec, rejects invalid state before business logic, and exposes no secret in the payload.

4. **Report long work and honor cancellation**: Emit strictly increasing `notifications/progress` values for one `progressToken`. Pass `ctx.mcpReq.signal` to database and HTTP work; inspect `signal.aborted` inside recursive work and loop conditions.

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

   **Done:** Each long-running path propagates its abort signal, checks it during repeated work, and emits monotonic progress when the caller supplied a token.

5. **Complete prompt arguments at the schema**: Wrap prompt `argsSchema` fields with `completable(...)`. Define resource-template completion in the template’s `complete` map instead.

   ```ts
   import { completable } from '@modelcontextprotocol/server';
   server.registerPrompt(
     'review',
     {
       argsSchema: z.object({
         lang: completable(z.string(), (val) =>
           ['ts', 'js', 'py'].filter((lang) => lang.startsWith(val)),
         ),
       }),
     },
     ({ lang }) => ({
       messages: [{ role: 'user', content: { type: 'text', text: `Review ${lang}` } }],
     }),
   );
   ```

   **Done:** Every prompt argument that needs completion uses `completable(...)`, and every resource-template variable uses its template completion map.

6. **Serve confirmed 2025 connections through the legacy branch**: Require the client’s `elicitation` capability, use form mode for standard data and URL mode for external redirects, and return from the handler on `decline` or `cancel`. Keep credentials and API keys out of forms. `requestedSchema` defaults to JSON Schema 2020-12; declare `$schema` when porting draft-07. `ElicitResult.content` accepts only `string | number | boolean | string[]`, so return those values rather than arbitrary objects.

   ```ts
   const result = await ctx.mcpReq.elicitInput({
     mode: 'form',
     message: 'Rate topic',
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

   **Done:** Each legacy-only flow has a confirmed 2025 connection, supported client capability, declared schema dialect when needed, valid result content, and a terminating non-accept path.

7. **Retire 2025-only facilities**: Replace `ctx.mcpReq.requestSampling` with a server direct-LLM-provider call only after recording the provider, data-handling and retention policy, consent path, and cost owner; it remains functional for 2025 connections but throws for modern ones. Replace deprecated `ctx.mcpReq.log(level, data)` with stderr or OpenTelemetry.

   **Done:** Each direct LLM replacement has a recorded provider, privacy/consent, and cost decision; new interaction paths use neither sampling nor MCP logging, and every retained legacy call is isolated to a confirmed 2025 branch.

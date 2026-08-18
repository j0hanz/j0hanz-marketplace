---
name: mcp-elicitation
description: Elicitation: MCP SDK v2 user-input rounds, prompt completion, progress, or cancellation.
user-invocable: false
metadata:
  category: technique
---

# MCP Elicitation

Implement mid-call interaction with `@modelcontextprotocol/server` v2. Reference: https://ts.sdk.modelcontextprotocol.io/v2/

**Era gotcha.** Modern (2026) handlers return stateless, multi-round `inputRequired(...)` descriptors; 2025 handlers await blocking `elicitInput()`. `elicitInput()` throws on modern connections. With its default `legacyShim: true`, SDK deliver modern `inputRequired(...)` returns to 2025 clients by issuing `elicitation/create`, `sampling/createMessage`, and `roots/list`; not enable `elicitInput()` for modern clients. Progress (`notify`) and cancellation (`signal`) work both eras.

## Steps

1. **Register owned clients before calls**: Advertise elicitation capabilities, bound auto-fulfillment with `inputRequired.maxRounds`, handle `elicitation/create` at construction. Client default 10 rounds; past it client rejects with `SdkError` (`INPUT_REQUIRED_ROUNDS_EXCEEDED`).

   ```ts
   const client = new Client(
     { name: 'client', version: '1.0' },
     {
       capabilities: { elicitation: { form: {} } },
       inputRequired: { maxRounds: 10 },
     },
   );
   client.setRequestHandler('elicitation/create', async (req) => {
     if (req.params.mode === 'url') return { action: 'decline' }; // mode is omitted on older form requests
     const content = await renderAndValidateJsonSchemaForm(
       req.params.message,
       req.params.requestedSchema,
     );
     return content === undefined ? { action: 'decline' } : { action: 'accept', content };
   });
   ```

   Host-implemented `renderAndValidateJsonSchemaForm()` (not SDK export) renders requested schema, resolves only validated content; `undefined` means user declined. Add URL capability + owned URL handler only when client can complete that flow.

   **Done:** Every owned client serving interaction advertises only supported modes, has bounded handler, returns content validated against requested schema.

2. **Make modern tool calls replay-safe**: Each answer restarts tool from beginning. Read `ctx.mcpReq.inputResponses` before returning `inputRequired`; use `acceptedContent(..., key, schema)` for accepted content, `inputResponse(...)` to exit clean on `decline` or `cancel`.

   ```ts
   server.registerTool(
     'deploy',
     { inputSchema: z.object({ env: z.string() }) },
     async ({ env }, ctx) => {
       const state = inputResponse(ctx.mcpReq.inputResponses, 'confirm');
       if (state?.kind === 'elicit' && state.action !== 'accept') {
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

   Use `inputRequired.elicit()` for form fields, `inputRequired.elicitUrl()` for redirects like OAuth. Migrate embedded sampling and roots flows off deprecated `inputRequired.createMessage()` and `inputRequired.listRoots()`.

   **Done:** Every modern interaction reads prior responses, returns each accepted path once, terminates every decline/cancel path.

3. **Carry sequential state in signed `requestState`**: Return opaque, HMAC-signed state value, read via `ctx.mcpReq.requestState<State>()`. Client round-trips value byte-for-byte — keep secrets out, reject tampered/expired values with `-32602 Invalid or expired requestState`.

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

   **Done:** Every multi-round flow stores state in verified codec, rejects invalid state before business logic, exposes no secret in payload.

4. **Report long work, honor cancellation**: Emit strictly increasing `notifications/progress` values for one `progressToken`. Pass `ctx.mcpReq.signal` to DB/HTTP work; check `signal.aborted` inside recursive work and loop conditions.

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

   **Done:** Each long-running path propagates abort signal, checks it during repeated work, emits monotonic progress when caller supplied token.

5. **Complete prompt arguments at schema**: Wrap prompt `argsSchema` fields with `completable(...)`. Define resource-template completion in template's `complete` map instead.

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

   **Done:** Every prompt argument needing completion uses `completable(...)`, every resource-template variable uses its template completion map.

6. **Serve confirmed 2025 connections through legacy branch**: Require client's `elicitation` capability, use form mode for standard data, URL mode for external redirects, return from handler on `decline`/`cancel`. Keep credentials, API keys out of forms. `requestedSchema` defaults JSON Schema 2020-12; declare `$schema` when porting draft-07. `ElicitResult.content` in form mode is submitted form fields as object (e.g. `{ rating: 5, comment: '…' }`) validated against `requestedSchema` — return schema-shaped object.

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

   **Done:** Each legacy-only flow has confirmed 2025 connection, supported client capability, declared schema dialect when needed, valid result content, terminating non-accept path.

7. **Retire 2025-only facilities**: Replace `ctx.mcpReq.requestSampling` with server direct-LLM-provider call only after recording provider, data-handling/retention policy, consent path, cost owner; stays functional for 2025 connections but throws for modern ones. Replace deprecated `ctx.mcpReq.log(level, data)` with stderr or OpenTelemetry.

   **Done:** Each direct LLM replacement has recorded provider, privacy/consent, cost decision; new interaction paths use neither sampling nor MCP logging; every retained legacy call isolated to confirmed 2025 branch.

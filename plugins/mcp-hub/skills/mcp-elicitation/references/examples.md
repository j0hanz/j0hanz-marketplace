---
description: Code examples for modern input_required, legacy elicitation, progress notifications, prompt autocompletion, and state management.
metadata:
  tags: [examples, mcp, code]
  source: internal
---

# MCP Interaction Examples

## Modern input_required Return (Recommended)

Mid-call user input is handled statelessly via `input_required` responses.

```ts
server.registerTool(
  'deploy',
  { inputSchema: z.object({ env: z.string() }) },
  async ({ env }, ctx) => {
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

## Legacy Elicitation (2025-era only)

> [!WARNING]
> Blocking `elicitInput()` throws on 2026-era connections. Use only on 2025-era connections; on 2026-era `elicitInput()` throws regardless of the shim. The `legacyShim` is unrelated — it serves `inputRequired(...)` returns to 2025-era clients by pushing real `elicitation/create` requests.

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

## Progress Notifications

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

## Client-Side Interaction

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

> Client-side `inputRequired.maxRounds` defaults to 10; the server-side `ServerOptions.inputRequired.maxRounds` defaults to **8** (tighter — the shim holds a live wire request open).

## Cross-round State (requestState)

```ts
const codec = createRequestStateCodec<{ step: string }>({
  key: crypto.getRandomValues(new Uint8Array(32)),
  ttlSeconds: 600,
});
const server = new McpServer(
  { name: 'app', version: '1.0' },
  { requestState: { verify: codec.verify } },
);
// Inside handler:
return inputRequired({
  inputRequests: { scope: inputRequired.elicit({/* … */}) },
  requestState: await codec.mint({ step: 'confirmed' }),
});
```

## Prompt Autocompletion (Completable)

```ts
import { completable } from '@modelcontextprotocol/server';
server.registerPrompt(
  'review',
  {
    argsSchema: z.object({
      lang: completable(z.string(), (val) => ['ts', 'js', 'py'].filter((l) => l.startsWith(val))),
    }),
  },
  ({ lang }) => ({
    messages: [{ role: 'user', content: { type: 'text', text: `Review ${lang}` } }],
  }),
);
```

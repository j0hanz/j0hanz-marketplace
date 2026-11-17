---
name: mcp-elicitation
description: Use when an MCP server tool needs input from the end user mid-call (a confirmation, a missing value, a sign-in, a secret), or when writing or reviewing code that uses inputRequired, elicitInput, elicitation/create, requestState, or the elicitation client capability.
---

# MCP elicitation

A tool asks the **end user** (not the model) for input while it runs. In TypeScript SDK v2 (`@modelcontextprotocol/server`), write every elicitation **write-once**: the handler returns `inputRequired(...)`, and the client calls again with the answers. On each entry the handler works out where it is and asks only for what is still missing. The principles hold in any SDK.

## Where one handler reaches

| Connection                                             | `inputRequired` return                                     |
| :----------------------------------------------------- | :--------------------------------------------------------- |
| 2026-07-28                                             | Native multi-round-trip                                    |
| 2025, stdio                                            | Legacy shim pushes `elicitation/create`                    |
| 2025, sessionful Streamable HTTP + SSE                 | Legacy shim pushes                                         |
| 2025, `createMcpHandler` default `legacy: 'stateless'` | Never asks: those users always get the gate's fallback     |
| 2025, `enableJsonResponse`                             | Each round waits out `roundTimeoutMs` (10 min), then fails |

Serve interactive tools on a transport with a return path, and never in JSON-response mode. The sessionful `NodeStreamableHTTPServerTransport` arm serves only 2025 traffic.

**Identity** comes from the request's auth, never from a form answer: `ctx.http?.authInfo`. Its `clientId` is the OAuth client, not the user, so have the token verifier put the user's subject in `authInfo.extra`.

## Decide whether to elicit

| Situation                                | Do                                 |
| :--------------------------------------- | :--------------------------------- |
| Model can supply the value               | Put it in `inputSchema`            |
| Only the user knows it, non-sensitive    | Form elicitation                   |
| Irreversible action                      | Form confirmation bound to target  |
| Secret, payment, third-party OAuth       | URL elicitation                    |
| Later question depends on earlier answer | Chained rounds with `requestState` |

Names, emails and usernames may go in a form. Secrets, tokens and payment details may not: form answers land in the model's context. Form messages contain no clickable links.

## The handler's contract

Every handler has four parts, in this order.

### 1. Capability gate

Read the client's declared capabilities before asking. The SDK checks only after the handler returns. It then refuses with `-32021` (2026) or an `isError` "did not declare the required capability" result (2025), and the model gets no next step. The gate is the only way to turn that refusal into a readable result.

```ts
import {
  CLIENT_CAPABILITIES_META_KEY,
  type ClientCapabilities,
  type McpServer,
} from '@modelcontextprotocol/server';

// 2026 requests carry capabilities per request; 2025 sessions declared them at initialize.
// Cast: SDK typings declare the envelope as {}, which strict TS will not index (TS7053).
function elicitModes(server: McpServer, envelope: unknown) {
  const caps = ((envelope as Record<string, unknown> | undefined)?.[CLIENT_CAPABILITIES_META_KEY] ??
    server.server.getClientCapabilities()) as ClientCapabilities | undefined;
  const e = caps?.elicitation;
  return {
    form: e !== undefined && (e.form !== undefined || Object.keys(e).length === 0), // spec: bare {} = form
    url: e?.url !== undefined,
  };
}
```

Pick the fallback by action class:

| Missing mode, tool is         | Return                                                         |
| :---------------------------- | :------------------------------------------------------------- |
| Destructive or paid           | Refuse: nothing done, do not retry from this client            |
| Needs a non-secret value      | Ask the model to collect it in chat, pass as optional argument |
| Needs the server's own secret | Setup steps (env var, config)                                  |
| Needs user's secret or OAuth  | Where to connect (your connect page), then call again          |

### 2. Outcome per action

Read the answer with `inputResponse(ctx.mcpReq.inputResponses, key)`. Its `kind` is `missing`, `elicit`, `sampling` or `roots`; the `elicit` view also carries `action`. Give each outcome its **own** result:

| Outcome   | Meaning           | Result                                  |
| :-------- | :---------------- | :-------------------------------------- |
| `missing` | Not asked yet     | Return `inputRequired(...)`             |
| `accept`  | User submitted    | Validate, then act                      |
| `decline` | User said no      | Plain text, `isError` unset             |
| `cancel`  | User dismissed it | Plain text: not answered, may ask again |

A decline is an answer, not a failure. Keep `isError` for real failures so the model can tell "the user said no" from "something broke". On the push path (`elicitInput`), read `result.action` the same way.

### 3. Validate accepted content

Call `acceptedContent(ctx.mcpReq.inputResponses, key, zodSchema)`. Validated is not the same as meaning yes: check the answer binds to the target before acting.

A wrong answer gets a plain result ("not done: name did not match"), not another question.

### 4. Act, idempotently

Retries resend the final round, and sealed state is not single-use. Key the side effect so a repeat is a no-op. In a chained flow, mint the idempotency key in an early round and carry it in `requestState`. Return backend errors as an `isError` result.

## Form schema

Pass a zod object as `requestedSchema`; the SDK converts it. The wire takes only a **flat** object of these:

| Use                                                                                 | Avoid (`TypeError` when the request is built) |
| :---------------------------------------------------------------------------------- | :-------------------------------------------- |
| `z.string().min().max()`                                                            | `.regex()`                                    |
| `z.email()`, `z.url()`, `z.iso.date()`, `z.iso.datetime()`                          | `z.uuid()`, `z.email({ pattern })`            |
| `z.number()` / `.int()` with `.min()` / `.max()`                                    | `.positive()`, `.gt()`, `.lt()`               |
| `z.boolean()`                                                                       | `.nullable()`                                 |
| `z.enum([...])`, `z.literal(['a', 'b'])`, `z.array(z.enum([...]))` for multi-select | union of literals, numeric enum               |
| `.optional()`, `.default()`, `.meta({ title })`                                     | nested `z.object`                             |

Refinements and transforms the wire cannot advertise still hold on re-entry, because `acceptedContent` validates with the original schema. Raw JSON Schema is sent unchecked: a nested object or a `pattern` breaks compliant clients with no server error.

## Example: confirm a delete

```ts
import {
  acceptedContent,
  inputRequired,
  inputResponse,
  type CallToolResult,
  type InputRequiredResult,
  type McpServer,
} from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

const confirmSchema = z.object({
  name: z.string().meta({ title: 'Type the dataset name to delete it' }),
});
const text = (t: string, isError?: true): CallToolResult => ({
  content: [{ type: 'text', text: t }],
  ...(isError && { isError }),
});

// deleteDataset must resolve without error when the dataset is already gone (idempotent).
export function registerDeleteDataset(
  server: McpServer,
  deleteDataset: (name: string) => Promise<void>,
) {
  server.registerTool(
    'delete-dataset',
    {
      description: 'Permanently delete a dataset after the user confirms',
      inputSchema: z.object({ name: z.string().min(1) }),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async ({ name }, ctx): Promise<CallToolResult | InputRequiredResult> => {
      const q = JSON.stringify(name);
      if (!elicitModes(server, ctx.mcpReq.envelope).form) {
        // elicitModes: the gate helper in section 1
        return text(
          `Nothing deleted: this client cannot show a confirmation, so ${q} cannot be deleted from here. Do not retry from this client.`,
        );
      }

      const view = inputResponse(ctx.mcpReq.inputResponses, 'confirm');
      if (view.kind === 'missing') {
        return inputRequired({
          inputRequests: {
            confirm: inputRequired.elicit({
              message: `Permanently delete ${q}? This cannot be undone.`,
              requestedSchema: confirmSchema,
            }),
          },
        });
      }
      if (view.kind !== 'elicit') return text(`Unexpected response; ${q} was not deleted.`, true);
      if (view.action === 'decline') return text(`User declined. ${q} was not deleted.`);
      if (view.action === 'cancel')
        return text(
          `User dismissed the confirmation. ${q} was not deleted; ask again if they still want it.`,
        );

      // A typed name binds the confirmation to this dataset; a checkbox would not.
      if (acceptedContent(ctx.mcpReq.inputResponses, 'confirm', confirmSchema)?.name !== name) {
        return text(`Typed name did not match. ${q} was not deleted.`);
      }
      try {
        await deleteDataset(name);
      } catch (err) {
        return text(
          `Deleting ${q} failed: ${err instanceof Error ? err.message : String(err)}`,
          true,
        );
      }
      return text(`Deleted ${q}.`);
    },
  );
}
```

## Rounds and `requestState`

- Put independent questions in one round's `inputRequests` map. Chain rounds only when a question depends on an earlier answer.
- Each re-entry carries only the latest round's answers. Earlier answers survive only in `requestState`.
- `requestState` is the only memory between rounds, and it comes back from the client. Seal it:
  - Wire it with `createRequestStateCodec({ key, ttlSeconds, bind })` and `{ requestState: { verify: codec.verify } }` in the `McpServer` options.
  - Tampered, expired or rebound state gets `-32602` before the handler runs.
  - Read it back with `ctx.mcpReq.requestState<T>()`.
- The key is at least 32 bytes. Load it from shared config whenever more than one instance serves requests.
- `bind: ctx => <authenticated principal>` ties the state to the user. With `bind` set, call `codec.mint(payload, ctx)`.
- In the payload, put the tool arguments that matter (or their hash), and reject a re-entry whose arguments differ. Mint only from already-validated answers. Store IDs, never secrets: the codec signs, it does not encrypt.
- `ttlSeconds` defaults to 600 and restarts on every mint. Size it for human think time: an expired form becomes `-32602`, not a call to your handler.
- Re-asking is capped at 8 rounds on the 2025 shim and 10 in the SDK client. After a bad answer, return a result instead of re-asking forever.

## URL mode

URL mode means you build and host a web page. Even a "keep it simple" secret request still needs the page, its auth, and a server-side store.

1. Point the URL at **your own** connect page, never straight at a third-party authorize endpoint. The URL:
   - uses HTTPS;
   - carries only an opaque flow ID;
   - holds no PII, no tokens, nothing that grants access by itself.
2. The page authenticates the visitor and checks they are the user who started the flow before redirecting onward. This is the spec's anti-phishing MUST.
3. Write-once:
   1. Mint a flow ID.
   2. Return `inputRequired.elicitUrl({ message, url })`, with the ID in the URL and in `requestState` bound to the user.
   3. On re-entry, read the answer with `inputResponse`. `acceptedContent` is always `undefined` in URL mode.
4. **Accept means opened.** The user agreed to open the page, not that they finished. Look up your own record by flow ID plus user. If the record is missing, return "sign-in not finished; call again when done". A URL flow normally ends with a second call.
5. Key stored records by the authenticated subject, never by MCP session ID alone. Flow tokens stay on the server and never appear in a tool result. URL mode is not how users sign in to your own MCP server; that is MCP authorization (see `mcp-auth`).

Write-once re-entry sketch. `codec` is bound to the user. `connectUrl` and `findRecord` are your page and your store.

```ts
const state = ctx.mcpReq.requestState<{ flowId: string }>();
if (state) {
  if (await findRecord(state.flowId, userId)) return text('Connected.');
  const view = inputResponse(ctx.mcpReq.inputResponses, 'auth');
  if (view.kind === 'elicit' && view.action !== 'accept')
    return text(
      `Sign-in ${view.action === 'decline' ? 'declined' : 'dismissed'}; nothing connected.`,
    );
  return text('Sign-in not finished. Call this tool again once the browser page says done.');
}
const flowId = crypto.randomUUID();
return inputRequired({
  inputRequests: {
    auth: inputRequired.elicitUrl({
      message: 'Sign in to connect your account',
      url: connectUrl(flowId),
    }),
  },
  requestState: await codec.mint({ flowId }, ctx),
});
```

**Holding one call open until the callback** is the 2025-only push path: `notifications/elicitation/complete` exists on 2025-11-25 connections only. Branch on the `era` your `createMcpHandler`/`serveStdio` factory receives (`'legacy'` | `'modern'`).

1. In the handler, mint an `elicitationId` and store `server.server.createElicitationCompletionNotifier(elicitationId, { relatedRequestId: ctx.mcpReq.id })` under it. The call **returns the sender function**; it sends nothing yet.
2. Await `ctx.mcpReq.elicitInput({ mode: 'url', message, url, elicitationId }, { timeout: 10 * 60_000, signal: ctx.mcpReq.signal })`. Delete the stored sender in `finally`.
3. Your callback endpoint looks up the sender by `elicitationId` and **calls** it, which sends `notifications/elicitation/complete`.
4. The client's own `tools/call` timeout (60 s default) still runs, so the caller raises it too. Send `notifications/progress` when the request has a `progressToken`, and document that clients need `resetTimeoutOnProgress`.
5. The callback must reach the same process. A fleet needs session affinity or pub/sub.

## Checklist

- Model-supplied values going into a URL or message are encoded or quoted.
- The final side effect is idempotent.
- Every `isError: true` is a real failure, never the user's choice.

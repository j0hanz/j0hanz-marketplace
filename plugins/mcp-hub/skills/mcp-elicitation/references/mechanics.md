---
description: Detailed explanation of MCP mid-call interaction mechanics (input required, progress, cancellation, client setup, autocomplete, cross-round state, and deprecated surfaces).
metadata:
  tags: [mcp, mechanics, input-required, autocomplete, request-state]
  source: internal
---

# MCP Elicitation Mechanics

## 1. Legacy vs. Modern Interaction Era

Modern 2026-era connections use stateless, multi-round return patterns rather than blocking the execution thread. The SDK transparently handles legacy clients if `inputRequired.legacyShim` is enabled (default `true`).

Only the ask-user mechanism changed across eras (`elicitInput()` → `inputRequired(...)`); progress (`notify`) and cancellation (`signal`) APIs are identical in both.

## 2. Asking for Input: `input_required` (Modern)

Instead of blocking mid-call, the handler returns `inputRequired(...)` and the client re-runs the entire call from the top once the user answers.

- **Check Responses First**: Check `ctx.mcpReq.inputResponses` before prompting. The handler re-runs from scratch, so answered fields must not be re-requested.
- **Request Formats**: Build requests with `inputRequired.elicit()` (form fields), `inputRequired.elicitUrl()` (URL redirection), `inputRequired.createMessage()` (deprecated embedded form of sampling per SEP-2577 — ask the client's model to complete a prompt) and `inputRequired.listRoots()` (deprecated embedded form of roots — ask the client for its workspace paths). Prefer `inputRequired.elicit()` / `elicitUrl()` for new code.
- **Read Answers**: Read using `acceptedContent(ctx.mcpReq.inputResponses, key, schema)`, which returns `undefined` if missing, declined, or cancelled.
- **Check Refusals**: Use `inputResponse(ctx.mcpReq.inputResponses, key)` to inspect action states (`accept`, `decline`, `cancel`) and prevent infinite prompting loops.

## 3. Legacy Elicitation (`elicitInput`)

The blocking `ctx.mcpReq.elicitInput()` API pauses handler execution until the client responds. **This throws on modern 2026-era connections.**

- Requires the client to support the `elicitation` capability.
- **Form Mode**: Used for standard inputs. NEVER request secrets (credentials, API keys) via forms.
- **URL Mode**: Redirects the user outside the chat (e.g. for OAuth login).

## 4. Progress Notifications

Call `ctx.mcpReq.notify(...)` with a `notifications/progress` message keyed on `progressToken`. The `progress` value must strictly increase across updates for the same token.

## 5. Client-Side Setup

Clients must register the `elicitation/create` handler at construction. Configure `inputRequired: { maxRounds }` to set a boundary on how many round trips auto-fulfillment attempts before failing.

## 6. Prompt Autocompletion (`completable`)

While `input_required` handles mid-call interaction, gathering prompt arguments beforehand uses `completable` schemas. Use the `completable` wrapper on Zod schemas to register autocomplete suggestion handlers.

## 7. Cross-round state — `requestState`

For sequential `input_required` flows, return an opaque string the client echoes byte-for-byte; read it back with `ctx.mcpReq.requestState<State>()`. It round-trips through the client, so it is **attacker-controlled** — protect it with the HMAC codec and mint only what earlier rounds already proved.

See [Cross-round State (requestState) example](examples.md#cross-round-state-requeststate).

Tampered or expired state answers `-32602 Invalid or expired requestState` and never reaches the handler. The codec is **signed, not encrypted** — keep secrets out of the payload.

## 8. Deprecated: sampling and MCP logging (SEP-2577)

- **Sampling** (`ctx.mcpReq.requestSampling`) routed an LLM call through the client. Migrate: call the LLM provider's API directly from the server. Functional ≥ 12 months on 2025-era connections; throws on 2026-era.
- **MCP logging** (`ctx.mcpReq.log(level, data)`) is deprecated — prefer stderr or OpenTelemetry.

---
name: mcp-planning
description: Plan: MCP SDK v2 design decisions before implementation; [mcp-router] owns workflows, [mcp-server] and [mcp-client] own builds.
user-invocable: false
metadata:
  category: technique
---

# MCP Planning

**Decide-first.** Record implementation choices before writing MCP server or client code.

## Steps

1. **Inspect the project**: Find every `@modelcontextprotocol/` dependency and import. v2 uses several scoped packages, so inspect each rather than searching for one package name.

   **Done:** Existing MCP code, dependencies, schema libraries, and runtime constraints are identified.

2. **Resolve the decision set**: Evaluate every trigger in [Decisions](#decisions). Ask about each triggered decision; apply the stated default to every other decision.

   **Done:** All 15 decisions have an explicit value, every remote HTTP Auth value is explicit, and every non-default value is traced to a question.

3. **Ask tightly**: Ask one triggered question per turn. Offer the two stated choices; Auth asks its access gate first and its three method choices only when authenticated, while Era has three choices. Re-ask one vague answer, then use the first listed choice. Treat “you choose” as that default choice.

   **Done:** Each asked decision has one unambiguous selected value.

4. **Write the record**: List all 15 decisions in the [record format](#record-format), marking each `(asked)` or `(default)`.

   **Done:** The record is exhaustive and every entry carries one source tag.

5. **Append the dated section**: Add the completed record to `docs/mcp-decisions.md`, creating it when absent and preserving every earlier dated section.

   **Done:** `docs/mcp-decisions.md` has the new complete dated section and its prior sections are unchanged.

6. **Present the result**: Show the completed record before implementation begins.

   **Done:** The user has the exact recorded decisions that guide the implementation.

## Decisions

1. **Scope** (default `server`) — Ask when the codebase does not establish server versus client. Choices: Server | Client.
2. **Transport** (default `stdio`) — Ask for remote, multi-user, or deployed use. Choices: stdio | Streamable HTTP. **Gotcha:** current SSE and WebSocket transports are absent; frozen SSE remains at `@modelcontextprotocol/server-legacy/sse`.
3. **Auth** (default `none` for local or stdio use) — For every remote HTTP deployment, ask: Authenticated | Private no-auth. Record `none` only for an explicit private deployment; public endpoints use [mcp-auth]. When authenticated, choose: OAuth (client `OAuthClientProvider`; server `requireBearerAuth`) | Custom bearer (client `AuthProvider`; server `verifyAccessToken`) | Legacy authorization-server helpers (`server-legacy/auth`). **Gotchas:** token endpoints require `https:` except loopback (`InsecureTokenEndpointError`, SEP-2207); key credentials by `ctx.issuer` (SEP-2352).
4. **Tool Surface** (default `Few simple`) — Ask for more than three tools or complex operations. Choices: Many simple | Few big with settings.
5. **Input Schemas** (default Standard Schema via `zod ^4.2.0`) — Silently retain the project’s existing Standard Schema library; otherwise use zod. Use `fromJsonSchema()` only for existing raw JSON Schema.
6. **Interaction** (default `Request-response`) — Ask for long-running work or required user input. Choices: Progress/Cancel | Multi-round-trip.
7. **Prompts** (default `None`) — Ask for reusable or UI-integrated prompts. Choices: Static | Completable.
8. **Error Strategy** (default `Protocol errors only`) — Apply without a question.
9. **Distribution** (default `Local`) — Ask for publishing or sharing. Choices: npm | Local.
10. **Testing** (default `1 test per tool`) — Apply without a question.
11. **Session/Resumability** (default `Stateless`) — Ask when HTTP needs multi-request client state. Choices: Stateless | `EventStore`-backed resumable sessions.
12. **Notifications** (default `None`) — Ask when clients need list or data change updates. Choices: `subscriptions/listen` stream | None.
13. **Era / Protocol Revision** (default both eras, `legacy: 'stateless'`) — Ask only when modern 2026 behavior is required. **Three choices:** Both eras (`legacy: 'stateless'`) | Modern only (`legacy: 'reject'`) | 2025-era only (hand-wired `*StreamableHTTPServerTransport`; no `createMcpHandler` or `legacy:` setting).
14. **Runtime** (default Node ≥20, ESM-first) — Apply without a question; v2 also ships a CommonJS build.
15. **Staging** (default `one-shot`) — Ask when a large, multi-directory codebase already uses SDK v1. Choices: one-shot | stage by directory. Execute the selected posture in [mcp-migration] step 1.

## Record Format

Append a dated section to `docs/mcp-decisions.md` that lists every decision:

```markdown
# MCP Decision Record — YYYY-MM-DD

1. Scope: server exposing 4 tools. (asked)
2. Transport: stdio. (default)
3. Auth: none. (default)
4. Tool Surface: few simple tools. (default)
5. Input Schemas: zod ^4.2.0. (default)
6. Interaction: request-response. (default)
7. Prompts: none. (default)
8. Error Strategy: protocol errors only. (default)
9. Distribution: local. (default)
10. Testing: 1 test per tool. (default)
11. Session/Resumability: stateless. (default)
12. Notifications: none. (default)
13. Era / Protocol Revision: both eras (legacy: 'stateless'). (default)
14. Runtime: Node ≥ 20, ESM-first. (default)
15. Staging: one-shot. (default)
```

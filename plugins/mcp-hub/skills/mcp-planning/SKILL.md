---
name: mcp-planning
description: Plan: MCP SDK v2 design decisions before implementation; mcp-router owns workflows, mcp-server and mcp-client own builds.
user-invocable: false
metadata:
  category: technique
---

# MCP Planning

**Decide-first.** Record implementation choices before write MCP server or client code.

## Steps

1. **Inspect project**: Find every `@modelcontextprotocol/` dependency and import. v2 use several scoped packages, so inspect each rather than search one package name.

   **Done:** Existing MCP code, dependencies, schema libraries, runtime constraints identified.

2. **Resolve decision set**: Evaluate every trigger in [Decisions](#decisions). Ask about each triggered decision; apply stated default to every other decision.

   **Done:** All 16 decisions have explicit value, every remote HTTP Auth value explicit, every non-default value traced to question.

3. **Ask tight**: Ask one triggered question per turn. Offer two stated choices; Auth ask its access gate first, three method choices only when authenticated, Era has three choices. Re-ask one vague answer, then use first listed choice. Treat "you choose" as that default choice.

   **Done:** Each asked decision has one unambiguous selected value.

4. **Write record**: List all 16 decisions in [record format](#record-format), mark each `(asked)` or `(default)`.

   **Done:** Record exhaustive, every entry carries one source tag.

5. **Append dated section**: Add completed record to `docs/mcp-decisions.md`, create when absent, preserve every earlier dated section.

   **Done:** `docs/mcp-decisions.md` has new complete dated section, prior sections unchanged.

6. **Present result**: Show completed record before implementation begins.

   **Done:** User has exact recorded decisions guiding implementation.

## Decisions

1. **Scope** (default `server`) — Ask when codebase not establish server versus client. Choices: Server | Client.
2. **Transport** (default `stdio`) — Ask for remote, multi-user, or deployed use. Choices: stdio | Streamable HTTP. **Gotcha:** current SSE and WebSocket transports absent; frozen SSE remains at `@modelcontextprotocol/server-legacy/sse`.
3. **Auth** (default `none` for local or stdio use) — For every remote HTTP deployment, ask: Authenticated | Private no-auth. Record `none` only for explicit private deployment; public endpoints use [mcp-auth](../mcp-auth/SKILL.md). When authenticated, choose: OAuth (client `OAuthClientProvider`; server `requireBearerAuth`) | Custom bearer (client `AuthProvider`; server `verifyAccessToken`) | Legacy authorization-server helpers (`server-legacy/auth`) | Machine auth (client `ClientCredentialsProvider` for `client_credentials` grant, `PrivateKeyJwtProvider` for `private_key_jwt` (RFC 7523), or `CrossAppAccessProvider` for cross-app access (SEP-990); for non-human callers such as jobs, backends, service accounts). **Gotchas:** token endpoints require `https:` except loopback (`InsecureTokenEndpointError`, SEP-2207); key credentials by `ctx.issuer` (SEP-2352).
4. **Tool Surface** (default `Few simple`) — Ask for more than three tools or complex operations. Choices: Many simple | Few big with settings.
5. **Input Schemas** (default Standard Schema via `zod ^4.2.0`) — Silently retain project's existing Standard Schema library; otherwise use zod. Use `fromJsonSchema()` only for existing raw JSON Schema.
6. **Interaction** (default `Request-response`) — Ask for long-running work or required user input. Choices: Progress/Cancel | Multi-round-trip.
7. **Prompts** (default `None`) — Ask for reusable or UI-integrated prompts. Choices: Static | Completable.
8. **Error Strategy** (default `Protocol errors only`) — Apply without question.
9. **Distribution** (default `Local`) — Ask for publishing or sharing. Choices: npm | Local.
10. **Testing** (default `1 test per tool`) — Apply without question.
11. **Session/Resumability** (default `Stateless`) — Ask when HTTP need multi-request client state. Choices: Stateless | `EventStore`-backed resumable sessions.
12. **Notifications** (default `None`) — Ask when clients need list or data change updates. Choices: `subscriptions/listen` stream | None.
13. **Era / Protocol Revision** (default both eras, `legacy: 'stateless'`) — Ask only when modern 2026 behavior required. **Three choices:** Both eras (`legacy: 'stateless'`) | Modern only (`legacy: 'reject'`) | 2025-era only (hand-wired `*StreamableHTTPServerTransport`; no `createMcpHandler` or `legacy:` setting).
14. **Runtime** (default Node ≥20, ESM-first) — Apply without question; v2 also ships CommonJS build.
15. **Staging** (default `one-shot`) — Ask when large, multi-directory codebase already uses SDK v1. Choices: one-shot | stage by directory. Execute selected posture in [mcp-migration](../mcp-migration/SKILL.md) step 1.
16. **Elicitation** (default `None`) — Ask when handler must question end user mid-call. Choices: `ctx.mcpReq.elicitInput` (form mode with `requestedSchema`, or URL mode with `url` + `elicitationId`; client must declare matching `elicitation` capability) | None. For tools/call, prompts/get, and resources/read handlers requesting input mid-call on older protocol revisions where `elicitInput` throws, return `input_required` result type instead.

## Record Format

Append dated section to `docs/mcp-decisions.md` listing every decision:

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
16. Elicitation: none. (default)
```

---
name: mcp-planning
description: Use when making MCP design decisions before code (server or client); not for routing/workflows (mcp-router) or the build itself ([mcp-server]/[mcp-client]).
user-invocable: false
metadata:
  category: technique
---

# MCP Planning

Decide-first — make and record all MCP design decisions before writing any code.

`Search imports -> ask triggered questions -> record all 15 decisions -> append docs/mcp-decisions.md -> present`

## When to Use

- The "Clarify" step of `/mcp build`.

## Steps

1. **Search**: Grep the project for `@modelcontextprotocol/` imports and dependencies before asking anything — v2 splits the SDK into scoped packages (`@modelcontextprotocol/{server,client,core,…}`), so a migrated codebase yields several hits, not one.
   - [ ] Project searched for every `@modelcontextprotocol/` import or dependency, including scoped v2 packages.
2. **Determine Triggers**: Check each of the 15 decisions below against its trigger. A decision whose trigger fires gets a question; every other decision silently takes its safe default.
   - [ ] Every one of the 15 decisions resolved — triggered ones asked, the rest defaulted.
3. **Query**: Ask only the triggered questions, one at a time, offering exactly two choices each (three only where marked below). A vague answer gets one re-ask before falling back to the first-listed choice; "you choose" skips straight to the first-listed choice.
   - [ ] No more than one question asked per turn; each asked question offered exactly two choices (three only for Auth and Era).
4. **Synthesize**: Write out all 15 decisions as a numbered list, each tagged `(asked)` or `(default)` — see Record Format.
   - [ ] All 15 decisions appear in the record, each explicitly tagged `(asked)` or `(default)`.
5. **Append**: Add a new dated section to `docs/mcp-decisions.md` (create the file if it doesn't exist yet); never edit or remove earlier dated records.
   - [ ] `docs/mcp-decisions.md` contains a new dated record; no prior record was edited or removed.
6. **Present**: Show the user the completed record.
   - [ ] The full record was shown to the user.

## Decisions

1. **Scope** (Default: `server`) — Ask if unclear. Choices: Server | Client.
2. **Transport** (Default: `stdio`) — Ask if remote, multi-user, or deployed. Choices: stdio | Streamable HTTP. (SSE/WebSocket transports are removed — SSE is frozen at `@modelcontextprotocol/server-legacy/sse`.)
3. **Auth** (Default: `none`) — Ask if HTTP. **Three choices** (load-bearing exception to the two-choice rule): OAuth (client `OAuthClientProvider`; server verifies via `requireBearerAuth`) | Custom bearer (client `AuthProvider`; server custom `verifyAccessToken`) | Legacy AS helpers (`server-legacy/auth`). Gotcha: `InsecureTokenEndpointError` if the token endpoint isn't `https:` (loopback exempt, SEP-2207); key credentials by `ctx.issuer` (SEP-2352).
4. **Tool Surface** (Default: `Few simple`) — Ask if >3 tools or complex. Choices: Many simple | Few big with settings.
5. **Input Schemas** (Default: Standard Schema via `zod ^4.2.0`) — Never ask; silently match the project's existing library if one is already in use. Alternatives: zod `^4.2.0` | ArkType | Valibot (all native Standard Schema) | raw JSON Schema via `fromJsonSchema()`.
6. **Interaction** (Default: `Request-response`) — Ask if long-running tasks or user input needed. Choices: Progress/Cancel | Multi-round-trip.
7. **Prompts** (Default: `None`) — Ask if reusable or UI-integrated. Choices: Static | Completable.
8. **Error Strategy** (Default: `Protocol errors only`) — Never ask.
9. **Distribution** (Default: `Local`) — Ask if publishing or sharing. Choices: npm | Local.
10. **Testing** (Default: `1 test per tool`) — Never ask.
11. **Session/Resumability** (Default: `Stateless` — no session) — Ask if HTTP with multi-request client state needed. Choices: Stateless | `EventStore`-backed resumable sessions.
12. **Notifications** (Default: `None`) — Ask if clients need list-change or data-change push updates. Choices: `subscriptions/listen` stream | None.
13. **Era / Protocol Revision** (Default: `legacy: 'stateless'`) — Ask only if the modern (2026) spec is required. **Three choices** (load-bearing exception): Both eras (`legacy: 'stateless'`) | modern (2026) only (`legacy: 'reject'`) | 2025-era stack only (hand-wired `*StreamableHTTPServerTransport`; no `createMcpHandler`; no `legacy:` setting applies).
14. **Runtime** (Default: Node ≥ 20, ESM-first) — Never ask. v2 is ESM-first but ships CJS too.
15. **Staging** (Default: one-shot) — Ask if a large, multi-directory codebase is already on SDK v1. Choices: one-shot | stage-by-directory. Execution: [mcp-migration] Step 1.

> Two-choice rule: every decision offering **Choices** presents exactly two options except items 3 and 13, which carry a third load-bearing choice. (Item 5's **Alternatives** are silent-match only, never posed as a question, so the rule doesn't bind it.)

## Record Format

`docs/mcp-decisions.md` — every run appends a new dated section listing all 15 decisions, each tagged `(asked)` or `(default)`:

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

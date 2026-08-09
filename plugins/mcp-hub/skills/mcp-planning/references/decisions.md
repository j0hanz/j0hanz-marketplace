---
description: >-
  Reference mapping for the 14 core MCP design decisions, safe defaults, trigger conditions, and choices.
metadata:
  tags: [decisions, planning, defaults, triggers]
  source: internal
---

# MCP Decisions & Safe Defaults

This reference contains the 14 core decisions, safe defaults, triggers, and choices for the MCP interview.

1. **Scope** (Default: `server`): Ask if unclear. Choices: Server | Client
2. **Transport** (Default: `stdio`): Ask if remote/multi-user/deploy. Choices: stdio | HTTP
3. **Auth** (Default: `none`): Ask if HTTP. Choices: OAuth (client: `OAuthClientProvider`; server verifies via `requireBearerAuth`) | Custom bearer (client: `AuthProvider`; server: custom `verifyAccessToken`) | Legacy AS helpers (`server-legacy/auth`)
4. **Tool Surface** (Default: `Few simple`): Ask if >3 tools/complex. Choices: Many simple | Few big with settings
5. **Input schemas** (Default: `Zod on all`): Never ask.
6. **Interaction** (Default: `Request-response`): Ask if long tasks/user input. Choices: Progress/Cancel | Multi-round-trip
7. **Prompts** (Default: `None`): Ask if reusable/UI integration. Choices: Static | Completable
8. **Error Strategy** (Default: `Protocol errors only`): Never ask.
9. **Distribution** (Default: `Local`): Ask if publishing/sharing. Choices: npm | Local
10. **Testing** (Default: `1 test/tool`): Never ask.
11. **Session/Resumability** (Default: `Stateless (no session)`): Ask if HTTP + multi-request client state needed. Choices: Stateless | `EventStore`-backed resumable sessions (on 2026-07-28 era, state is per-request via `requestState`, not session-based)
12. **Notifications** (Default: `None`): Ask if clients need list-change/data-change push updates. Choices: `subscriptions/listen` stream | None
13. **Era / protocol revision** (Default: `legacy: 'stateless'`): Ask only if the modern (2026) spec is required. Choices: Both eras (`legacy: 'stateless'`) | modern (2026) spec only (`legacy: 'reject'`) | stay on the 2025-era stack (hand-wired `*StreamableHTTPServerTransport`; no `createMcpHandler` — no `legacy:` setting applies).
14. **Runtime** (Default: Node ≥ 20, ESM-first): Never ask. v2 is ESM-first but ships CJS too. Choices: Node ≥20 (fixed)

> Two-Choices rule: offer exactly two options unless the reference specifies a third load-bearing choice (items 3 and 13).

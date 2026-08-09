---
name: mcp-migration
description: Use when migrating an MCP codebase from SDK v1 to v2 or applying codemods/renames manually — typically loaded alongside the mcp-migrator agent, which runs the codemod.
user-invocable: false
metadata:
  category: technique
---

# Migrating MCP SDK v1 to v2

Upgrades from `@modelcontextprotocol/sdk` v1 to split v2 packages on Node ≥ 20. Official docs: https://ts.sdk.modelcontextprotocol.io/v2/

Flow: `scope → codemod → flags → packages → modernize → mcpserver → tsconfig → verify → era`

## Steps

1. **Confirm Scope**: Ensure the codebase actually contains `@modelcontextprotocol` dependencies or legacy v1 imports.

- [ ]: Codebase confirmed to contain `@modelcontextprotocol` dependencies or legacy v1 imports.

2. **Execute Codemod**: Run the official migrator codemod CLI — see [codemod-reference.md](references/codemod-reference.md) for the `npx` invocation and [tables.md](references/tables.md) for the rename mappings it applies.

- [ ]: Official migrator codemod CLI executed successfully.

3. **Resolve Flags**: Find and manually resolve all `@mcp-codemod-error` inline comments — see [codemod-reference.md](references/codemod-reference.md) for the `grep` command.

- [ ]: All `@mcp-codemod-error` inline comments are found and resolved.

4. **Update Packages**: Convert deprecated `@modelcontextprotocol/sdk` dependencies to appropriate v2 packages from [references/tables.md](references/tables.md). Load `@modelcontextprotocol/server-legacy/sse` (subpath) if using `SSEServerTransport`.

- [ ]: Deprecated `@modelcontextprotocol/sdk` deps converted to split v2 packages; SSE uses `@modelcontextprotocol/server-legacy/sse`.

5. **Modernize State & Flow**:
   - Change blocking `elicitInput` calls to stateless `inputRequired(...)` returns — `elicitInput` still exists as `ctx.mcpReq.elicitInput` for 2025-era connections but throws on 2026-era (import `inputRequired` from `@modelcontextprotocol/server`).
   - Employ `requestState` context properties for multi-round communication.
   - Replace legacy `list_changed` events with modern `subscriptions/listen` streams.

- [ ]: `elicitInput`→`inputRequired`, `requestState` wired for multi-round flows, `list_changed`→`subscriptions/listen`.

6. **Adopt McpServer**: Change low-level `Server` implementations to modern `McpServer` where appropriate to automate capability registration, and transition to Standard Schema objects (e.g. `z.object(...)` from zod ≥4.2.0; ArkType as-is; Valibot via `@valibot/to-json-schema`).

- [ ]: Low-level `Server`→`McpServer` where appropriate; Standard Schema objects adopted.

7. **Transition TS Config**: Configure `tsconfig.json` modules to `"NodeNext"`, `"moduleResolution": "NodeNext"` and set `"type": "module"` in `package.json` for ESM (recommended). v2 is ESM-first but ships a CommonJS build too, so CommonJS projects can `require('@modelcontextprotocol/…')` directly — no dynamic `import()` shim required.

- [ ]: The app uses modern ECMAScript Modules (ESM) with a verified `NodeNext` resolution context.

8. **Verify with Tests**: Validate code functionality using [mcp-test] integration and unit assertions.

- [ ]: Tests via [mcp-test] compile and pass against the migrated code; no references to the legacy `@modelcontextprotocol/sdk` package remain in `package.json` or source files.

9. **Adopt Era Posture**: Choose the 2026-07-28 posture (`legacy: 'stateless'` to serve both eras, `'reject'` for modern-only) per [mcp-planning] decision 13; mappings in [references/tables.md](references/tables.md#adopting-the-2026-07-28-era).

- [ ]: Era posture chosen and configured (`legacy: 'stateless'` or `'reject'`).

## References

- Express: [framework-express.md](../mcp-server/references/framework-express.md)
- Fastify: [framework-fastify.md](../mcp-server/references/framework-fastify.md)
- Hono: [framework-hono.md](../mcp-server/references/framework-hono.md)
- Codemod: [codemod-reference.md](references/codemod-reference.md)

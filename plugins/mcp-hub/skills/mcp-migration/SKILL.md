---
name: mcp-migration
description: 'Use when a project depends on @modelcontextprotocol/sdk (v1), shows v1 MCP idioms (server.tool, McpError, RequestHandlerExtra, setRequestHandler with a Schema), carries @mcp-codemod-error markers, or is being upgraded to the TypeScript SDK v2 packages.'
---

# MCP migration (v1 to v2)

The SDK maintainers ship the migration guide as their own agent skill, `mcp-typescript-sdk-upgrade-to-v2`. It is the source of truth for every rename and every manual step; this skill only gets you there and covers what comes after.

- Rendered: `https://ts.sdk.modelcontextprotocol.io/v2/migration/upgrade-to-v2`
- Source: `https://github.com/modelcontextprotocol/typescript-sdk/tree/main/skills/mcp-typescript-sdk-upgrade-to-v2` (`SKILL.md` plus one file per subsystem under `references/`)

Read the official `SKILL.md` before editing anything. Then open only the reference file that matches the type error, runtime failure or marker in front of you.

## Run it

1. Check the declared ranges in `package.json`: Node.js 20+, and `zod ^4.2.0`. A zod-3 range installs and typechecks under v2, then fails at runtime on the first `tools/list`.
2. Run the codemod at the **package root**, not `./src`; it rewrites `package.json`, tests and scripts too:

   ```bash
   npx @modelcontextprotocol/codemod@latest v1-to-v2 .
   ```

3. Find every site it recognized but could not rewrite:

   ```bash
   grep -rn '@mcp-codemod-error' .
   ```

4. Typecheck (`tsc --noEmit`). Each remaining error maps to one reference file in the official skill.
5. Run your formatter on the changed files; the codemod rewrites the AST without formatting.
6. Run the tests.

The migration is done when no `@mcp-codemod-error` marker remains, `@modelcontextprotocol/sdk` is gone from `package.json`, typecheck passes, and the tests pass.

## Traps the compiler will not show

- **Injected SDK surfaces.** The codemod is import-driven. A file that receives the SDK as a parameter and has no SDK import is never rewritten, and its v1 idioms fail at runtime: `setRequestHandler(Schema, …)` throws a `TypeError` at registration. Grep for `setRequestHandler(`, `ErrorCode.` and `extra.` beyond import statements.
- **Still on the 2025 era.** The codemod renames transports but leaves `server.connect(new StdioServerTransport())` and `*StreamableHTTPServerTransport` in place. Those serve 2025-era clients only, and a client pinned to 2026-07-28 cannot connect.
- **`import { z } from 'zod'`** added by the codemod is correct on zod 4; it is not a v3 import.

## After the codemod

The official guide makes the code compile on v2. These skills cover the v2-native rewrite that follows:

| What the migrated code still does                                          | Skill             |
| :------------------------------------------------------------------------- | :---------------- |
| `server.connect(...)`, hand-wired HTTP transports, sessions                | `mcp-transport`   |
| Throws `ProtocolError` from tools, matches `-32002`, raw shapes            | `mcp-tools`       |
| `resources/subscribe` bookkeeping, `server.resource` leftovers             | `mcp-resources`   |
| `ctx.mcpReq.elicitInput` push calls                                        | `mcp-elicitation` |
| v1 auth router, `extra.authInfo`, `{ auth: provider }`, `finishAuth(code)` | `mcp-auth`        |
| Client calls, server-request handlers, subscriptions                       | `mcp-client`      |

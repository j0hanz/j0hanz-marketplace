---
name: mcp-router
description: Hook-injected routing map for MCP SDK v2 work — not invocable; hooks/session-start.js injects the body (frontmatter stripped) at session start.
user-invocable: false
disable-model-invocation: true
metadata:
  category: technique
---

# MCP Router & Workflows

If this content already appears earlier in the session, skip re-reading it.

Entry point and canonical workflows for MCP SDK v2. Load sub-skills only when needed (never upfront or twice).

## Routing Map

- **Plan**: [mcp-planning]
- **Build**: [mcp-server] (server) or [mcp-client] (client)
- **Auth**: [mcp-auth]
- **Elicit**: [mcp-elicitation]
- **Protocol**: [mcp-protocol]
- **Migrate**: `mcp-migrator` agent (runs codemods) — for reference material load [mcp-migration]
- **Test**: [mcp-test]
- **Debug** (via `/mcp test`): `mcp-debugger` agent (on failure)
- **Audit**: `mcp-auditor` agent (read-only)
- **Publish**: [mcp-server] `references/distribution.md`

## Workflows

### Build Workflow

1. **Clarify**: Run [mcp-planning] -> output `docs/mcp-decisions.md`.
2. **Scaffold**: Load [mcp-server] or [mcp-client]. Modern split v2 SDK deps, ESM-first (CommonJS also shipped — `require('@modelcontextprotocol/…')` resolves natively).
3. **Auth** (*): HTTP/OAuth (Streamable HTTP) security. Load [mcp-auth].
4. **Interact** (*): Prompts, progress, cancellation. Load [mcp-elicitation].
5. **Test**: Load [mcp-test] to implement tests; they compile and run to completion.
6. **Distribute** (*): Package setup / deployment. See [mcp-server] `references/distribution.md`.
7. **Verify**: All prior phase checks pass.

### Audit Workflow

1. **Locate**: Scan for `@modelcontextprotocol/sdk` (v1 single-package) imports.
2. **Version**: If SDK v1, load [mcp-migration] (flag as Blocker).
   - **Version (deprecated APIs)**: Grep for SEP-2577-deprecated subsystems (`listRoots`, `sendRootsListChanged`, `sendLoggingMessage`, `createMessage`, `setLoggingLevel`), deprecated `registerClient` (SEP-991), and the removed variadic `.tool()`/`.prompt()`/`.resource()` registration — flag as Should Fix.
3. **Design**: Check structure via [mcp-server] / [mcp-client].
4. **Security** (*): Audit auth (HTTP). Load [mcp-auth].
5. **Interact** (*): Audit prompts/progress/cancellation. Load [mcp-elicitation].
6. **Tests**: Check test coverage via [mcp-test].
7. **Intent**: Validate code matches `docs/mcp-decisions.md`.
8. **Report**: Rank findings: Blockers, Should Fix, Nice to Have. Formatted as:
   `- [file:line] | [Issue details] | [Skill to fix]`

### Migrate Workflow

Canonical steps live in [mcp-migration] (scope → codemod → flags → packages → modernize → mcpserver → tsconfig → verify → era). Dispatch the `mcp-migrator` agent to execute; load [mcp-migration] for reference tables (renames, package split, era adoption).

### Debug Workflow

1. **Reproduce**: Capture the failing request/response or error code.
2. **Classify**: Match the error against [mcp-test] `references/tables.md` (`ProtocolErrorCode` / `SdkErrorCode`).
3. **Isolate**: Narrow to transport, protocol, auth, or application layer; reload the matching skill ([mcp-client] / [mcp-protocol] / [mcp-auth] / [mcp-server]).
4. **Fix**: Apply the fix; re-run the reproducer.

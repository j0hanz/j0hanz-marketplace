---
description: Guide to using the `@modelcontextprotocol/codemod` tool to refactor MCP codebases from v1 to v2.
metadata:
  tags: [codemod, migration, refactoring, v1-to-v2]
  source: internal
---

# Codemod Migration Tool

## CLI Usage

Run the codemod across a directory: `npx @modelcontextprotocol/codemod@beta v1-to-v2 .`

Run on a single file: `npx @modelcontextprotocol/codemod@beta v1-to-v2 src/server.ts`

## Migration Scope & Mappings

The tool automates the following mechanical refactors:

1. **Import Path Rewriting:** Replaces `@modelcontextprotocol/sdk/...` with scoped packages (see [tables.md](tables.md) → Package Split).
2. **Symbol & Context Renaming:** Renames v1 symbols and remaps `extra` parameters to v2 `ctx` — see [tables.md](tables.md) for the full rename reference.
3. **Low-level Request Handlers:** Converts schema-based requests:
   - `server.setRequestHandler(CallToolRequestSchema, ...)` → `server.setRequestHandler('tools/call', ...)`
4. **Schema Structuring:**
   - Converts `.tool()` / `.prompt()` / `.resource()` calls to `registerTool` / `registerPrompt` / `registerResource`.
   - Wraps raw input configurations in `z.object()`.

### Code Review Comments

If a safe refactoring rule cannot be determined, the tool injects an inline error comment:

`/* @mcp-codemod-error SSEServerTransport moved to @modelcontextprotocol/server-legacy/sse. */`

Find files with warnings: `grep -rn '@mcp-codemod-error' .`

## Programmatic API Reference

Import and trigger migrations using `ts-morph` and the runner API.

### Diagnostic Interfaces

```ts
enum DiagnosticLevel {
  Error = 'error',
  Warning = 'warning',
  Info = 'info',
}

interface Diagnostic {
  level: DiagnosticLevel;
  file: string;
  line: number;
  message: string;
  category?: 'v2-gap';
  advisoryOnly?: boolean;
  tag?: 'zod-injected';
  insertComment?: boolean;
}
```

### Runner Configurations & Results

```ts
interface RunnerOptions {
  targetDir: string;
  dryRun?: boolean;
  verbose?: boolean;
  transforms?: string[];
  ignore?: string[];
}

interface RunnerResult {
  filesChanged: number;
  totalChanges: number;
  diagnostics: Diagnostic[];
  packageJsonChanges?: PackageJsonChange[];
  commentCount: number;
}
```

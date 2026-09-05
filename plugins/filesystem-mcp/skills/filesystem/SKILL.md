---
name: filesystem
description: Use the filesystem MCP server for batched file reads, scoped RE2 searches, multi-file replacements, or single-file patches. Use when these operations benefit from filesystem MCP; ordinary single-file work can use Claude's built-in tools.
---

# Filesystem MCP

Discover the needed tools from the plugin's `filesystem` server on demand. Call `list_roots` before choosing paths; access is limited to the current project. If the server is unavailable, report that and check `/mcp` rather than broadening access.

- **Read/search:** narrow the directory or glob first. Use line ranges, head/tail, and supported result limits; batch related reads. Treat truncation as partial evidence and follow returned cursors/resources promptly, since cached results expire. An empty search is no matches within that scope, not proof about the whole repository.
- **Regex:** RE2 has no lookarounds or backreferences. Use literal matching when regex is unnecessary.
- **Preview:** `replace_text` with `dryRun=true` previews bulk replacements. `returnDiff=true` still writes. Inspect the preview before applying a user-requested replacement.
- **Mutations:** `create` overwrites existing files. `edit` applies sequential first-match literal replacements, up to five files per call; `replace_text` replaces all occurrences. `patch` accepts a single-file unified diff.
- **Authorization:** overwrite or delete only when the user's request covers those files and that action. If required confirmation is denied, cancelled, or unavailable, stop and report the block; do not retry through another tool to bypass it.

Use the server's `internal://instructions` resource or `get-help` prompt when tool-specific details are needed, rather than loading every tool definition. After a mutation, inspect the resulting diff or relevant files and report what changed.

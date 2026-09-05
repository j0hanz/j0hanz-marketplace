# Filesystem MCP

Claude Code plugin for [@j0hanz/filesystem-mcp](https://github.com/j0hanz/filesystem-mcp): batched reads, RE2 search, diffs, and file edits within the current project.

## Install

Requires **Node.js 24+**, npm, and current Claude Code. The first launch downloads the pinned server package, `@j0hanz/filesystem-mcp@2.0.0`, through npm; no source checkout or build is needed.

```text
/plugin marketplace add j0hanz/j0hanz-marketplace
/plugin install filesystem-mcp@j0hanz-marketplace
```

Follow Claude's activation prompt, or run `/reload-plugins`. Use `/mcp` to check the `filesystem` connection. The server's tools are discovered as needed; `/filesystem-mcp:filesystem` loads the short workflow guide explicitly.

## Defaults

- Native stdio transport; no HTTP listener, API key, or background service.
- `${CLAUDE_PROJECT_DIR}` is the initial allowed root and boundary for additional grants. Inherited extra roots, CWD discovery, and HTTP settings are neutralized.
- Read/write tools are available. Sensitive patterns such as `.env`, `*.pem`, and SSH private keys remain denied, including when inherited settings would allow them.
- This is a server-enforced access boundary, not an OS sandbox or a restriction on Claude's other tools. It does not protect against concurrent adversarial changes to filesystem links.

For a **read-only local variant**, use the plugin's [.mcp.json](.mcp.json) as the template and insert `--read-only` before the project argument. That flag removes mutating tools; there is no read-only environment setting. Maintain the variant outside Claude's installed plugin cache, where updates would overwrite edits, and disable the original plugin to avoid duplicate servers.

## Troubleshooting

Check `node --version` and `npm --version` in the environment launching Claude. If download fails, restore npm registry access and retry; an uncached first launch cannot work offline. Inspect `/mcp` for startup errors and reload plugins or restart Claude after resolving them.

If access is denied, check `list_roots` and the requested path. Do not grant the whole home directory or filesystem to work around a connection or path error. `dryRun=true` previews bulk replacements; `returnDiff=true` does not prevent writes.

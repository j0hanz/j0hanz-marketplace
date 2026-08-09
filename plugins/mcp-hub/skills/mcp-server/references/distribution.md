---
description: >-
  Guide to packaging MCP servers for npm/npx, host registration (Cursor, VS Code, Claude), and production deployment.
metadata:
  tags: [distribution, packaging, deployment, hosting]
  source: internal
---

# Distributing MCP Servers

Ship a finished server after testing it with `mcp-test`.

## stdio servers — npm package run via npx

Required `package.json` setup:

```jsonc
{
  "name": "example-mcp",
  "version": "0.1.0",
  "type": "module",
  "bin": { "example-mcp": "dist/index.js" },
  "files": ["dist"],
  "engines": { "node": ">=20" },
  "scripts": { "build": "tsc", "prepublishOnly": "npm run build && npm test" },
}
```

- The entry file's first line must be exactly `#!/usr/bin/env node`.
- Pin the SDK version exactly (the current beta, no `^`) — beta releases can break between minors.
- Smoke-test the packed artifact before publishing:

```sh
npm pack
npx @modelcontextprotocol/inspector npx -y ./example-mcp-0.1.0.tgz
```

## Host registration — copy into the README

| App             | How to connect                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Claude Code** | `claude mcp add example -- npx -y example-mcp`                                                                                  |
| **VS Code**     | Add to `.vscode/mcp.json`: `{ "servers": { "example": { "type": "stdio", "command": "npx", "args": ["-y", "example-mcp"] } } }` |
| **Cursor**      | Add to `.cursor/mcp.json`: `{ "mcpServers": { "example": { "command": "npx", "args": ["-y", "example-mcp"] } } }`               |

## HTTP servers

Deploy like any web service — [serving-http.md](serving-http.md) and [scaling.md](scaling.md) cover handlers, adapters, and scaling. Never expose a public endpoint without auth (the [mcp-auth](../../mcp-auth/SKILL.md) skill).

## Versioning

- `new McpServer({ name: 'my-server', version: '0.1.0' })` must match `package.json` exactly.
- Changing what a tool requires is a breaking change: prefer adding optional fields; otherwise bump the major version.

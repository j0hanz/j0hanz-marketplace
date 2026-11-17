# MCP Hub

![License](https://img.shields.io/github/license/j0hanz/j0hanz-marketplace)

Skills for building and reviewing MCP servers and clients on the TypeScript SDK v2 (`@modelcontextprotocol/server`, `@modelcontextprotocol/client`). Checked against SDK 2.4.0 and protocol revisions 2025-11-25 and 2026-07-28.

## Skills

Each skill loads on its own when the work matches its description. There are no hooks and no agents.

| Skill             | Covers                                                                           |
| :---------------- | :------------------------------------------------------------------------------- |
| `mcp-tools`       | `registerTool`, schemas, structured output, annotations, tool vs protocol errors |
| `mcp-resources`   | Resources, URI templates, subscriptions across eras, prompts, completion         |
| `mcp-elicitation` | Asking the end user mid-call: `inputRequired`, forms, URL mode, `requestState`   |
| `mcp-client`      | Calling a server, answering its requests, change streams, response cache         |
| `mcp-transport`   | stdio, Streamable HTTP, legacy SSE, era negotiation, custom transports, tests    |
| `mcp-migration`   | v1 to v2: points at the SDK's official upgrade skill, then the rewrite           |
| `mcp-auth`        | Bearer-token gate, protected resource metadata, client OAuth, machine auth       |

## Install

Claude Code:

```text
/plugin install mcp-hub@j0hanz-marketplace
```

Copilot CLI and Antigravity CLI install lines are in the [marketplace README](../../README.md).

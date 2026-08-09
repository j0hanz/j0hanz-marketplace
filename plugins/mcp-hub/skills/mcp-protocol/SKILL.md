---
name: mcp-protocol
description: Use when working with low-level MCP v2 protocol, custom transports, raw wire messages, gateways, or the low-level Server class — not the high-level McpServer (see mcp-server).
when_to_use: Custom methods, custom transports, raw wire messages, MCP gateways, MCP proxies, low-level server.
user-invocable: false
metadata:
  category: technique
---

# MCP Protocol

Prefer `McpServer`. Only use `Server` for custom features. Docs: https://ts.sdk.modelcontextprotocol.io/v2/

## Steps

1. **Verify Suitability**: Assess if the standard high-level `McpServer` is inadequate before using the low-level raw `Server` module (which lacks automatic validation, capabilities, or error handling).
2. **Define Custom Methods**: Prefix custom extension methods with distinct namespace identifiers (e.g. `acme/search`) and parameterize explicit schemas.
3. **Register Custom Capabilities**: Declare extension support details explicitly by registering capabilities properties in the server metadata structure.

- [ ] Custom extension capabilities are declared in the server capabilities object, not left implicit.

4. **Implement Custom Transport**: When creating custom connections, build out `start()`, `send()`, and `close()`. Throw exceptions explicitly on send failures and trigger standard error callbacks.
5. **Route Version Boundaries**: Use `isLegacyRequest()` to intercept 2025-era requests (any request lacking a per-request `_meta` envelope) and branch message delivery between legacy and modern clients in multi-client gateways.

## Completion Criteria

To consider advanced implementation complete, you must verify:

- [ ] Low-level raw namespaces and custom RPC method targets are prefixed with unique vendor names (e.g. `acme/`).
- [ ] Custom transport classes implement the standard life stages properly, triggering `onclose` on termination.
- [ ] Hand-rolled custom connection transport objects NEVER invoke `.start()` manually; transport startup is delegated to `.connect()`.
- [ ] Intercept gateways are backed by rigorous error controls to prevent uncaught network failures from interrupting long-lived streams.
- [ ] Multi-client gateways route legacy vs modern handshakes via `isLegacyRequest()` instead of assuming a single protocol era.

## Reference Guides

- Custom transports & direct dispatch: [references/examples.md](references/examples.md)
- Gateways, Worker Fleets, & wire schemas: [references/wire-schemas-and-gateways.md](references/wire-schemas-and-gateways.md)
- Testing & debugging hand-rolled adapters: [mcp-test]
- Gateway authentication boundary controls: [mcp-auth]

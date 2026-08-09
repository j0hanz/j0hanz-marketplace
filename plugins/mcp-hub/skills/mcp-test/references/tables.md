---
description: Debugging reference tables — ProtocolErrorCode wire codes, SdkErrorCode local codes, and common error symptoms with their respective root causes and solutions.
metadata:
  tags: [debugging-tables, troubleshooting, errors]
  source: internal
---

# Error Code Reference Tables

## Error classes

| Class                                 | Package       | Meaning                                                                                                                                                                   |
| ------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ProtocolError(code, message, data?)` | server/client | JSON-RPC error on the wire; subclasses: `ResourceNotFoundError`, `UrlElicitationRequiredError`, `UnsupportedProtocolVersionError`, `MissingRequiredClientCapabilityError` |
| `SdkError(code, message)`             | server/client | Local SDK failure — never a wire error                                                                                                                                    |
| `SdkHttpError`                        | server/client | HTTP-level failure with a JSON-RPC error body (2025-era)                                                                                                                  |
| `UnauthorizedError`                   | client        | 401 requiring (re-)authorization                                                                                                                                          |
| `IssuerMismatchError`                 | client        | OAuth mix-up defense (`kind: 'metadata' \| 'authorization_response'`)                                                                                                     |
| `AuthorizationServerMismatchError`    | client        | Credential pinned to a different AS (`expectedIssuer`)                                                                                                                    |
| `OAuthError` / `OAuthErrorCode`       | server        | Thrown by token verifiers → OAuth-conformant HTTP responses                                                                                                               |

## Error Channels

See [../../mcp-server/references/errors.md](../../mcp-server/references/errors.md) for the tool vs protocol error channel distinction.

## ProtocolErrorCode (wire codes)

| Member                            | Code   | Meaning                                                                             |
| :-------------------------------- | :----- | :---------------------------------------------------------------------------------- |
| `ParseError`                      | −32700 | Not valid JSON                                                                      |
| `InvalidRequest`                  | −32600 | Not a valid JSON-RPC request                                                        |
| `MethodNotFound`                  | −32601 | No handler for the method                                                           |
| `InvalidParams`                   | −32602 | Bad params — also a `resources/read` miss                                           |
| `InternalError`                   | −32603 | Handler threw a non-`ProtocolError`                                                 |
| `ResourceNotFound`                | −32002 | Receive-tolerated only; the SDK always emits −32602 — throw `ResourceNotFoundError` |
| `MissingRequiredClientCapability` | −32021 | Request needs an undeclared client capability _(new in 2026-07-28)_                 |
| `UnsupportedProtocolVersion`      | −32022 | Requested version unknown/unsupported; `data.supported` lists options _(new)_       |
| `UrlElicitationRequired`          | −32042 | Tool needs the user to visit a URL first                                            |

## SdkErrorCode (local codes)

| Code                                                                                                                                                                                    | When                                                                                          |
| :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------- |
| `NotConnected` / `AlreadyConnected` / `NotInitialized`                                                                                                                                  | Transport/protocol lifecycle misuse                                                           |
| `CapabilityNotSupported`                                                                                                                                                                | Required capability not supported                                                             |
| `RequestTimeout`                                                                                                                                                                        | Request timed out                                                                             |
| `ConnectionClosed`                                                                                                                                                                      | Connection closed with requests in flight                                                     |
| `SendFailed`                                                                                                                                                                            | Failed to send a message                                                                      |
| `InvalidResult`                                                                                                                                                                         | Response failed local schema validation                                                       |
| `UnsupportedResultType`                                                                                                                                                                 | 2025-era response carried an unknown `resultType`                                             |
| `InputRequiredRoundsExceeded`                                                                                                                                                           | Auto-fulfilment hit `maxRounds`                                                               |
| `ListPaginationExceeded`                                                                                                                                                                | No-arg `list*()` aggregate walk hit `listMaxPages` (explicit-`cursor` calls are never capped) |
| `MethodNotSupportedByProtocolVersion`                                                                                                                                                   | Outbound method doesn't exist on the negotiated revision                                      |
| `EraNegotiationFailed`                                                                                                                                                                  | `connect()` found no shared era (pin unmet / no overlap)                                      |
| `ClientHttpNotImplemented` / `ClientHttpAuthentication` / `ClientHttpForbidden` / `ClientHttpUnexpectedContent` / `ClientHttpFailedToOpenStream` / `ClientHttpFailedToTerminateSession` | HTTP client-transport failures                                                                |

## Common Error Symptoms and Fixes

| Error                                                | Fix                                                                                                                                                                                                                                                                                    |
| :--------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SyntaxError: ... is not valid JSON`                 | Something wrote to stdout on a stdio server. Log with `console.error`, never `console.log`.                                                                                                                                                                                            |
| `TS2589: Type instantiation is excessively deep`     | Multiple Zod versions in the tree. Dedupe to a single Zod 4.                                                                                                                                                                                                                           |
| `ReferenceError: crypto is not defined`              | Node < 20. Upgrade, or polyfill: `globalThis.crypto = webcrypto`.                                                                                                                                                                                                                      |
| `SdkError: ERA_NEGOTIATION_FAILED`                   | Client and server share no protocol era. Two shapes: (1) a `pin` the server doesn't offer — widen the pin or use `mode: 'auto'`; (2) `mode: 'auto'` with a `supportedProtocolVersions` list lacking a pre-2026 entry — add a legacy revision to the list so the fallback is available. |
| `SdkError: METHOD_NOT_SUPPORTED_BY_PROTOCOL_VERSION` | Calling a method the negotiated era doesn't have — the error names the replacement.                                                                                                                                                                                                    |
| `No exported member 'SSEServerTransport'`            | HTTP serving now uses `createMcpHandler()` from `@modelcontextprotocol/server`. For a server that must stay on SSE, import the frozen v1 copy: `import { SSEServerTransport } from '@modelcontextprotocol/server-legacy/sse'`.                                                         |

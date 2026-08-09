---
description: >-
  Overview of tool vs protocol error channels, exception rules, and code mapping guidelines.
metadata:
  tags: [errors, protocol-errors, tool-errors]
  source: internal
---

# Errors — two channels, picked by audience

| Channel            | Shape                                     | Audience                                      | Produced by                                                 |
| ------------------ | ----------------------------------------- | --------------------------------------------- | ----------------------------------------------------------- |
| **Tool error**     | Result with `isError: true`               | The **model** — reads the message and retries | Tool handlers: return it or `throw` anything                |
| **Protocol error** | JSON-RPC error `{ code, message, data? }` | The **caller's code**                         | Resource/prompt/completion callbacks: `throw ProtocolError` |

```ts
// Tool error — put the recovery hint in the text:
return {
  content: [{ type: 'text', text: `No note "${id}". Known ids: ${ids.join(', ')}` }],
  isError: true,
};
```

```ts
// Resource/prompt/completion callbacks:
import {
  ProtocolError,
  ProtocolErrorCode,
  ResourceNotFoundError,
} from '@modelcontextprotocol/server';
throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Note ids are lowercase, got "${id}"`);
throw new ResourceNotFoundError(uri.href); // -32602 with data: { uri }
```

Tool handler **cannot** emit protocol error — every throw (even `ProtocolError`) becomes `isError: true`. Exception: `UrlElicitationRequiredError` propagates (`-32042`). Full code tables in [mcp-test](../../mcp-test/SKILL.md) skill.
